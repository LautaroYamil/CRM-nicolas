"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { argDateTimeLocalToIso } from "@/lib/crm/dates";
import {
  completeActivitySchema,
  logContactSchema,
  rescheduleActivitySchema,
  scheduleFollowUpSchema,
} from "@/lib/crm/validation";

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "No se pudo procesar la solicitud";
}

function revalidateClientViews(clientId: string) {
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
}

async function getClientOwner(supabase: Awaited<ReturnType<typeof getCurrentUserContext>>["supabase"], clientId: string) {
  const { data: client, error } = await supabase
    .from("clients")
    .select("id, assigned_user_id")
    .eq("id", clientId)
    .single<{ id: string; assigned_user_id: string }>();

  if (error || !client) {
    throw new Error("Cliente no encontrado");
  }

  return client;
}

export async function logContactAction(clientId: string, formData: FormData) {
  const { supabase, user } = await getCurrentUserContext();

  try {
    const payload = logContactSchema.parse({
      type: formData.get("type"),
      outcome: formData.get("outcome"),
      nextScheduledAt: formData.get("nextScheduledAt") || "",
      nextObjective: formData.get("nextObjective") || "",
    });

    const client = await getClientOwner(supabase, clientId);
    const nowIso = new Date().toISOString();

    const { error } = await supabase.from("activities").insert({
      client_id: clientId,
      assigned_user_id: client.assigned_user_id,
      type: payload.type,
      status: "realizada",
      scheduled_at: nowIso,
      completed_at: nowIso,
      outcome: payload.outcome,
      created_by: user.id,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (payload.nextScheduledAt) {
      const { error: nextError } = await supabase.from("activities").insert({
        client_id: clientId,
        assigned_user_id: client.assigned_user_id,
        type: payload.type,
        status: "pendiente",
        scheduled_at: argDateTimeLocalToIso(payload.nextScheduledAt),
        objective: payload.nextObjective || null,
        created_by: user.id,
      });

      if (nextError) {
        throw new Error(nextError.message);
      }
    }
  } catch (error) {
    redirect(`/clients/${clientId}?error=${encodeURIComponent(toErrorMessage(error))}`);
  }

  revalidateClientViews(clientId);
  redirect(`/clients/${clientId}`);
}

export async function scheduleFollowUpAction(clientId: string, formData: FormData) {
  const { supabase, user } = await getCurrentUserContext();

  try {
    const payload = scheduleFollowUpSchema.parse({
      type: formData.get("type"),
      scheduledAt: formData.get("scheduledAt"),
      objective: formData.get("objective") || "",
    });

    const client = await getClientOwner(supabase, clientId);

    const { error } = await supabase.from("activities").insert({
      client_id: clientId,
      assigned_user_id: client.assigned_user_id,
      type: payload.type,
      status: "pendiente",
      scheduled_at: argDateTimeLocalToIso(payload.scheduledAt),
      objective: payload.objective || null,
      created_by: user.id,
    });

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    redirect(`/clients/${clientId}?error=${encodeURIComponent(toErrorMessage(error))}`);
  }

  revalidateClientViews(clientId);
  redirect(`/clients/${clientId}`);
}

function withError(target: string, message: string) {
  return `${target}${target.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`;
}

export async function completeActivityAction(
  activityId: string,
  clientId: string,
  redirectTo: string,
  formData: FormData,
) {
  const { supabase, user } = await getCurrentUserContext();

  try {
    const payload = completeActivitySchema.parse({
      outcome: formData.get("outcome"),
      nextScheduledAt: formData.get("nextScheduledAt") || "",
    });

    const { data: activity, error: activityError } = await supabase
      .from("activities")
      .select("id, type, objective, assigned_user_id")
      .eq("id", activityId)
      .single<{ id: string; type: string; objective: string | null; assigned_user_id: string }>();

    if (activityError || !activity) {
      throw new Error("Seguimiento no encontrado");
    }

    const { error } = await supabase
      .from("activities")
      .update({
        status: "realizada",
        completed_at: new Date().toISOString(),
        outcome: payload.outcome,
      })
      .eq("id", activityId);

    if (error) {
      throw new Error(error.message);
    }

    if (payload.nextScheduledAt) {
      const { error: nextError } = await supabase.from("activities").insert({
        client_id: clientId,
        assigned_user_id: activity.assigned_user_id,
        type: activity.type,
        status: "pendiente",
        scheduled_at: argDateTimeLocalToIso(payload.nextScheduledAt),
        objective: activity.objective,
        created_by: user.id,
      });

      if (nextError) {
        throw new Error(nextError.message);
      }
    }
  } catch (error) {
    redirect(withError(redirectTo, toErrorMessage(error)));
  }

  revalidateClientViews(clientId);
  redirect(redirectTo);
}

export async function rescheduleActivityAction(
  activityId: string,
  clientId: string,
  redirectTo: string,
  formData: FormData,
) {
  const { supabase } = await getCurrentUserContext();

  try {
    const payload = rescheduleActivitySchema.parse({
      scheduledAt: formData.get("scheduledAt"),
    });

    const { data: activity, error: activityError } = await supabase
      .from("activities")
      .select("id, rescheduled_count")
      .eq("id", activityId)
      .single<{ id: string; rescheduled_count: number }>();

    if (activityError || !activity) {
      throw new Error("Seguimiento no encontrado");
    }

    const { error } = await supabase
      .from("activities")
      .update({
        scheduled_at: argDateTimeLocalToIso(payload.scheduledAt),
        rescheduled_count: activity.rescheduled_count + 1,
      })
      .eq("id", activityId);

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    redirect(withError(redirectTo, toErrorMessage(error)));
  }

  revalidateClientViews(clientId);
  redirect(redirectTo);
}

export async function cancelActivityAction(activityId: string, clientId: string, redirectTo: string) {
  const { supabase } = await getCurrentUserContext();

  try {
    const { error } = await supabase
      .from("activities")
      .update({ status: "cancelada" })
      .eq("id", activityId);

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    redirect(withError(redirectTo, toErrorMessage(error)));
  }

  revalidateClientViews(clientId);
  redirect(redirectTo);
}
