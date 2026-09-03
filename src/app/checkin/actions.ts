"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { normalizePhoneForStorage } from "@/lib/crm/phone";
import { checkinEventDataSchema, checkinNewClientSchema } from "@/lib/crm/validation";

type SupabaseClientLike = Awaited<ReturnType<typeof getCurrentUserContext>>["supabase"];

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "No se pudo procesar la solicitud";
}

function withError(url: string, message: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}error=${encodeURIComponent(message)}`;
}

function readEventDataFromFormData(formData: FormData) {
  return checkinEventDataSchema.parse({
    locality: formData.get("locality") || "",
    interestLevel: formData.get("interestLevel"),
    interestIds: Array.from(new Set(formData.getAll("interestIds").map(String).filter(Boolean))),
  });
}

/**
 * Guarda localidad, nivel de interes en el stand e intereses nuevos sobre un
 * cliente ya insertado/encontrado. Los intereses se agregan sin pisar los que
 * el cliente ya tenia cargados de antes (el check-in es aditivo, no una edicion
 * completa de ficha) -de ahi el upsert con ignoreDuplicates en vez del
 * borrar-y-reinsertar que usa la edicion de ficha completa.
 */
async function attachEventData(
  supabase: SupabaseClientLike,
  clientId: string,
  eventTag: string,
  eventData: { locality?: string; interestLevel: string; interestIds: string[] },
) {
  const { error: updateError } = await supabase
    .from("clients")
    .update({
      event_tag: eventTag,
      event_interest_level: eventData.interestLevel,
      ...(eventData.locality ? { locality: eventData.locality } : {}),
    })
    .eq("id", clientId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (eventData.interestIds.length > 0) {
    const rows = eventData.interestIds.map((interestId) => ({
      client_id: clientId,
      interest_id: interestId,
    }));

    const { error: interestsError } = await supabase
      .from("client_interests")
      .upsert(rows, { onConflict: "client_id,interest_id", ignoreDuplicates: true });

    if (interestsError) {
      throw new Error(interestsError.message);
    }
  }
}

/** Marca a un cliente que YA existe en el sistema como que vino a este evento. No duplica nada. */
export async function checkinExistingAction(
  clientId: string,
  eventTag: string,
  redirectTo: string,
  formData: FormData,
) {
  const { supabase } = await getCurrentUserContext();

  try {
    const eventData = readEventDataFromFormData(formData);
    await attachEventData(supabase, clientId, eventTag, eventData);
  } catch (error) {
    redirect(withError(redirectTo, toErrorMessage(error)));
  }

  revalidatePath("/checkin");
  revalidatePath(`/clients/${clientId}`);
  redirect(redirectTo);
}

/**
 * Carga un cliente nuevo directo desde el check-in del evento (nombre, telefono,
 * localidad, intereses y nivel de interes en el stand). Antes de insertar, hace un
 * ultimo chequeo por telefono exacto -si alguien ya lo cargo mientras tanto o
 * la busqueda no lo encontro por algun motivo, en vez de duplicarlo lo
 * etiqueta con los mismos datos del evento y sigue.
 */
export async function checkinNewAction(eventTag: string, redirectTo: string, formData: FormData) {
  const { supabase, user } = await getCurrentUserContext();

  try {
    const payload = checkinNewClientSchema.parse({
      event: eventTag,
      firstName: formData.get("firstName"),
      phone: formData.get("phone"),
      locality: formData.get("locality") || "",
      interestLevel: formData.get("interestLevel"),
      interestIds: Array.from(new Set(formData.getAll("interestIds").map(String).filter(Boolean))),
    });

    const normalizedPhone = normalizePhoneForStorage(payload.phone);

    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("phone_normalized", normalizedPhone)
      .is("archived_at", null)
      .maybeSingle<{ id: string }>();

    if (existing) {
      await attachEventData(supabase, existing.id, payload.event, payload);
    } else {
      const { data: insertedClient, error: insertError } = await supabase
        .from("clients")
        .insert({
          first_name: payload.firstName,
          phone_raw: payload.phone,
          phone_normalized: normalizedPhone,
          status: "nuevo",
          assigned_user_id: user.id,
          event_tag: payload.event,
          event_interest_level: payload.interestLevel,
          locality: payload.locality || null,
        })
        .select("id")
        .single<{ id: string }>();

      if (insertError) {
        throw new Error(insertError.message);
      }

      if (payload.interestIds.length > 0) {
        const rows = payload.interestIds.map((interestId) => ({
          client_id: insertedClient.id,
          interest_id: interestId,
        }));

        const { error: interestsError } = await supabase.from("client_interests").insert(rows);

        if (interestsError) {
          throw new Error(interestsError.message);
        }
      }
    }
  } catch (error) {
    redirect(withError(redirectTo, toErrorMessage(error)));
  }

  revalidatePath("/checkin");
  revalidatePath("/clients");
  redirect(redirectTo);
}

/**
 * Sortea un ganador entre los clientes etiquetados con este evento, excluyendo
 * a los que ya salieron sorteados antes en la misma tanda (para "sortear otro"
 * sin repetir a la misma persona, en cualquiera de los 5 puestos). La cola de
 * excluidos viaja en la URL, no en una tabla nueva -mismo mecanismo que el
 * modo Jornada.
 *
 * Regla de negocio (igual para los 5 puestos, no solo el primero): todos los
 * anotados entran al sorteo -no hay una lista aparte de "compradores"-, pero
 * cada uno pesa distinto: 1 ficha base + 1 ficha extra por cada compra
 * registrada (client_purchases). Asi cualquiera puede salir sorteado, pero
 * quien ya compro (y mas veces compro) tiene mas chances, sin que el sorteo
 * deje de ser al azar ni se trabe si todavia no hay ningun comprador anotado.
 */
export async function pickWinnerAction(eventTag: string, excludedCsv: string, redirectTo: string) {
  const { supabase } = await getCurrentUserContext();
  const excludedIds = excludedCsv.split(",").filter(Boolean);
  let newExcluded: string | null = null;

  try {
    let query = supabase
      .from("clients")
      .select("id")
      .eq("event_tag", eventTag)
      .is("archived_at", null);

    if (excludedIds.length > 0) {
      query = query.not("id", "in", `(${excludedIds.join(",")})`);
    }

    const { data: eligible, error } = await query.returns<{ id: string }[]>();

    if (error) {
      throw new Error(error.message);
    }

    if (!eligible || eligible.length === 0) {
      throw new Error("No quedan mas participantes para sortear.");
    }

    const { data: purchaseRows, error: purchaseError } = await supabase
      .from("client_purchases")
      .select("client_id")
      .in(
        "client_id",
        eligible.map((client) => client.id),
      )
      .returns<{ client_id: string }[]>();

    if (purchaseError) {
      throw new Error(purchaseError.message);
    }

    const purchaseCounts = new Map<string, number>();
    for (const row of purchaseRows ?? []) {
      purchaseCounts.set(row.client_id, (purchaseCounts.get(row.client_id) ?? 0) + 1);
    }

    const weightedTickets: string[] = [];
    for (const client of eligible) {
      const tickets = 1 + (purchaseCounts.get(client.id) ?? 0);
      for (let i = 0; i < tickets; i++) {
        weightedTickets.push(client.id);
      }
    }

    const winnerId = weightedTickets[Math.floor(Math.random() * weightedTickets.length)];
    newExcluded = [...excludedIds, winnerId].join(",");
  } catch (error) {
    redirect(withError(redirectTo, toErrorMessage(error)));
  }

  const separator = redirectTo.includes("?") ? "&" : "?";
  redirect(`${redirectTo}${separator}excluded=${newExcluded}`);
}
