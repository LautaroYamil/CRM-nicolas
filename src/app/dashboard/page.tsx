import Link from "next/link";
import clsx from "clsx";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { activityTypeLabel, clientStatusLabel } from "@/lib/crm/constants";
import {
  argGreeting,
  argTodayRange,
  formatDateTimeAr,
  formatTimeAr,
  isoDaysAgo,
} from "@/lib/crm/dates";

const DAYS_WITHOUT_CONTACT = 14;

type PendingRow = {
  id: string;
  type: string;
  scheduled_at: string;
  objective: string | null;
  assigned_user_id: string;
  clients: {
    id: string;
    first_name: string;
    last_name: string | null;
    phone_normalized: string;
  } | null;
};

const FUNNEL_STATUSES = ["nuevo", "interesado", "en_seguimiento", "compro"] as const;
const FUNNEL_SEGMENT_CLASSES = [
  "bg-primary/10 text-primary",
  "bg-primary/20 text-primary",
  "bg-primary/40 text-primary",
  "bg-green-500 text-white rounded-r-xl",
] as const;

export default async function DashboardPage() {
  const { supabase, profile } = await getCurrentUserContext();
  const { startIso, endIso } = argTodayRange();
  const staleThresholdIso = isoDaysAgo(DAYS_WITHOUT_CONTACT);
  const newClientsThresholdIso = isoDaysAgo(7);
  const nowIso = new Date().toISOString();

  const [todayRes, overdueRes, newClientsRes, staleRes, boughtRes, statusRes, pendingRes, sellersRes] =
    await Promise.all([
      supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendiente")
        .gte("scheduled_at", nowIso)
        .lt("scheduled_at", endIso),
      supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendiente")
        .lt("scheduled_at", nowIso),
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .is("archived_at", null)
        .gte("created_at", newClientsThresholdIso),
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .is("archived_at", null)
        .in("status", ["nuevo", "interesado", "en_seguimiento"])
        .or(`last_contact_at.is.null,last_contact_at.lt.${staleThresholdIso}`),
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .is("archived_at", null)
        .eq("status", "compro")
        .is("next_follow_up_at", null),
      supabase
        .from("clients")
        .select("status")
        .is("archived_at", null)
        .limit(2000)
        .returns<{ status: string }[]>(),
      supabase
        .from("activities")
        .select(
          "id, type, scheduled_at, objective, assigned_user_id, clients(id, first_name, last_name, phone_normalized)",
        )
        .eq("status", "pendiente")
        .lt("scheduled_at", endIso)
        .order("scheduled_at", { ascending: true })
        .limit(20)
        .returns<PendingRow[]>(),
      supabase.from("profiles").select("id, full_name").returns<{ id: string; full_name: string | null }[]>(),
    ]);

  const sellersById = new Map((sellersRes.data ?? []).map((seller) => [seller.id, seller.full_name ?? "Vendedor"]));

  const statusCounts = new Map<string, number>();
  for (const row of statusRes.data ?? []) {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
  }

  const kpis = [
    {
      label: "Quedan hoy",
      value: todayRes.count ?? 0,
      icon: "event_available",
      href: "/agenda",
      tone: "default" as const,
    },
    {
      label: "Vencidos",
      value: overdueRes.count ?? 0,
      icon: "warning",
      href: "/agenda",
      tone: "error" as const,
    },
    {
      label: "Nuevos (7 dias)",
      value: newClientsRes.count ?? 0,
      icon: "person_add",
      href: "/clients",
      tone: "default" as const,
    },
    {
      label: `Sin contacto ${DAYS_WITHOUT_CONTACT}+ dias`,
      value: staleRes.count ?? 0,
      icon: "history",
      href: "/clients",
      tone: "default" as const,
    },
    {
      label: "Posventa pendiente",
      value: boughtRes.count ?? 0,
      icon: "support_agent",
      href: "/clients?status=compro",
      tone: "success" as const,
    },
  ];

  const pendingRows = pendingRes.data ?? [];
  const firstName = (profile.full_name ?? "").split(/\s+/)[0] || "vendedor";

  return (
    <AppShell profile={profile} title="Panel comercial">
      <section className="mb-8">
        <h1 className="text-headline-md font-bold lg:text-headline-lg">
          {argGreeting()}, {firstName}
        </h1>
        <p className="text-body-lg text-on-surface-variant">
          {(overdueRes.count ?? 0) > 0
            ? "Tenes seguimientos vencidos. Revisalos antes de que se enfrien."
            : "Esto es lo que necesita atencion hoy."}
        </p>
      </section>

      <div className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm lg:p-8">
        {/* KPIs */}
        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:gap-6 xl:grid-cols-5">
          {kpis.map((kpi) => (
            <Link
              key={kpi.label}
              href={kpi.href}
              className={clsx(
                "flex h-28 flex-col justify-between rounded-2xl border p-4 transition-shadow hover:shadow-md lg:h-32 lg:p-6",
                kpi.tone === "error" && "border-error/20 bg-error-container/20",
                kpi.tone === "success" && "border-green-200 bg-green-50",
                kpi.tone === "default" && "border-outline-variant/30 bg-surface-container-lowest",
              )}
            >
              <p
                className={clsx(
                  "text-label-sm tracking-wider uppercase",
                  kpi.tone === "error" && "font-bold text-error",
                  kpi.tone === "success" && "font-bold text-green-700",
                  kpi.tone === "default" && "text-on-surface-variant",
                )}
              >
                {kpi.label}
              </p>
              <div className="flex items-end justify-between">
                <span
                  className={clsx(
                    "text-headline-md font-bold",
                    kpi.tone === "error" && "text-error",
                    kpi.tone === "success" && "text-green-800",
                  )}
                >
                  {kpi.value}
                </span>
                <span
                  className={clsx(
                    "material-symbols-outlined",
                    kpi.tone === "error" && "text-error",
                    kpi.tone === "success" && "text-green-600",
                    kpi.tone === "default" && "text-primary-container",
                  )}
                >
                  {kpi.icon}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* Embudo de estados */}
        <section className="mb-8 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-4 lg:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-headline-sm font-semibold">Cartera por estado</h3>
            <Link href="/clients" className="flex items-center gap-1 text-label-md font-semibold text-primary hover:underline">
              Ver clientes
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
          <div className="flex h-16 w-full items-stretch gap-1 overflow-hidden rounded-xl">
            {FUNNEL_STATUSES.map((status, index) => (
              <Link
                key={status}
                href={`/clients?status=${status}`}
                className={clsx(
                  "flex flex-1 flex-col justify-center px-3 transition-opacity hover:opacity-80",
                  FUNNEL_SEGMENT_CLASSES[index],
                )}
              >
                <span className="text-[10px] font-bold uppercase opacity-80">
                  {clientStatusLabel(status)}
                </span>
                <span className="text-body-md font-bold">{statusCounts.get(status) ?? 0}</span>
              </Link>
            ))}
          </div>
          <p className="mt-3 text-label-sm text-on-surface-variant">
            No interesados: {statusCounts.get("no_interesado") ?? 0} - Inactivos:{" "}
            {statusCounts.get("inactivo") ?? 0}
          </p>
        </section>

        {/* Seguimientos de hoy (incluye vencidos) */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-headline-sm font-semibold">Para contactar</h3>
            <Link href="/agenda" className="flex items-center gap-1 text-label-md font-semibold text-primary hover:underline">
              Ver agenda completa
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>

          {pendingRows.length === 0 ? (
            <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low/50 p-8 text-center">
              <span className="material-symbols-outlined mb-2 text-4xl text-primary-container">task_alt</span>
              <p className="font-semibold">No queda nada pendiente para hoy</p>
              <p className="text-body-md text-on-surface-variant">
                Podes programar seguimientos desde la ficha de cada cliente.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-y-2 text-left">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <th className="rounded-l-lg px-4 py-3 text-label-md font-semibold text-on-surface-variant">Cliente</th>
                    <th className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">Tipo</th>
                    <th className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">Cuando</th>
                    <th className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">Objetivo</th>
                    {profile.role === "admin" ? (
                      <th className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">Vendedor</th>
                    ) : null}
                    <th className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">Estado</th>
                    <th className="rounded-r-lg px-4 py-3 text-center text-label-md font-semibold text-on-surface-variant">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRows.map((row) => {
                    const client = row.clients;
                    const clientName = client
                      ? `${client.first_name} ${client.last_name ?? ""}`.trim()
                      : "Cliente";
                    const clientInitials = clientName
                      .split(/\s+/)
                      .map((word) => word[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();
                    const overdue = row.scheduled_at < nowIso;
                    const isToday = row.scheduled_at >= startIso;

                    return (
                      <tr key={row.id} className="group bg-surface-container-lowest transition-colors hover:bg-surface-container-low/30">
                        <td className="rounded-l-xl border-y border-l border-outline-variant/30 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-xs font-bold text-primary">
                              {clientInitials}
                            </div>
                            {client ? (
                              <Link href={`/clients/${client.id}`} className="font-bold hover:underline">
                                {clientName}
                              </Link>
                            ) : (
                              <span className="font-bold">{clientName}</span>
                            )}
                          </div>
                        </td>
                        <td className="border-y border-outline-variant/30 px-4 py-3 text-body-md">
                          {activityTypeLabel(row.type)}
                        </td>
                        <td
                          className={clsx(
                            "border-y border-outline-variant/30 px-4 py-3 font-bold",
                            overdue ? "text-error" : "text-primary",
                          )}
                        >
                          {isToday ? `Hoy, ${formatTimeAr(row.scheduled_at)}` : formatDateTimeAr(row.scheduled_at)}
                        </td>
                        <td className="max-w-56 truncate border-y border-outline-variant/30 px-4 py-3 text-body-md text-on-surface-variant">
                          {row.objective ?? "-"}
                        </td>
                        {profile.role === "admin" ? (
                          <td className="border-y border-outline-variant/30 px-4 py-3 text-body-md">
                            {sellersById.get(row.assigned_user_id) ?? "-"}
                          </td>
                        ) : null}
                        <td className="border-y border-outline-variant/30 px-4 py-3">
                          {overdue ? (
                            <span className="flex items-center gap-1.5 text-xs font-medium text-error">
                              <span className="h-2 w-2 animate-pulse rounded-full bg-error" /> Vencido
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs font-medium text-orange-600">
                              <span className="h-2 w-2 rounded-full bg-orange-600" />
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td className="rounded-r-xl border-y border-r border-outline-variant/30 px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            {client ? (
                              <>
                                <a
                                  href={`https://wa.me/${client.phone_normalized.replace(/\D+/g, "")}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Abrir WhatsApp"
                                  className="rounded-full bg-green-100 p-2 text-green-700 transition-colors hover:bg-green-200"
                                >
                                  <span className="material-symbols-outlined text-base">chat</span>
                                </a>
                                <Link
                                  href={`/clients/${client.id}`}
                                  title="Ver ficha"
                                  className="rounded-full bg-surface-container p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high"
                                >
                                  <span className="material-symbols-outlined text-base">open_in_new</span>
                                </Link>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
