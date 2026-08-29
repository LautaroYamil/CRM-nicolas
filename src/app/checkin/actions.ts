"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { normalizePhoneForStorage } from "@/lib/crm/phone";
import { checkinNewClientSchema } from "@/lib/crm/validation";

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

/** Marca a un cliente que YA existe en el sistema como que vino a este evento. No duplica nada. */
export async function checkinExistingAction(clientId: string, eventTag: string, redirectTo: string) {
  const { supabase } = await getCurrentUserContext();

  try {
    const { error } = await supabase.from("clients").update({ event_tag: eventTag }).eq("id", clientId);

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    redirect(withError(redirectTo, toErrorMessage(error)));
  }

  revalidatePath("/checkin");
  redirect(redirectTo);
}

/**
 * Carga un cliente nuevo directo desde el check-in del evento (solo nombre y
 * telefono, sin el resto del formulario completo). Antes de insertar, hace un
 * ultimo chequeo por telefono exacto -si alguien ya lo cargo mientras tanto o
 * la busqueda no lo encontro por algun motivo, en vez de duplicarlo lo
 * etiqueta con el evento y sigue.
 */
export async function checkinNewAction(eventTag: string, redirectTo: string, formData: FormData) {
  const { supabase, user } = await getCurrentUserContext();

  try {
    const payload = checkinNewClientSchema.parse({
      event: eventTag,
      firstName: formData.get("firstName"),
      phone: formData.get("phone"),
    });

    const normalizedPhone = normalizePhoneForStorage(payload.phone);

    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("phone_normalized", normalizedPhone)
      .is("archived_at", null)
      .maybeSingle<{ id: string }>();

    if (existing) {
      const { error: tagError } = await supabase
        .from("clients")
        .update({ event_tag: payload.event })
        .eq("id", existing.id);

      if (tagError) {
        throw new Error(tagError.message);
      }
    } else {
      const { error: insertError } = await supabase.from("clients").insert({
        first_name: payload.firstName,
        phone_raw: payload.phone,
        phone_normalized: normalizedPhone,
        status: "nuevo",
        assigned_user_id: user.id,
        event_tag: payload.event,
      });

      if (insertError) {
        throw new Error(insertError.message);
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
 * Sortea un ganador al azar entre los clientes etiquetados con este evento,
 * excluyendo a los que ya salieron sorteados antes en la misma tanda (para
 * "sortear otro" sin repetir a la misma persona). La cola de excluidos viaja
 * en la URL, no en una tabla nueva -mismo mecanismo que el modo Jornada.
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

    const winner = eligible[Math.floor(Math.random() * eligible.length)];
    newExcluded = [...excludedIds, winner.id].join(",");
  } catch (error) {
    redirect(withError(redirectTo, toErrorMessage(error)));
  }

  const separator = redirectTo.includes("?") ? "&" : "?";
  redirect(`${redirectTo}${separator}excluded=${newExcluded}`);
}
