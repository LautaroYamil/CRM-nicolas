import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { formatDateTimeAr } from "@/lib/crm/dates";

const ACTION_LABELS: Record<string, string> = {
  reasignar_cartera: "Reasigno cartera",
  cambiar_rol: "Cambio de rol",
  activar_usuario: "Activo usuario",
  desactivar_usuario: "Desactivo usuario",
};

const ACTION_ICONS: Record<string, string> = {
  reasignar_cartera: "swap_horiz",
  cambiar_rol: "admin_panel_settings",
  activar_usuario: "check_circle",
  desactivar_usuario: "block",
};

type AuditLogRow = {
  id: string;
  actor_id: string;
  action: string;
  detail: string | null;
  created_at: string;
};

export default async function AuditLogAdminPage() {
  const { supabase, profile } = await getCurrentUserContext();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const [{ data: logs, error }, { data: actors }] = await Promise.all([
    supabase
      .from("admin_audit_log")
      .select("id, actor_id, action, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<AuditLogRow[]>(),
    supabase.from("profiles").select("id, full_name").returns<{ id: string; full_name: string | null }[]>(),
  ]);

  if (error) {
    return (
      <AppShell profile={profile} title="Auditoria">
        <p className="text-error">Error al cargar el historial: {error.message}</p>
      </AppShell>
    );
  }

  const actorsById = new Map((actors ?? []).map((row) => [row.id, row.full_name ?? "Usuario"]));

  return (
    <AppShell profile={profile} title="Auditoria">
      <div className="mx-auto max-w-3xl">
        <section className="mb-6">
          <h1 className="text-headline-md font-bold lg:text-headline-lg">Actividad administrativa</h1>
          <p className="text-body-lg text-on-surface-variant">
            Reasignaciones de cartera, cambios de rol y activaciones/desactivaciones de vendedores. Los
            ultimos 200 eventos.
          </p>
        </section>

        <section className="card-premium rounded-xl p-5 lg:p-6">
          {(logs ?? []).length === 0 ? (
            <p className="text-body-md text-on-surface-variant">Todavia no hay eventos registrados.</p>
          ) : (
            <ul className="space-y-2">
              {(logs ?? []).map((log) => (
                <li
                  key={log.id}
                  className="flex flex-wrap items-start gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-low/50 px-4 py-3"
                >
                  <span className="material-symbols-outlined rounded bg-primary-container/10 p-1.5 text-primary">
                    {ACTION_ICONS[log.action] ?? "history"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{ACTION_LABELS[log.action] ?? log.action}</p>
                    {log.detail ? <p className="text-body-md text-on-surface-variant">{log.detail}</p> : null}
                    <p className="text-label-sm text-on-surface-variant/70">
                      {actorsById.get(log.actor_id) ?? "Usuario"} - {formatDateTimeAr(log.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
