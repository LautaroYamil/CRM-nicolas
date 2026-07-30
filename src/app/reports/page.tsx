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
                "rounded-lg px-4 py-2 text-[11px] font-bold tracking-wider uppercase transition-colors",
                days === option.days
                  ? "bg-primary text-on-primary"
                  : "border border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container",
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
              className="card-premium flex h-36 flex-col justify-between rounded-xl p-5 lg:h-40 lg:p-6"
            >
              <p className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase">
                {kpi.label}
              </p>
              <div>
                <p className="text-5xl font-light text-on-surface">{kpi.value}</p>
                <div className="indicator-accent bg-primary" />
              </div>
              <span className="material-symbols-outlined absolute top-4 right-4 text-4xl text-primary opacity-10">
                {kpi.icon}
              </span>
            </div>
          ))}
        </div>

        {profile.role === "admin" && perSeller.length > 0 ? (
          <section className="card-premium rounded-xl p-5 lg:p-8">
            <h2 className="mb-4 text-headline-sm font-bold">Por vendedor</h2>
            <div className="overflow-x-auto border-t border-outline-variant/30">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant/60 uppercase">
                    <th className="py-4 pr-4">Vendedor</th>
                    <th className="px-4 py-4">Clientes nuevos</th>
                    <th className="px-4 py-4">Contactos</th>
                    <th className="px-4 py-4">Ventas</th>
                    <th className="px-4 py-4">Pendientes</th>
                    <th className="px-4 py-4">Vencidos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {perSeller.map((row) => (
                    <tr key={row.name} className="transition-colors hover:bg-surface-container-low">
                      <td className="py-4 pr-4 font-bold">{row.name}</td>
                      <td className="px-4 py-4 text-sm">{row.newClients}</td>
                      <td className="px-4 py-4 text-sm">{row.done}</td>
                      <td className="px-4 py-4 text-sm font-bold text-green-700">{row.sales}</td>
                      <td className="px-4 py-4 text-sm">{row.pending}</td>
                      <td className={clsx("px-4 py-4 text-sm", row.overdue > 0 && "font-bold text-error")}>
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

        <section className="card-premium rounded-xl p-5 lg:p-8">
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
