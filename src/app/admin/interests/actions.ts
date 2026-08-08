"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/current-user";

function asText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function createInterestAction(formData: FormData) {
  const { supabase, profile } = await getCurrentUserContext();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const name = asText(formData.get("name"));

  if (!name) {
    redirect("/admin/interests?error=El%20nombre%20del%20interes%20es%20obligatorio");
  }

  // Busqueda case-insensitive: evita duplicados tipo "Sillones" / "sillones",
  // y detecta si ya existe pero esta desactivado (oculto en la seccion colapsada).
  const { data: existing } = await supabase
    .from("interests")
    .select("id, name, active")
    .ilike("name", name)
    .maybeSingle<{ id: string; name: string; active: boolean }>();

  if (existing) {
    if (existing.active) {
      redirect(
        `/admin/interests?error=${encodeURIComponent(`Ya existe un interes llamado "${existing.name}"`)}`,
      );
    }

    const { error: reactivateError } = await supabase
      .from("interests")
      .update({ active: true })
      .eq("id", existing.id);

    if (reactivateError) {
      redirect(`/admin/interests?error=${encodeURIComponent(reactivateError.message)}`);
    }

    revalidatePath("/admin/interests");
    redirect("/admin/interests");
  }

  const { error } = await supabase.from("interests").insert({ name, active: true });

  if (error) {
    const message =
      error.code === "23505" ? `Ya existe un interes llamado "${name}"` : error.message;
    redirect(`/admin/interests?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin/interests");
  redirect("/admin/interests");
}

export async function toggleInterestAction(formData: FormData) {
  const { supabase, profile } = await getCurrentUserContext();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const interestId = asText(formData.get("interestId"));
  const nextActive = asText(formData.get("nextActive")) === "true";

  if (!interestId) {
    redirect("/admin/interests?error=Interes%20invalido");
  }

  const { error } = await supabase
    .from("interests")
    .update({ active: nextActive })
    .eq("id", interestId);

  if (error) {
    redirect(`/admin/interests?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/interests");
  redirect("/admin/interests");
}
