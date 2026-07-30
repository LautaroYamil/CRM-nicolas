"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z, ZodError } from "zod";
import { getCurrentUserContext } from "@/lib/auth/current-user";

function toErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Datos invalidos";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "No se pudo procesar la solicitud";
}

const nameSchema = z.object({
  fullName: z.string().trim().min(1, "El nombre no puede estar vacio"),
});

export async function updateProfileNameAction(formData: FormData) {
  const { supabase, user } = await getCurrentUserContext();

  try {
    const { fullName } = nameSchema.parse({ fullName: formData.get("fullName") });

    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    redirect(`/profile?error=${encodeURIComponent(toErrorMessage(error))}`);
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  redirect("/profile?success=Nombre%20actualizado");
}

const passwordSchema = z
  .object({
    password: z.string().min(6, "La contrasena tiene que tener al menos 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contrasenas no coinciden",
    path: ["confirmPassword"],
  });

export async function updatePasswordAction(formData: FormData) {
  const { supabase } = await getCurrentUserContext();

  try {
    const { password } = passwordSchema.parse({
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    });

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    redirect(`/profile?error=${encodeURIComponent(toErrorMessage(error))}`);
  }

  redirect("/profile?success=Contrasena%20actualizada");
}
