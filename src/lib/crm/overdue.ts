// Unica fuente de verdad de "vencido" en todo el sistema: una actividad pendiente
// cuya hora ya paso. No se persiste como columna; se deriva siempre en el momento
// de la consulta contra scheduled_at (timestamptz UTC) vs. "ahora".
//
// Dashboard, Agenda, Ficha, Directorio y Reportes deben usar isOverdue() para pintar
// filas, y countOverdueActivities()/overdueActivitiesQuery() para contar/listar
// vencidos, en vez de reimplementar la comparacion o la query a mano.

import type { getCurrentUserContext } from "@/lib/auth/current-user";

type SupabaseClientLike = Awaited<ReturnType<typeof getCurrentUserContext>>["supabase"];

/** true si una actividad pendiente con esta fecha ya venció respecto de `nowIso`. */
export function isOverdue(scheduledAtIso: string, nowIso: string): boolean {
  return scheduledAtIso < nowIso;
}

type OverdueScope = {
  /** Si se pasa, limita el conteo/listado a este vendedor (uso admin, ej. filtro de Agenda). */
  assignedUserId?: string;
};

/**
 * Conteo real de vencidos (COUNT en SQL, sin traer filas). RLS del cliente
 * autenticado sigue aplicando siempre: no usa service_role ni evita el scope
 * vendedor/admin.
 */
export async function countOverdueActivities(
  supabase: SupabaseClientLike,
  nowIso: string,
  scope?: OverdueScope,
): Promise<number> {
  let query = supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("status", "pendiente")
    .lt("scheduled_at", nowIso);

  if (scope?.assignedUserId) {
    query = query.eq("assigned_user_id", scope.assignedUserId);
  }

  const { count } = await query;
  return count ?? 0;
}

/** Lista de vencidos, mas antiguos primero, con tope para paginacion real ("mostrar mas"). */
export function overdueActivitiesQuery(
  supabase: SupabaseClientLike,
  nowIso: string,
  columns: string,
  options: { limit: number; scope?: OverdueScope },
) {
  let query = supabase
    .from("activities")
    .select(columns)
    .eq("status", "pendiente")
    .lt("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(options.limit);

  if (options.scope?.assignedUserId) {
    query = query.eq("assigned_user_id", options.scope.assignedUserId);
  }

  return query;
}
