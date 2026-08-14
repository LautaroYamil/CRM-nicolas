"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { argDateTimeLocalToIso } from "@/lib/crm/dates";
import { normalizePhoneForStorage } from "@/lib/crm/phone";
import { clientFormSchema, scheduleFollowUpSchema } from "@/lib/crm/validation";

function formDataToClientPayload(formData: FormData) {
  const interestIds = Array.from(new Set(formData.getAll("interestIds").map(String).filter(Boolean)));

  return clientFormSchema.parse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName") || "",
    phone: formData.get("phone"),
    dni: formData.get("dni") || "",
    birthDate: formData.get("birthDate") || "",
    locality: formData.get("locality") || "",
    address: formData.get("address") || "",
    status: formData.get("status"),
    assignedUserId: formData.get("assignedUserId"),
    lossReasonId: formData.get("lossReasonId") || "",
    notes: formData.get("notes") || "",
    interestIds,
  });
}

/**
 * El motivo de perdida solo tiene sentido si el estado es "no_interesado":
 * se exige ahi (no se puede guardar sin elegirlo) y se limpia en cualquier
 * otro estado, para no dejar un motivo viejo colgado de una perdida que ya
 * no es tal.
 */
function resolveLossReasonId(status: string, lossReasonId: string) {
  if (status !== "no_interesado") {
    return null;
  }

  if (!lossReasonId) {
    throw new Error("Elegi un motivo para marcar al cliente como No interesado");
  }

  return lossReasonId;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "No se pudo procesar la solicitud";
}

/** Supabase client generico: evita acoplar este helper al tipo devuelto por getCurrentUserContext. */
type SupabaseClientLike = Awaited<ReturnType<typeof getCurrentUserContext>>["supabase"];

/**
 * El indice unico de DNI en la base (idx_clients_dni_unique) es global: no excluye
 * clientes archivados. Este chequeo tiene que coincidir con esa misma regla -si
 * excluyera archivados como antes, la app podia decir "disponible" y el INSERT
 * fallar igual con un error crudo de Postgres. Si el dueno del DNI esta en la
 * Papelera, se avisa distinto (para restaurarlo en vez de crear uno nuevo).
 */
async function assertDniAvailable(supabase: SupabaseClientLike, dni: string, excludeClientId?: string) {
  if (!dni) {
    return;
  }

  let query = supabase.from("clients").select("id, first_name, last_name, archived_at").eq("dni", dni).limit(1);

  if (excludeClientId) {
    query = query.neq("id", excludeClientId);
  }

  const { data } = await query.returns<
    { id: string; first_name: string; last_name: string | null; archived_at: string | null }[]
  >();
  const existing = data?.[0];

  if (existing) {
    const name = `${existing.first_name} ${existing.last_name ?? ""}`.trim();

    if (existing.archived_at) {
      throw new Error(
        `Ya existe un cliente con ese DNI en la Papelera: ${name}. Restauralo desde ahi en vez de crear uno nuevo.`,
      );
    }

    throw new Error(`Ya existe un cliente con ese DNI: ${name}`);
  }
}

/** Traduce el 23505 (unique_violation) de Postgres a un mensaje entendible, por si algo lo esquiva. */
function toClientErrorMessage(error: { code?: string; message: string }) {
  if (error.code === "23505" && error.message.includes("idx_clients_dni_unique")) {
    return "Ya existe un cliente con ese DNI.";
  }

  return error.message;
}

/**
 * Aviso (NO bloqueante) de telefono duplicado. A proposito no hay un UNIQUE en
 * la base: numeros compartidos en familia, telefonos que cambian de dueno y
 * futuras importaciones generarian falsos positivos si fuera una restriccion
 * dura. Se avisa despues de crear el cliente (no antes), asi nunca se pierde
 * lo que el vendedor tipeo si decide seguir igual.
 *
 * Devuelve el minimo de datos segun quien pregunta: si el cliente existente
 * es de OTRO vendedor y quien esta creando no es admin, no se revela nombre
 * ni ficha -eso filtraria datos entre carteras que RLS protege en todos lados
 * menos aca si no se tiene cuidado.
 */
