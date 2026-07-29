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
    locality: formData.get("locality") || "",
    address: formData.get("address") || "",
    status: formData.get("status"),
    assignedUserId: formData.get("assignedUserId"),
    notes: formData.get("notes") || "",
    interestIds,
  });
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "No se pudo procesar la solicitud";
}

export async function createClientAction(formData: FormData) {
  const { supabase, user, profile } = await getCurrentUserContext();
  let createdClientId: string | null = null;

  try {
    const payload = formDataToClientPayload(formData);
    const assignedUserId = profile.role === "admin" ? payload.assignedUserId : user.id;
    const normalizedPhone = normalizePhoneForStorage(payload.phone);

    const { data: insertedClient, error } = await supabase
      .from("clients")
      .insert({
        first_name: payload.firstName,
        last_name: payload.lastName || null,
        phone_raw: payload.phone,
        phone_normalized: normalizedPhone,
        locality: payload.locality || null,
        address: payload.address || null,
        status: payload.status,
        assigned_user_id: assignedUserId,
        notes: payload.notes || null,
      })
      .select("id")
      .single();

    if (error || !insertedClient) {
      throw new Error(error?.message || "No se pudo crear el cliente");
    }

    createdClientId = insertedClient.id;

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
  redirect(`/clients/${createdClientId}`);
}

export async function updateClientAction(clientId: string, formData: FormData) {
  const { supabase, user, profile } = await getCurrentUserContext();

  try {
    const payload = formDataToClientPayload(formData);
    const assignedUserId = profile.role === "admin" ? payload.assignedUserId : user.id;
    const normalizedPhone = normalizePhoneForStorage(payload.phone);

    const { error: updateError } = await supabase
      .from("clients")
      .update({
        first_name: payload.firstName,
        last_name: payload.lastName || null,
        phone_raw: payload.phone,
        phone_normalized: normalizedPhone,
        locality: payload.locality || null,
        address: payload.address || null,
        status: payload.status,
        assigned_user_id: assignedUserId,
        notes: payload.notes || null,
      })
      .eq("id", clientId);

    if (updateError) {
      throw new Error(updateError.message);
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
