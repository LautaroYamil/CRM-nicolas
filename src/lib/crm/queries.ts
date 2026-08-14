// Agregaciones compartidas que antes se resolvian trayendo filas a Next.js y
// contando en JavaScript con un limite duro (2000/5000), lo que podia subcontar
// en silencio si la cartera crecia mas alla del limite. Se reemplazan por COUNT
// real en Postgres: N queries chicas (una por estado/vendedor/interes), en vez
// de 1 query gigante + reduce en memoria. RLS del cliente autenticado sigue
// aplicando siempre.

import { CLIENT_STATUS_OPTIONS } from "@/lib/crm/constants";
import type { getCurrentUserContext } from "@/lib/auth/current-user";

type SupabaseClientLike = Awaited<ReturnType<typeof getCurrentUserContext>>["supabase"];

export type ClientStatusCounts = {
  /** estado -> cantidad de clientes activos (no archivados) en ese estado */
  counts: Map<string, number>;
  total: number;
};

/**
 * Cuenta clientes no archivados por estado comercial. Reemplaza el patron
 * `.select("status").limit(2000)` + Map en JS usado antes en Dashboard y
 * Directorio (misma agregacion, duplicada en dos archivos).
 */
export async function getClientStatusCounts(
  supabase: SupabaseClientLike,
  scope?: { assignedUserId?: string },
): Promise<ClientStatusCounts> {
  const entries = await Promise.all(
    CLIENT_STATUS_OPTIONS.map(async (option) => {
      let query = supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .is("archived_at", null)
        .eq("status", option.value);

      if (scope?.assignedUserId) {
        query = query.eq("assigned_user_id", scope.assignedUserId);
      }

      const { count } = await query;
      return [option.value, count ?? 0] as const;
    }),
  );

  const counts = new Map(entries);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  return { counts, total };
}