async function findPhoneDuplicateWarning(
  supabase: SupabaseClientLike,
  phoneNormalized: string,
  excludeClientId: string,
  viewerAssignedUserId: string,
  viewerIsAdmin: boolean,
) {
  const { data } = await supabase
    .from("clients")
    .select("id, first_name, last_name, status, assigned_user_id")
    .eq("phone_normalized", phoneNormalized)
    .is("archived_at", null)
    .neq("id", excludeClientId)
    .limit(1)
    .returns<
      { id: string; first_name: string; last_name: string | null; status: string; assigned_user_id: string }[]
    >();

  const existing = data?.[0];

  if (!existing) {
    return null;
  }

  const isOwnClient = viewerIsAdmin || existing.assigned_user_id === viewerAssignedUserId;

  if (!isOwnClient) {
    return "warning=phone_duplicate_other_seller";
  }

  const name = `${existing.first_name} ${existing.last_name ?? ""}`.trim();
  const params = new URLSearchParams({
    warning: "phone_duplicate",
    dupId: existing.id,
    dupName: name,
    dupStatus: existing.status,
  });

  return params.toString();
}

export async function createClientAction(formData: FormData) {
  const { supabase, user, profile } = await getCurrentUserContext();
  let createdClientId: string | null = null;
  let phoneWarningQuery: string | null = null;

  try {
    const payload = formDataToClientPayload(formData);
    const assignedUserId = profile.role === "admin" ? payload.assignedUserId : user.id;
    const normalizedPhone = normalizePhoneForStorage(payload.phone);
    const lossReasonId = resolveLossReasonId(payload.status, payload.lossReasonId ?? "");

    await assertDniAvailable(supabase, payload.dni);

    const { data: insertedClient, error } = await supabase
      .from("clients")
      .insert({
        first_name: payload.firstName,
        last_name: payload.lastName || null,
        phone_raw: payload.phone,
        phone_normalized: normalizedPhone,
        dni: payload.dni || null,
        birth_date: payload.birthDate || null,
        locality: payload.locality || null,
        address: payload.address || null,
        status: payload.status,
        assigned_user_id: assignedUserId,
        loss_reason_id: lossReasonId,
        notes: payload.notes || null,
      })
      .select("id")
      .single();

    if (error || !insertedClient) {
      throw new Error(error ? toClientErrorMessage(error) : "No se pudo crear el cliente");
    }

    createdClientId = insertedClient.id;

    try {
      phoneWarningQuery = await findPhoneDuplicateWarning(
        supabase,
        normalizedPhone,
        insertedClient.id,
        user.id,
        profile.role === "admin",
      );
    } catch {
      // El aviso de duplicado es informativo, no bloqueante: si el chequeo
      // en si falla, no debe interrumpir un alta que ya se guardo bien.
      phoneWarningQuery = null;
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

    // Primer seguimiento opcional en el mismo alta
    const firstFollowUpAt = String(formData.get("firstFollowUpAt") ?? "").trim();

    if (firstFollowUpAt) {
      const followUp = scheduleFollowUpSchema.parse({
        type: formData.get("firstFollowUpType") || "llamada",
        scheduledAt: firstFollowUpAt,
        objective: formData.get("firstFollowUpObjective") || "",
      });

      const { error: followUpError } = await supabase.from("activities").insert({
        client_id: insertedClient.id,
        assigned_user_id: assignedUserId,
        type: followUp.type,
        status: "pendiente",
        scheduled_at: argDateTimeLocalToIso(followUp.scheduledAt),
        objective: followUp.objective || null,
        created_by: user.id,
      });

      if (followUpError) {
        throw new Error(followUpError.message);
      }
    }
  } catch (error) {
    redirect(`/clients/new?error=${encodeURIComponent(toErrorMessage(error))}`);
  }

  revalidatePath("/clients");
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  redirect(phoneWarningQuery ? `/clients/${createdClientId}?${phoneWarningQuery}` : `/clients/${createdClientId}`);
}

export async function updateClientAction(clientId: string, formData: FormData) {
  const { supabase, user, profile } = await getCurrentUserContext();

  try {
    const payload = formDataToClientPayload(formData);
    const assignedUserId = profile.role === "admin" ? payload.assignedUserId : user.id;
    const normalizedPhone = normalizePhoneForStorage(payload.phone);
    const lossReasonId = resolveLossReasonId(payload.status, payload.lossReasonId ?? "");

    await assertDniAvailable(supabase, payload.dni, clientId);

    const { error: updateError } = await supabase
      .from("clients")
      .update({
        first_name: payload.firstName,
        last_name: payload.lastName || null,
        phone_raw: payload.phone,
        phone_normalized: normalizedPhone,
        dni: payload.dni || null,
        birth_date: payload.birthDate || null,
        locality: payload.locality || null,
        address: payload.address || null,
        status: payload.status,
        assigned_user_id: assignedUserId,
        loss_reason_id: lossReasonId,
        notes: payload.notes || null,
      })
      .eq("id", clientId);

    if (updateError) {
      throw new Error(toClientErrorMessage(updateError));
    }

    const { error: deleteRelationsError } = await supabase
      .from("client_interests")
      .delete()
      .eq("client_id", clientId);

    if (deleteRelationsError) {
      throw new Error(deleteRelationsError.message);
    }

    if (payload.interestIds.length > 0) {
      const rows = payload.interestIds.map((interestId) => ({
        client_id: clientId,
        interest_id: interestId,
      }));

      const { error: interestInsertError } = await supabase.from("client_interests").insert(rows);

      if (interestInsertError) {
        throw new Error(interestInsertError.message);
      }
    }
  } catch (error) {
    redirect(`/clients/${clientId}/edit?error=${encodeURIComponent(toErrorMessage(error))}`);
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

/**
 * "Eliminar" un cliente = archivarlo: desaparece del directorio, la agenda y el
 * dashboard, pero el historial se conserva y se puede restaurar desde la Papelera.
 * Sus seguimientos pendientes se cancelan para que no sigan apareciendo en la agenda,
 * marcados con cancelled_via_archive=true para poder reactivarlos (y solo a ellos,
 * no a los que ya estaban cancelados manualmente antes) si el cliente se restaura.
 */
export async function archiveClientAction(clientId: string, redirectTo: string) {
  const { supabase } = await getCurrentUserContext();

  try {
    const { error } = await supabase
      .from("clients")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", clientId);

    if (error) {
      throw new Error(error.message);
    }

    const { error: cancelError } = await supabase
      .from("activities")
      .update({ status: "cancelada", cancelled_via_archive: true })
      .eq("client_id", clientId)
      .eq("status", "pendiente");

    if (cancelError) {
      throw new Error(cancelError.message);
    }
  } catch (error) {
    redirect(`${redirectTo}?error=${encodeURIComponent(toErrorMessage(error))}`);
  }

  revalidatePath("/clients");
  revalidatePath("/clients/trash");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  redirect(redirectTo);
}

/**
 * Restaura un cliente archivado. Reactiva solo los seguimientos que quedaron
 * cancelados PORQUE se archivo el cliente (cancelled_via_archive=true) -los que
 * el vendedor ya habia cancelado a mano antes de archivar quedan cancelados,
 * como corresponde. La fecha programada no se toca: si quedo en el pasado,
 * vuelve como pendiente/vencido, no se reprograma sola.
 */
export async function restoreClientAction(clientId: string, redirectTo: string) {
  const { supabase } = await getCurrentUserContext();

  try {
    const { error } = await supabase
      .from("clients")
      .update({ archived_at: null })
      .eq("id", clientId);

    if (error) {
      throw new Error(error.message);
    }

    const { error: reactivateError } = await supabase
      .from("activities")
      .update({ status: "pendiente", cancelled_via_archive: false })
      .eq("client_id", clientId)
      .eq("status", "cancelada")
      .eq("cancelled_via_archive", true);

    if (reactivateError) {
      throw new Error(reactivateError.message);
    }
  } catch (error) {
    redirect(`${redirectTo}?error=${encodeURIComponent(toErrorMessage(error))}`);
  }

  revalidatePath("/clients");
  revalidatePath("/clients/trash");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  redirect(redirectTo);
}

/** Borrado permanente e irreversible. Solo admin (tambien protegido por RLS). */
export async function permanentlyDeleteClientAction(clientId: string) {
  const { supabase, profile } = await getCurrentUserContext();

  if (profile.role !== "admin") {
    redirect("/clients/trash?error=Solo%20un%20administrador%20puede%20eliminar%20definitivamente");
  }

  try {
    const { error } = await supabase.from("clients").delete().eq("id", clientId);

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    redirect(`/clients/trash?error=${encodeURIComponent(toErrorMessage(error))}`);
  }

  revalidatePath("/clients");
  revalidatePath("/clients/trash");
  redirect("/clients/trash");
}
