import Link from "next/link";
import clsx from "clsx";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { CLIENT_STATUS_OPTIONS } from "@/lib/crm/constants";
import { isoDaysAgo } from "@/lib/crm/dates";
import { countOverdueActivities } from "@/lib/crm/overdue";
import { getClientStatusCounts } from "@/lib/crm/queries";

const PERIOD_OPTIONS = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
] as const;

type ReportsPageProps = {
  searchParams: Promise<{ days?: string }>;
};

type SellerOption = { id: string; full_name: string | null };

type PerSellerRow = {
  name: string;
  newClients: number;
  done: number;
  sales: number;
  pending: number;
  overdue: number;
  cohortConverted: number;
  conversion: number | null;
};

type SaleTimingRow = {
  created_at: string;
  clients: { created_at: string } | null;
};

/**
 * Cuenta filas via COUNT en SQL (head: true, sin traer datos), en vez de traer
 * hasta 5000 filas y contarlas/filtrarlas en JS. Cada metrica es su propia query
 * chica; para un equipo de pocos vendedores esto es mas rapido y no tiene techo
 * de filas que pueda subcontar en silencio como antes.
 */
async function countRows(builder: PromiseLike<{ count: number | null }>) {
  const { count } = await builder;
  return count ?? 0;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const { supabase, profile } = await getCurrentUserContext();

  const days = PERIOD_OPTIONS.some((option) => option.days === Number(params.days))
    ? Number(params.days)
    : 30;
  const sinceIso = isoDaysAgo(days);
  const nowIso = new Date().toISOString();

  const [
    newClientsCount,
    doneCount,
    salesCount,
    cohortConvertedCount,
    { data: sellersData },
    { data: interestOptions },
    statusCountsResult,
    { data: lossReasonOptions },
    { data: saleTimingRows },
  ] = await Promise.all([
    countRows(
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .is("archived_at", null)
        .gte("created_at", sinceIso),
    ),
    countRows(
      supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("status", "realizada")
        .gte("completed_at", sinceIso),
    ),
    countRows(
      supabase
        .from("client_status_changes")
        .select("id", { count: "exact", head: true })
        .eq("new_status", "compro")
        .gte("created_at", sinceIso),
    ),
    // Conversion de cohorte: de los clientes CREADOS en el periodo, cuantos ya
    // estan en "Compro" hoy (sin importar cuando cerraron la venta). Antes se
    // dividian dos conjuntos de clientes distintos (ventas del periodo, sin
    // filtrar por fecha de alta, sobre clientes nuevos del periodo) - una venta
    // de un cliente dado de alta hace 8 meses inflaba el numerador sin haber
    // aportado nunca al denominador.
    countRows(
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .is("archived_at", null)
        .gte("created_at", sinceIso)
        .eq("status", "compro"),
    ),
    supabase.from("profiles").select("id, full_name").eq("active", true).returns<SellerOption[]>(),
    supabase.from("interests").select("id, name").eq("active", true).returns<{ id: string; name: string }[]>(),
    getClientStatusCounts(supabase),
    supabase.from("loss_reasons").select("id, name").eq("active", true).returns<{ id: string; name: string }[]>(),
    // Tiempo hasta la venta: de la cohorte del periodo (clientes dados de alta
    // en el periodo), cuando pasaron a Compro vs. cuando se dieron de alta. Es
    // un conjunto chico a proposito (solo las conversiones reales de la
    // cohorte, no toda la tabla), calcular el promedio en JS sobre esto no
    // repite el problema de traer miles de filas de antes de Fase 1.
    supabase
      .from("client_status_changes")
      .select("created_at, clients!inner(created_at)")
      .eq("new_status", "compro")
      .gte("clients.created_at", sinceIso)
      .is("clients.archived_at", null)
      .limit(500)
      .returns<SaleTimingRow[]>(),
  ]);

  const conversion = newClientsCount > 0 ? Math.round((cohortConvertedCount / newClientsCount) * 100) : null;

  const saleTimingDays = (saleTimingRows ?? [])
    .filter((row) => row.clients)
    .map((row) => {
      const created = new Date(row.clients!.created_at).getTime();
      const converted = new Date(row.created_at).getTime();
      return Math.max(0, (converted - created) / (1000 * 60 * 60 * 24));
    });
  const avgDaysToSale =
    saleTimingDays.length > 0
      ? Math.round(saleTimingDays.reduce((sum, days) => sum + days, 0) / saleTimingDays.length)
      : null;

  const statusCounts = statusCountsResult.counts;
  const totalLost = statusCounts.get("no_interesado") ?? 0;

  const lossReasons = lossReasonOptions ?? [];
  const lossReasonCountsEntries = await Promise.all(
    lossReasons.map(async (reason) => {
      const count = await countRows(
        supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .is("archived_at", null)
          .eq("status", "no_interesado")
          .eq("loss_reason_id", reason.id),
      );
      return [reason.name, count] as const;
    }),
  );
  const sortedLossReasons = lossReasonCountsEntries.filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]);
  const maxLossReasonCount = sortedLossReasons[0]?.[1] ?? 1;

  const sellers = sellersData ?? [];
  const perSeller: PerSellerRow[] =
    profile.role === "admin"
      ? await Promise.all(
          sellers.map(async (seller): Promise<PerSellerRow> => {
            const [newClients, done, sales, pending, overdue, cohortConverted] = await Promise.all([
              countRows(
                supabase
                  .from("clients")
                  .select("id", { count: "exact", head: true })
                  .is("archived_at", null)
                  .gte("created_at", sinceIso)
                  .eq("assigned_user_id", seller.id),
              ),
              countRows(
                supabase
                  .from("activities")
                  .select("id", { count: "exact", head: true })
                  .eq("status", "realizada")
                  .gte("completed_at", sinceIso)
                  .eq("assigned_user_id", seller.id),
              ),
              countRows(
                supabase
                  .from("client_status_changes")
                  .select("id, clients!inner(assigned_user_id)", { count: "exact", head: true })
                  .eq("new_status", "compro")
                  .gte("created_at", sinceIso)
                  .eq("clients.assigned_user_id", seller.id),
              ),
              countRows(
                supabase
                  .from("activities")
                  .select("id", { count: "exact", head: true })
                  .eq("status", "pendiente")
                  .eq("assigned_user_id", seller.id),
              ),
              countOverdueActivities(supabase, nowIso, { assignedUserId: seller.id }),
              countRows(
                supabase
                  .from("clients")
                  .select("id", { count: "exact", head: true })
                  .is("archived_at", null)
                  .gte("created_at", sinceIso)
                  .eq("status", "compro")
                  .eq("assigned_user_id", seller.id),
              ),
            ]);

            const conversion = newClients > 0 ? Math.round((cohortConverted / newClients) * 100) : null;

            return {
              name: seller.full_name ?? "Vendedor",
              newClients,
              done,
              sales,
              pending,
              overdue,
              cohortConverted,
              conversion,
            };
          }),
        )
      : [];

  // Ordenado por tasa de conversion, no por volumen: un vendedor con 20 leads
  // que convierte el 40% no deberia parecer peor que uno con 100 leads y
  // 15 ventas solo porque el numero crudo es mas grande.
  const activeSellers = perSeller
    .filter((row) => row.newClients + row.done + row.sales + row.pending > 0)
    .sort((a, b) => (b.conversion ?? -1) - (a.conversion ?? -1) || b.sales - a.sales);

  const maxSellerSales = Math.max(1, ...activeSellers.map((row) => row.sales));

  // Clientes por interes: antes traia TODA client_interests (hasta 5000 filas)
  // sin ningun filtro y contaba en JS. El catalogo de intereses es chico (lo
  // administra el admin), asi que una query de conteo por interes escala mejor
  // que traer cada vinculo cliente-interes existente.
  const interests = interestOptions ?? [];
  const interestCountsEntries = await Promise.all(
    interests.map(async (interest) => {
      const count = await countRows(
        supabase
          .from("client_interests")
          .select("client_id", { count: "exact", head: true })
          .eq("interest_id", interest.id),
      );
      return [interest.name, count] as const;
    }),
  );
  const sortedInterests = interestCountsEntries
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  const maxInterestCount = sortedInterests[0]?.[1] ?? 1;

  const kpis = [
    { label: "Clientes nuevos", value: newClientsCount, icon: "person_add" },
    { label: "Contactos realizados", value: doneCount, icon: "task_alt" },
    { label: "Ventas", value: salesCount, icon: "sell" },
    {
      label: "Conversion nuevo a venta",
      value: conversion === null ? "-" : `${conversion}%`,
      icon: "trending_up",
    },
    {
      label: "Tiempo hasta la venta",
      value: avgDaysToSale === null ? "-" : `${avgDaysToSale}d`,
      icon: "schedule",
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
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-6">
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
        <p className="text-label-sm text-on-surface-variant">
          <strong className="font-semibold">Ventas</strong> son cambios de estado a Compro ocurridos en el
          periodo, sin importar cuando se dio de alta el cliente.{" "}
          <strong className="font-semibold">Conversion nuevo a venta</strong> es otra cosa: de los clientes
          dados de alta en este mismo periodo, que porcentaje ya llego a Compro. Si el periodo es corto (7
          dias), es normal que salga baja porque los clientes mas nuevos todavia no tuvieron tiempo de
          comprar.
        </p>

        <section className="card-premium rounded-xl p-5 lg:p-8">
          <h2 className="mb-1 text-headline-sm font-bold">Cartera por estado</h2>
          <p className="mb-4 text-body-md text-on-surface-variant">
            Foto de hoy de toda tu cartera activa, no del periodo elegido -para eso esta el embudo del
            Inicio.
          </p>
          <ul className="space-y-3">
            {CLIENT_STATUS_OPTIONS.map((option) => {
              const count = statusCounts.get(option.value) ?? 0;
              const total = Math.max(
                1,
                CLIENT_STATUS_OPTIONS.reduce((sum, opt) => sum + (statusCounts.get(opt.value) ?? 0), 0),
              );

              return (
                <li key={option.value}>
                  <div className="mb-1 flex items-center justify-between text-body-md">
                    <span className="font-semibold">{option.label}</span>
                    <span className="text-on-surface-variant">
                      {count} {count === 1 ? "cliente" : "clientes"}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-surface-container">
                    <div
                      className="h-full rounded-full bg-primary-container"
                      style={{ width: `${Math.max(count > 0 ? 4 : 0, Math.round((count / total) * 100))}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {profile.role === "admin" && activeSellers.length > 0 ? (
          <section className="card-premium rounded-xl p-5 lg:p-8">
            <h2 className="mb-1 text-headline-sm font-bold">Ventas por vendedor</h2>
            <p className="mb-5 text-body-md text-on-surface-variant">
              Quien esta convirtiendo mas en el periodo elegido.
            </p>
            <ul className="space-y-3">
              {activeSellers.map((row) => (
                <li key={row.name} className="group flex items-center gap-3">
                  <span
                    className="w-24 shrink-0 truncate text-body-md font-semibold text-on-surface sm:w-32"
                    title={row.name}
                  >
                    {row.name}
                  </span>
                  <div className="h-5 flex-1 overflow-hidden rounded bg-surface-container transition-colors group-hover:bg-surface-container-high">
                    <div
                      className="h-full rounded-r bg-primary-container transition-[width]"
                      style={{
                        width: `${row.sales > 0 ? Math.max(4, (row.sales / maxSellerSales) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right text-body-md font-bold text-on-surface [font-variant-numeric:tabular-nums]">
                    {row.sales}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {profile.role === "admin" && activeSellers.length > 0 ? (
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
                    <th className="px-4 py-4">Conversion</th>
                    <th className="px-4 py-4">Pendientes</th>
                    <th className="px-4 py-4">Vencidos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {activeSellers.map((row) => (
                    <tr key={row.name} className="transition-colors hover:bg-surface-container-low">
                      <td className="py-4 pr-4 font-bold">{row.name}</td>
                      <td className="px-4 py-4 text-sm">{row.newClients}</td>
                      <td className="px-4 py-4 text-sm">{row.done}</td>
                      <td className="px-4 py-4 text-sm font-bold text-green-700">{row.sales}</td>
                      <td className="px-4 py-4 text-sm">{row.conversion === null ? "-" : `${row.conversion}%`}</td>
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
              Ordenado por Conversion (de sus propios clientes nuevos del periodo, cuantos ya compraron), no
              por volumen de ventas -asi un vendedor con menos leads asignados no queda peor solo por tener
              un numero mas chico. Ventas: clientes que pasaron a estado Compro en el periodo. Pendientes y
              vencidos son al dia de hoy.
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

        <section className="card-premium rounded-xl p-5 lg:p-8">
          <h2 className="mb-1 text-headline-sm font-bold">Perdidas por motivo</h2>
          <p className="mb-4 text-body-md text-on-surface-variant">
            De los {totalLost} clientes marcados como No interesado (cartera completa, no solo el periodo
            elegido), por que se perdieron.
          </p>
          {sortedLossReasons.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">
              Todavia no hay motivos cargados en clientes marcados como No interesado.
            </p>
          ) : (
            <ul className="space-y-3">
              {sortedLossReasons.map(([name, count]) => (
                <li key={name}>
                  <div className="mb-1 flex items-center justify-between text-body-md">
                    <span className="font-semibold">{name}</span>
                    <span className="text-on-surface-variant">
                      {count} {count === 1 ? "cliente" : "clientes"}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-surface-container">
                    <div
                      className="h-full rounded-full bg-error/60"
                      style={{ width: `${Math.max(6, Math.round((count / maxLossReasonCount) * 100))}%` }}
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
