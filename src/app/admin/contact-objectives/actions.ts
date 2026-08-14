"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/current-user";

function asText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function createContactObjectiveAction(formData: FormData) {
  const { supabase, profile } = await getCurrentUserContext();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const name = asText(formData.get("name"));

  if (!name) {
    redirect("/admin/contact-objectives?error=El%20nombre%20del%20objetivo%20es%20obligatorio");
  }

  // Mismo patron que interests: busqueda case-insensitive para evitar
  // duplicados y reactivar si ya existia pero estaba desactivado.
  const { data: existing } = await supabase
    .from("contact_objectives")
    .select("id, name, active")
    .ilike("name", name)
    .maybeSingle<{ id: string; name: string; active: boolean }>();

  if (existing) {
    if (existing.active) {
      redirect(
        `/admin/contact-objectives?error=${encodeURIComponent(`Ya existe un objetivo llamado "${existing.name}"`)}`,
      );
    }

    const { error: reactivateError } = await supabase
      .from("contact_objectives")
      .update({ active: true })
      .eq("id", existing.id);

    if (reactivateError) {
      redirect(`/admin/contact-objectives?error=${encodeURIComponent(reactivateError.message)}`);
    }

    revalidatePath("/admin/contact-objectives");
    redirect("/admin/contact-objectives");
  }

  const { error } = await supabase.from("contact_objectives").insert({ name, active: true });

  if (error) {
    const message =
      error.code === "23505" ? `Ya existe un objetivo llamado "${name}"` : error.message;
    redirect(`/admin/contact-objectives?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/contact-objectives");
  redirect("/admin/contact-objectives");
}

export async function toggleContactObjectiveAction(formData: FormData) {
  const { supabase, profile } = await getCurrentUserContext();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const objectiveId = asText(formData.get("objectiveId"));
  const nextActive = asText(formData.get("nextActive")) === "true";

  if (!objectiveId) {
    redirect("/admin/contact-objectives?error=Objetivo%20invalido");
  }

  const { error } = await supabase
    .from("contact_objectives")
    .update({ active: nextActive })
    .eq("id", objectiveId);

  if (error) {
    redirect(`/admin/contact-objectives?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/contact-objectives");
  redirect("/admin/contact-objectives");
}
