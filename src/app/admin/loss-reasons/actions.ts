"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/current-user";

function asText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function createLossReasonAction(formData: FormData) {
  const { supabase, profile } = await getCurrentUserContext();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const name = asText(formData.get("name"));

  if (!name) {
    redirect("/admin/loss-reasons?error=El%20nombre%20del%20motivo%20es%20obligatorio");
  }

  const { data: existing } = await supabase
    .from("loss_reasons")
    .select("id, name, active")
    .ilike("name", name)
    .maybeSingle<{ id: string; name: string; active: boolean }>();

  if (existing) {
    if (existing.active) {
      redirect(
        `/admin/loss-reasons?error=${encodeURIComponent(`Ya existe un motivo llamado "${existing.name}"`)}`,
      );
    }

    const { error: reactivateError } = await supabase
      .from("loss_reasons")
      .update({ active: true })
      .eq("id", existing.id);

    if (reactivateError) {
      redirect(`/admin/loss-reasons?error=${encodeURIComponent(reactivateError.message)}`);
    }

    revalidatePath("/admin/loss-reasons");
    redirect("/admin/loss-reasons");
  }

  const { error } = await supabase.from("loss_reasons").insert({ name, active: true });

  if (error) {
    const message = error.code === "23505" ? `Ya existe un motivo llamado "${name}"` : error.message;
    redirect(`/admin/loss-reasons?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/loss-reasons");
  redirect("/admin/loss-reasons");
}

export async function toggleLossReasonAction(formData: FormData) {
  const { supabase, profile } = await getCurrentUserContext();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const reasonId = asText(formData.get("reasonId"));
  const nextActive = asText(formData.get("nextActive")) === "true";

  if (!reasonId) {
    redirect("/admin/loss-reasons?error=Motivo%20invalido");
  }

  const { error } = await supabase.from("loss_reasons").update({ active: nextActive }).eq("id", reasonId);

  if (error) {
    redirect(`/admin/loss-reasons?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/loss-reasons");
  redirect("/admin/loss-reasons");
}
