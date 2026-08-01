import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la service role key: ignora RLS por completo.
 * Solo usar en server actions ya validadas para role === "admin",
 * y solo para operaciones que la API de Auth no expone via RLS (invitar usuarios).
 */
export function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor");
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
