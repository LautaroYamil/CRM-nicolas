"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { inviteSellerSchema } from "@/lib/crm/validation";
import { isValidRole } from "@/lib/auth/roles";

function toErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Datos invalidos";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "No se pudo procesar la solicitud";
}

async function requireAdmin() {
  const context = await getCurrentUserContext();

  if (context.profile.role !== "admin") {
    redirect("/dashboard");
  }

  return context;
}

export async function inviteSellerAction(formData: FormData) {
  await requireAdmin();

  try {
    const payload = inviteSellerSchema.parse({
      email: formData.get("email"),
      fullName: formData.get("fullName"),
    });

    const admin = getSupabaseAdminClient();
    const { error } = await admin.auth.admin.inviteUserByEmail(payload.email, {
      data: { full_name: payload.fullName },
    });

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    redirect(`/admin/users?error=${encodeURIComponent(toErrorMessage(error))}`);
  }

  revalidatePath("/admin/users");
  redirect("/admin/users?success=Invitacion%20enviada");
}

export async function updateUserRoleAction(formData: FormData) {
  const { supabase, profile } = await requireAdmin();

  try {
    const userId = String(formData.get("userId") ?? "").trim();
    const nextRole = String(formData.get("nextRole") ?? "").trim();

    if (!userId || !isValidRole(nextRole)) {
      throw new Error("Datos invalidos");
    }

    if (userId === profile.id) {
      throw new Error("No podes cambiar tu propio rol");
    }

    const { error } = await supabase.from("profiles").update({ role: nextRole }).eq("id", userId);

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    redirect(`/admin/users?error=${encodeURIComponent(toErrorMessage(error))}`);
  }

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function toggleUserActiveAction(formData: FormData) {
  const { supabase, profile } = await requireAdmin();

  try {
    const userId = String(formData.get("userId") ?? "").trim();
    const nextActive = String(formData.get("nextActive") ?? "") === "true";

    if (!userId) {
      throw new Error("Usuario invalido");
    }

    if (userId === profile.id) {
      throw new Error("No podes desactivar tu propia cuenta");
    }

    const { error } = await supabase.from("profiles").update({ active: nextActive }).eq("id", userId);

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    redirect(`/admin/users?error=${encodeURIComponent(toErrorMessage(error))}`);
  }

  revalidatePath("/admin/users");
  redirect("/admin/users");
}
