import Link from "next/link";
import clsx from "clsx";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { isoDaysAgo } from "@/lib/crm/dates";

const PERIOD_OPTIONS = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
] as const;

type ReportsPageProps = {
  searchParams: Promise<{ days?: string }>;
};

type NewClientRow = { id: string; assigned_user_id: string };
type DoneActivityRow = { assigned_user_id: string };
type PendingActivityRow = { assigned_user_id: string; scheduled_at: string };
type SaleRow = { created_at: string; clients: { assigned_user_id: string } | null };
type InterestUsageRow = { interests: { name: string } | null };

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const { supabase, profile } = await getCurrentUserContext();

  const days = PERIOD_OPTIONS.some((option) => option.days === Number(params.days))
    ? Number(params.days)
    : 30;
  const sinceIso = isoDaysAgo(days);
  const nowIso = new Date().toISOString();

  const [newClientsRes, doneRes, pendingRes, salesRes, interestsRes, sellersRes] = await Promise.all([
    supabase
      .from("clients")
      .select("id, assigned_user_id")
      .is("archived_at", null)
      .gte("created_at", sinceIso)
      .limit(5000)
      .returns<NewClientRow[]>(),
    supabase
      .from("activities")
      .select("assigned_user_id")
      .eq("status", "realizada")
      .gte("completed_at", sinceIso)
      .limit(5000)
      .returns<DoneActivityRow[]>(),
    supabase
      .from("activities")
      .select("assigned_user_id, scheduled_at")
      .eq("status", "pendiente")
      .limit(5000)
      .returns<PendingActivityRow[]>(),
    supabase
      .from("client_status_changes")
      .select("created_at, clients(assigned_user_id)")
      .eq("new_status", "compro")
      .gte("created_at", sinceIso)
      .limit(5000)
      .returns<SaleRow[]>(),
    supabase
      .from("client_interests")
      .select("interests(name)")
      .limit(5000)
      .returns<InterestUsageRow[]>(),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("active", true)
      .returns<{ id: string; full_name: string | null }[]>(),
  ]);

  const newClients = newClientsRes.data ?? [];
  const doneActivities = doneRes.data ?? [];
  const pendingActivities = pendingRes.data ?? [];
  const sales = salesRes.data ?? [];
  const overdueActivities = pendingActivities.filter((row) => row.scheduled_at < nowIso);

  const conversion = newClients.length > 0 ? Math.round((sales.length / newClients.length) * 100) : null;

  const interestCounts = new Map<string, number>();
  for (const row of interestsRes.data ?? []) {
    const name = row.interests?.name;
    if (name) {
      interestCounts.set(name, (interestCounts.get(name) ?? 0) + 1);
    }
  }
  const sortedInterests = [...interestCounts.entries()].sort((a, b) => b[1] - a[1]);
  const maxInterestCount = sortedInterests[0]?.[1] ?? 1;

  const sellers = sellersRes.data ?? [];
  const perSeller = sellers
    .map((seller) => ({
      name: seller.full_name ?? "Vendedor",
      newClients: newClients.filter((row) => row.assigned_user_id === seller.id).length,
      done: doneActivities.filter((row) => row.assigned_user_id === seller.id).length,
      sales: sales.filter((row) => row.clients?.assigned_user_id === seller.id).length,
      pending: pendingActivities.filter((row) => row.assigned_user_id === seller.id).length,
      overdue: overdueActivities.filter((row) => row.assigned_user_id === seller.id).length,
    }))
    .filter((row) => row.newClients + row.done + row.sales + row.pending > 0)
    .sort((a, b) => b.sales - a.sales || b.done - a.done);

  const kpis = [
    { label: "Clientes nuevos", value: newClients.length, icon: "person_add" },
    { label: "Contactos realizados", value: doneActivities.length, icon: "task_alt" },
    { label: "Ventas", value: sales.length, icon: "sell" },
    {
      label: "Conversion nuevo a venta",
      value: conversion === null ? "-" : `${conversion}%`,
      icon: "trending_up",
    },
  ];

  return (
    <AppShell profile={profile} title="Reportes">
      <section className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-headline-md font-bold lg:text-headline-lg">Reportes</h1>
          <p className="text-body-lg text-on-surface-variant">
            {profile.role === "admin"
              ? "Como viene el equipo en el periodo elegido."
              : "Como venis en el periodo elegido."}
          </p>
        </div>
        <div className="flex gap-2">
          {PERIOD_OPTIONS.map((option) => (
            <Link
              key={option.days}
              href={`/reports?days=${option.days}`}
              className={clsx(
                "rounded-full px-4 py-2 text-label-md font-semibold transition-colors",
                days === option.days
                  ? "bg-primary-fixed text-primary"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high",
              )}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </section>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-6">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="flex h-28 flex-col justify-between rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm lg:h-32 lg:p-6"
            >
              <p className="text-label-sm tracking-wider text-on-surface-variant uppercase">{kpi.label}</p>
              <div className="flex items-end justify-between">
                <span className="text-headline-md font-bold">{kpi.value}</span>
                <span className="material-symbols-outlined text-primary-container">{kpi.icon}</span>
              </div>
            </div>
          ))}
        </div>

        {profile.role === "admin" && perSeller.length > 0 ? (
          <section className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm lg:p-6">
            <h2 className="mb-4 text-headline-sm font-bold">Por vendedor</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-y-2 text-left">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <th className="rounded-l-lg px-4 py-3 text-label-md font-semibold text-on-surface-variant">Vendedor</th>
                    <th className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">Clientes nuevos</th>
                    <th className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">Contactos</th>
                    <th className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">Ventas</th>
                    <th className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">Pendientes</th>
                    <th className="rounded-r-lg px-4 py-3 text-label-md font-semibold text-on-surface-variant">Vencidos</th>
                  </tr>
                </thead>
                <tbody>
                  {perSeller.map((row) => (
                    <tr key={row.name} className="bg-surface-container-lowest">
                      <td className="rounded-l-xl border-y border-l border-outline-variant/30 px-4 py-3 font-bold">
                        {row.name}
                      </td>
                      <td className="border-y border-outline-variant/30 px-4 py-3">{row.newClients}</td>
                      <td className="border-y border-outline-variant/30 px-4 py-3">{row.done}</td>
                      <td className="border-y border-outline-variant/30 px-4 py-3 font-bold text-green-700">
                        {row.sales}
                      </td>
                      <td className="border-y border-outline-variant/30 px-4 py-3">{row.pending}</td>
                      <td
                        className={clsx(
                          "rounded-r-xl border-y border-r border-outline-variant/30 px-4 py-3",
                          row.overdue > 0 && "font-bold text-error",
                        )}
                      >
                        {row.overdue}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-label-sm text-on-surface-variant">
              Ventas: clientes que pasaron a estado Compro en el periodo. Pendientes y vencidos son al dia de hoy.
            </p>
          </section>
        ) : null}

        <section className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm lg:p-6">
          <h2 className="mb-1 text-headline-sm font-bold">Clientes por interes</h2>
          <p className="mb-4 text-body-md text-on-surface-variant">
            Que busca tu cartera completa. Util para decidir promos y reposicion.
          </p>
          {sortedInterests.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">
              Todavia no hay intereses cargados en los clientes. Marcarlos en cada ficha hace que este
              reporte sirva.
            </p>
          ) : (
            <ul className="space-y-3">
              {sortedInterests.map(([name, count]) => (
                <li key={name}>
                  <div className="mb-1 flex items-center justify-between text-body-md">
                    <span className="font-semibold">{name}</span>
                    <span className="text-on-surface-variant">
                      {count} {count === 1 ? "cliente" : "clientes"}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-surface-container">
                    <div
                      className="h-full rounded-full bg-primary-container"
                      style={{ width: `${Math.max(6, Math.round((count / maxInterestCount) * 100))}%` }}
                    />
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
