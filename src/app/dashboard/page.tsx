import Link from "next/link";
import clsx from "clsx";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { activityTypeLabel, clientStatusLabel } from "@/lib/crm/constants";
import {
  argGreeting,
  argTodayRange,
  formatDateTimeAr,
  formatRelativeAr,
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
    status: string;
  } | null;
};

const CHANNEL_ICONS: Record<string, string> = {
  llamada: "call",
  whatsapp: "chat",
  email: "mail",
  visita: "storefront",
  reunion: "groups",
  nota: "sticky_note_2",
};

const FUNNEL_SEGMENTS = [
  { status: "nuevo", barClass: "bg-primary/80" },
  { status: "interesado", barClass: "bg-surface-dim" },
  { status: "en_seguimiento", barClass: "bg-outline-variant" },
  { status: "compro", barClass: "bg-green-600/80" },
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
          "id, type, scheduled_at, objective, assigned_user_id, clients(id, first_name, last_name, phone_normalized, status)",
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
  const funnelTotal = FUNNEL_SEGMENTS.reduce(
    (sum, segment) => sum + (statusCounts.get(segment.status) ?? 0),
    0,
  );

  const overdueCount = overdueRes.count ?? 0;

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
      value: overdueCount,
      icon: "warning_amber",
      href: "/agenda",
      tone: "error" as const,
    },
    {
      label: "Nuevos (7d)",
      value: newClientsRes.count ?? 0,
      icon: "person_add",
      href: "/clients",
      tone: "default" as const,
    },
    {
      label: `Inactivos ${DAYS_WITHOUT_CONTACT}d+`,
      value: staleRes.count ?? 0,
      icon: "history",
      href: "/clients",
      tone: "default" as const,
    },
    {
      label: "Posventa",
      value: boughtRes.count ?? 0,
      icon: "support_agent",
      href: "/clients?status=compro",
      tone: "success" as const,
    },
  ];

  const pendingRows = pendingRes.data ?? [];
  const firstName = (profile.full_name ?? "").split(/\s+/)[0] || "vendedor";

  return (
    <AppShell profile={profile} title="Panel Comercial">
      <div className="space-y-10">
        {/* Saludo */}
        <section className="space-y-2">
          <h1 className="text-headline-md font-bold tracking-tight text-on-surface lg:text-headline-xl">
            {argGreeting()}, {firstName}
          </h1>
          <div className="flex items-center gap-2 font-medium text-on-surface-variant">
            {overdueCount > 0 ? (
              <>
                <span className="h-2 w-2 animate-pulse rounded-full bg-error" />
                <p>Tenes seguimientos vencidos. Revisalos antes de que se enfrien.</p>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-green-600" />
                <p>Todo al dia. Esto es lo que viene.</p>
              </>
            )}
          </div>
        </section>

        {/* KPIs */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {kpis.map((kpi) => (
            <Link
              key={kpi.label}
              href={kpi.href}
              className={clsx(
                "card-premium flex h-36 flex-col justify-between rounded-xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-md lg:h-40 lg:p-6",
                kpi.tone === "error" && "border-error/20 bg-error-container/10",
                kpi.tone === "success" && "border-green-500/10",
              )}
            >
              <p
                className={clsx(
                  "text-[10px] font-bold tracking-[0.2em] uppercase",
                  kpi.tone === "error" && "text-error",
                  kpi.tone === "success" && "text-green-700",
                  kpi.tone === "default" && "text-on-surface-variant",
                )}
              >
                {kpi.label}
              </p>
              <div>
                <p
                  className={clsx(
                    "text-5xl",
                    kpi.tone === "error" ? "font-bold text-error" : "font-light",
                    kpi.tone === "success" && "text-green-700",
                    kpi.tone === "default" && "text-on-surface",
                  )}
                >
                  {kpi.value}
                </p>
                <div
                  className={clsx(
                    "indicator-accent",
                    kpi.tone === "error" && "bg-error",
                    kpi.tone === "success" && "bg-green-500",
                    kpi.tone === "default" && "bg-primary",
                  )}
                />
              </div>
              <span
                className={clsx(
                  "material-symbols-outlined absolute top-4 right-4 text-4xl opacity-10",
                  kpi.tone === "error" && "text-error",
                  kpi.tone === "success" && "text-green-700",
                  kpi.tone === "default" && "text-primary",
                )}
              >
                {kpi.icon}
              </span>
            </Link>
          ))}
        </section>

        {/* Estado de cartera */}
        <section className="card-premium rounded-xl p-6 lg:p-8">
          <div className="mb-8 flex items-end justify-between">
            <h3 className="text-xl font-semibold text-on-surface">Estado de Cartera</h3>
            <Link
              href="/clients"
              className="flex items-center gap-2 text-xs font-bold tracking-widest text-primary uppercase hover:opacity-70"
            >
              Ver detalle <span className="material-symbols-outlined text-[16px]">north_east</span>
            </Link>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-container-highest">
            {FUNNEL_SEGMENTS.map((segment) => {
              const count = statusCounts.get(segment.status) ?? 0;
              const width = funnelTotal > 0 ? Math.max(count > 0 ? 4 : 0, (count / funnelTotal) * 100) : 25;

              return (
                <div
                  key={segment.status}
                  className={clsx("border-l border-white/20 transition-all first:border-l-0", segment.barClass)}
                  style={{ width: `${width}%` }}
                />
              );
            })}
          </div>
          <div className="mt-6 grid grid-cols-4 text-center">
            {FUNNEL_SEGMENTS.map((segment) => (
              <Link key={segment.status} href={`/clients?status=${segment.status}`} className="space-y-1 hover:opacity-70">
                <p className="text-[10px] font-bold tracking-wider text-on-surface-variant/80 uppercase">
                  {segment.status === "en_seguimiento" ? "Seguimiento" : clientStatusLabel(segment.status)}
                </p>
                <p
                  className={clsx(
                    "text-lg font-bold",
                    segment.status === "compro" ? "text-green-700" : "text-on-surface",
                  )}
                >
                  {statusCounts.get(segment.status) ?? 0}
                </p>
              </Link>
            ))}
          </div>
          <p className="mt-4 text-center text-label-sm text-on-surface-variant/70">
            No interesados: {statusCounts.get("no_interesado") ?? 0} - Inactivos:{" "}
            {statusCounts.get("inactivo") ?? 0}
          </p>
        </section>

        {/* Agenda de contactos */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-semibold text-on-surface">Agenda de Contactos</h3>
            <Link
              href="/agenda"
              className="flex items-center gap-2 text-xs font-bold tracking-widest text-primary uppercase hover:underline"
            >
              Agenda completa <span className="material-symbols-outlined text-[16px]">calendar_month</span>
            </Link>
          </div>

          {pendingRows.length === 0 ? (
            <div className="card-premium rounded-xl p-10 text-center">
              <span className="material-symbols-outlined mb-2 text-4xl text-on-surface-variant/40">task_alt</span>
              <p className="font-bold">No queda nada pendiente para hoy</p>
              <p className="text-body-md text-on-surface-variant">
                Podes programar seguimientos desde la ficha de cada cliente.
              </p>
            </div>
          ) : (
            <>
            {/* Tarjetas (celular) */}
            <ul className="space-y-3 lg:hidden">
              {pendingRows.map((row) => {
                const client = row.clients;
                const clientName = client ? `${client.first_name} ${client.last_name ?? ""}`.trim() : "Cliente";
                const overdue = row.scheduled_at < nowIso;
                const isToday = row.scheduled_at >= startIso;

                return (
                  <li key={row.id} className="card-premium rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {client ? (
                          <Link href={`/clients/${client.id}`} className="block truncate font-bold">
                            {clientName}
                          </Link>
                        ) : (
                          <p className="truncate font-bold">{clientName}</p>
                        )}
                        <p
                          className={clsx(
                            "mt-0.5 text-sm font-bold",
                            overdue ? "text-error" : "text-on-surface",
                          )}
                        >
                          {isToday ? `Hoy, ${formatTimeAr(row.scheduled_at)}` : formatDateTimeAr(row.scheduled_at)}
                          {overdue ? (
                            <span className="ml-1 text-[10px] uppercase"> - {formatRelativeAr(row.scheduled_at)}</span>
                          ) : null}
                        </p>
                      </div>
                      <span
                        className={clsx(
                          "shrink-0 rounded border px-2 py-1 text-[10px] font-bold tracking-wider uppercase",
                          overdue
                            ? "border-error/20 bg-error-container/20 text-error"
                            : "border-outline-variant/40 bg-surface-container text-on-surface-variant",
                        )}
                      >
                        {activityTypeLabel(row.type)}
                      </span>
                    </div>
                    {row.objective ? (
                      <p className="mt-2 text-sm text-on-surface-variant italic">&quot;{row.objective}&quot;</p>
                    ) : null}
                    {client ? (
                      <div className="mt-3 flex gap-2">
                        <a
                          href={`https://wa.me/${client.phone_normalized.replace(/\D+/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-700 py-2 text-xs font-bold tracking-wider text-white uppercase"
                        >
                          <span className="material-symbols-outlined text-[18px]">chat</span>
                          WhatsApp
                        </a>
                        <Link
                          href={`/clients/${client.id}`}
                          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-outline-variant/40 py-2 text-xs font-bold tracking-wider uppercase"
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                          Ficha
                        </Link>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            {/* Tabla (desktop) */}
            <div className="hidden overflow-x-auto border-t border-outline-variant/30 lg:block">
              <table className="w-full min-w-[860px]">
                <thead>
                  <tr className="text-left text-[10px] font-bold tracking-[0.2em] text-on-surface-variant/60 uppercase">
                    <th className="py-5 pr-4">Cliente</th>
                    <th className="px-4 py-5">Canal</th>
                    <th className="px-4 py-5">Programado</th>
                    <th className="px-4 py-5">Objetivo de contacto</th>
                    {profile.role === "admin" ? <th className="px-4 py-5">Asignado</th> : null}
                    <th className="px-4 py-5">Prioridad</th>
                    <th className="py-5 pl-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
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
                    const isWhatsapp = row.type === "whatsapp";

                    return (
                      <tr key={row.id} className="group transition-colors hover:bg-surface-container-low">
                        <td className="py-6 pr-4">
                          <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-primary-container/10 font-bold text-primary">
                              {clientInitials}
                            </div>
                            <div className="min-w-0">
                              {client ? (
                                <Link
                                  href={`/clients/${client.id}`}
                                  className="block truncate text-base font-bold text-on-surface transition-colors group-hover:text-primary hover:underline"
                                >
                                  {clientName}
                                </Link>
                              ) : (
                                <p className="truncate text-base font-bold">{clientName}</p>
                              )}
                              {client ? (
                                <p className="text-xs text-on-surface-variant/70">
                                  {clientStatusLabel(client.status)}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-6">
                          <div
                            className={clsx(
                              "flex items-center gap-2 text-sm font-medium",
                              isWhatsapp ? "text-green-700" : "text-on-surface-variant",
                            )}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {CHANNEL_ICONS[row.type] ?? "event"}
                            </span>
                            {activityTypeLabel(row.type)}
                          </div>
                        </td>
                        <td className="px-4 py-6">
                          {overdue ? (
                            <>
                              <p className="text-sm font-bold text-error">{formatDateTimeAr(row.scheduled_at)}</p>
                              <p className="text-[10px] font-bold text-error/80 uppercase">
                                {formatRelativeAr(row.scheduled_at)}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm font-bold text-on-surface">
                              {isToday ? `Hoy, ${formatTimeAr(row.scheduled_at)}` : formatDateTimeAr(row.scheduled_at)}
                            </p>
                          )}
                        </td>
                        <td className="max-w-xs px-4 py-6">
                          <p className="truncate text-sm leading-relaxed text-on-surface-variant/90 italic">
                            {row.objective ? `"${row.objective}"` : "-"}
                          </p>
                        </td>
                        {profile.role === "admin" ? (
                          <td className="px-4 py-6">
                            <span className="text-sm font-semibold text-on-surface">
                              {sellersById.get(row.assigned_user_id) ?? "-"}
                            </span>
                          </td>
                        ) : null}
                        <td className="px-4 py-6">
                          {overdue ? (
                            <span className="rounded border border-error/20 bg-error-container/20 px-2 py-1 text-[10px] font-bold tracking-wider text-error uppercase">
                              Alta
                            </span>
                          ) : (
                            <span className="rounded border border-outline-variant/40 bg-surface-container px-2 py-1 text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                              Normal
                            </span>
                          )}
                        </td>
                        <td className="py-6 pl-4 text-right">
                          <div className="flex justify-end gap-3 opacity-60 transition-opacity group-hover:opacity-100">
                            {client ? (
                              <>
                                <a
                                  href={`https://wa.me/${client.phone_normalized.replace(/\D+/g, "")}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Abrir WhatsApp"
                                  className="p-2 transition-colors hover:text-green-700"
                                >
                                  <span className="material-symbols-outlined">send</span>
                                </a>
                                <Link
                                  href={`/clients/${client.id}`}
                                  title="Ver ficha"
                                  className="p-2 transition-colors hover:text-primary"
                                >
                                  <span className="material-symbols-outlined">visibility</span>
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
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
