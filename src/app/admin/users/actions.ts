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

/**
 * Solo 3 eventos se auditan (reasignar cartera, cambiar rol, activar/
 * desactivar) -no un log generico de cada campo editado. "detail" ya viene
 * armado en texto legible al momento de escribir, para que la pantalla de
 * lectura no necesite resolver nada.
 */
async function logAdminAction(
  supabase: Awaited<ReturnType<typeof getCurrentUserContext>>["supabase"],
  actorId: string,
  action: string,
  targetId: string | null,
  detail: string,
) {
  await supabase.from("admin_audit_log").insert({ actor_id: actorId, action, target_id: targetId, detail });
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

    const { data: target } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle<{ full_name: string | null }>();

    const { error } = await supabase.from("profiles").update({ role: nextRole }).eq("id", userId);

    if (error) {
      throw new Error(error.message);
    }

    await logAdminAction(
      supabase,
      profile.id,
      "cambiar_rol",
      userId,
      `${target?.full_name ?? "Usuario"}: nuevo rol ${nextRole === "admin" ? "Administrador" : "Vendedor"}`,
    );
  } catch (error) {
    redirect(`/admin/users?error=${encodeURIComponent(toErrorMessage(error))}`);
  }

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

/**
 * Reasigna toda la cartera ACTIVA (no archivada) de un vendedor a otro.
 * No toca clientes archivados (estan en la Papelera, independiente de quien
 * figure como asignado) ni borra nada -es un UPDATE masivo de
 * assigned_user_id, el mismo campo que ya cambia una edicion manual de
 * cliente. RLS lo permite porque quien lo ejecuta es admin (WITH CHECK de
 * clients_update_owner_or_admin no restringe assigned_user_id para admins).
 */
export async function reassignClientsAction(formData: FormData) {
  const { supabase, profile } = await requireAdmin();

  try {
    const fromUserId = String(formData.get("fromUserId") ?? "").trim();
    const toUserId = String(formData.get("toUserId") ?? "").trim();

    if (!fromUserId || !toUserId) {
      throw new Error("Elegi a quien reasignar la cartera");
    }

    if (fromUserId === toUserId) {
      throw new Error("Elegi un vendedor distinto al actual para reasignar");
    }

    const { data: involved } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", [fromUserId, toUserId])
      .returns<{ id: string; full_name: string | null }[]>();

    const fromName = involved?.find((row) => row.id === fromUserId)?.full_name ?? "Vendedor";
    const toName = involved?.find((row) => row.id === toUserId)?.full_name ?? "Vendedor";

    const { error, count } = await supabase
      .from("clients")
      .update({ assigned_user_id: toUserId }, { count: "exact" })
      .eq("assigned_user_id", fromUserId)
      .is("archived_at", null);

    if (error) {
      throw new Error(error.message);
    }

    await logAdminAction(
      supabase,
      profile.id,
      "reasignar_cartera",
      fromUserId,
      `${count ?? 0} clientes de ${fromName} a ${toName}`,
    );
  } catch (error) {
    redirect(`/admin/users?error=${encodeURIComponent(toErrorMessage(error))}`);
  }

  revalidatePath("/admin/users");
  revalidatePath("/clients");
  revalidatePath("/dashboard");
  revalidatePath("/agenda");
  redirect("/admin/users?success=Cartera%20reasignada");
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

    const { data: target } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle<{ full_name: string | null }>();

    const { error } = await supabase.from("profiles").update({ active: nextActive }).eq("id", userId);

    if (error) {
      throw new Error(error.message);
    }

    await logAdminAction(
      supabase,
      profile.id,
      nextActive ? "activar_usuario" : "desactivar_usuario",
      userId,
      `${target?.full_name ?? "Usuario"}: ${nextActive ? "activado" : "desactivado"}`,
    );
  } catch (error) {
    redirect(`/admin/users?error=${encodeURIComponent(toErrorMessage(error))}`);
  }

  revalidatePath("/admin/users");
  redirect("/admin/users");
}
