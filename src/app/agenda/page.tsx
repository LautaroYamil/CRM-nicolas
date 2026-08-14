import Link from "next/link";
import clsx from "clsx";
import {
  completeActivityAction,
  rescheduleActivityAction,
} from "@/app/clients/[id]/actions";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { activityTypeIcon, activityTypeLabel } from "@/lib/crm/constants";
import { OutcomeTypeSelect } from "@/components/crm/outcome-type-select";
import {
  argDateStringOf,
  argMonthYearLabel,
  argTodayRange,
  argWeekDays,
  formatDateAr,
  formatRelativeAr,
  formatTimeAr,
} from "@/lib/crm/dates";
import { countOverdueActivities, isOverdue, overdueActivitiesQuery } from "@/lib/crm/overdue";
import { computePriority, PRIORITY_LABELS } from "@/lib/crm/priority";

const OVERDUE_PAGE_SIZE = 30;
const WEEK_ROWS_LIMIT = 300;

type AgendaRow = {
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

type AgendaPageProps = {
  searchParams: Promise<{ week?: string; seller?: string; error?: string; overdueLimit?: string }>;
};

function QuickActivityActions({ row }: { row: AgendaRow }) {
  if (!row.clients) {
    return null;
  }

  const completeAction = completeActivityAction.bind(null, row.id, row.clients.id, "/agenda");
  const rescheduleAction = rescheduleActivityAction.bind(null, row.id, row.clients.id, "/agenda");

  return (
    <div className="mt-2 space-y-1.5">
      <details>
        <summary className="cursor-pointer text-label-sm font-bold text-primary">Completar</summary>
        <form action={completeAction} className="mt-2 space-y-2">
          <textarea
            name="outcome"
            required
            rows={2}
            placeholder="Que resulto del contacto?"
            className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
          />
          <OutcomeTypeSelect />
          <label className="block text-label-sm text-on-surface-variant">
            Proximo seguimiento (opcional)
            <input
              type="datetime-local"
              name="nextScheduledAt"
              className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md focus:border-primary focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="rounded-xl bg-primary px-4 py-2 text-label-sm font-bold text-on-primary transition-all hover:bg-primary/90 active:scale-95"
          >
            Marcar realizada
          </button>
        </form>
      </details>
      <details>
        <summary className="cursor-pointer text-label-sm font-bold text-primary">Reprogramar</summary>
        <form action={rescheduleAction} className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            name="scheduledAt"
            required
            className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-primary px-4 py-2 text-label-sm font-bold text-on-primary transition-all hover:bg-primary/90 active:scale-95"
          >
            Guardar
          </button>
        </form>
      </details>
    </div>
  );
}

function clientName(row: AgendaRow) {
  const client = row.clients;
  return client ? `${client.first_name} ${client.last_name ?? ""}`.trim() : "Cliente";
}

export default async function AgendaPage({ searchParams }: AgendaPageProps) {
  const params = await searchParams;
  const { supabase, profile } = await getCurrentUserContext();

  const weekOffset = Number.parseInt(params.week ?? "0", 10) || 0;
  const week = argWeekDays(weekOffset);
  const weekStartIso = week[0].startIso;
  const weekEndIso = week[week.length - 1].endIso;
  const { endIso: todayEndIso } = argTodayRange();
  const nowIso = new Date().toISOString();
  const overdueLimit = Math.max(
    OVERDUE_PAGE_SIZE,
    Number.parseInt(params.overdueLimit ?? String(OVERDUE_PAGE_SIZE), 10) || OVERDUE_PAGE_SIZE,
  );

  const baseSelect =
    "id, type, scheduled_at, objective, assigned_user_id, clients(id, first_name, last_name, phone_normalized, status)";

  const sellerScope =
    profile.role === "admin" && params.seller ? { assignedUserId: params.seller } : undefined;

  let weekQuery = supabase
    .from("activities")
    .select(baseSelect)
    .eq("status", "pendiente")
    .gte("scheduled_at", weekStartIso)
    .lt("scheduled_at", weekEndIso)
    .order("scheduled_at", { ascending: true })
    .limit(WEEK_ROWS_LIMIT);

  let weekCountQuery = supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("status", "pendiente")
    .gte("scheduled_at", weekStartIso)
    .lt("scheduled_at", weekEndIso);

  const overdueQuery = overdueActivitiesQuery(supabase, nowIso, baseSelect, {
    limit: overdueLimit,
    scope: sellerScope,
  });

  if (sellerScope) {
    weekQuery = weekQuery.eq("assigned_user_id", sellerScope.assignedUserId);
    weekCountQuery = weekCountQuery.eq("assigned_user_id", sellerScope.assignedUserId);
  }

  const [{ data: weekRows, error }, { count: weekTotal }, { data: overdueRows }, overdueTotal, { data: sellerRows }] =
    await Promise.all([
      weekQuery.returns<AgendaRow[]>(),
      weekCountQuery,
      overdueQuery.returns<AgendaRow[]>(),
      countOverdueActivities(supabase, nowIso, sellerScope),
      profile.role === "admin"
        ? supabase
            .from("profiles")
            .select("id, full_name")
            .eq("active", true)
            .returns<{ id: string; full_name: string | null }[]>()
        : Promise.resolve({ data: [] as { id: string; full_name: string | null }[], error: null }),
    ]);

  if (error) {
    return (
      <AppShell profile={profile} title="Agenda">
        <p className="text-error">Error al cargar la agenda: {error.message}</p>
      </AppShell>
    );
  }

  const weekTruncated = (weekTotal ?? 0) > WEEK_ROWS_LIMIT;
  const hasMoreOverdue = overdueTotal > (overdueRows ?? []).length;

  const rowsByDay = new Map<string, AgendaRow[]>();
  for (const row of weekRows ?? []) {
    const day = argDateStringOf(row.scheduled_at);
    const existing = rowsByDay.get(day) ?? [];
    existing.push(row);
    rowsByDay.set(day, existing);
  }

  // "Tareas del dia" = lo que queda por hacer hoy; lo de hoy que ya paso de hora va a "Vencidos"
  const todayRows = (weekRows ?? []).filter(
    (row) => row.scheduled_at >= nowIso && row.scheduled_at < todayEndIso,
  );
  const overdue = overdueRows ?? [];

  const sellerParam = params.seller ? `&seller=${params.seller}` : "";
  const showMoreOverdueHref = `/agenda?week=${weekOffset}${sellerParam}&overdueLimit=${overdueLimit + OVERDUE_PAGE_SIZE}#vencidos`;

  return (
    <AppShell profile={profile} title="Agenda">
      {params.error ? (
        <p className="mb-4 rounded-xl border border-error/30 bg-error-container/40 px-4 py-3 text-body-md font-medium text-on-error-container">
          {params.error}
        </p>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        {/* Calendario semanal */}
        <div className="min-w-0">
          <div className="mb-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-headline-md font-bold capitalize lg:text-headline-lg">
                {argMonthYearLabel(week[0].startIso)}
              </h1>
              <div className="flex items-center gap-2">
                <Link
                  href={`/agenda?week=0${sellerParam}`}
                  className={clsx(
                    "rounded-lg border px-4 py-2 text-[11px] font-bold tracking-wider uppercase transition-colors",
                    weekOffset === 0
                      ? "border-primary bg-primary text-on-primary"
                      : "border-outline-variant/40 bg-surface-container-lowest hover:bg-surface-container",
                  )}
                >
                  Hoy
                </Link>
                <Link
                  href={`/agenda?week=${weekOffset - 1}${sellerParam}`}
                  className="flex items-center rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-2 transition-colors hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-base">chevron_left</span>
                </Link>
                <Link
                  href={`/agenda?week=${weekOffset + 1}${sellerParam}`}
                  className="flex items-center rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-2 transition-colors hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-base">chevron_right</span>
                </Link>
              </div>
            </div>

            {overdueTotal > 0 ? (
              <a
                href="#vencidos"
                className="inline-flex w-fit items-center gap-2 rounded-lg border border-error/30 bg-error-container/30 px-3 py-1.5 text-xs font-bold text-on-error-container transition-colors hover:bg-error-container/50"
              >
                <span className="material-symbols-outlined text-base text-error">warning</span>
                {overdueTotal} {overdueTotal === 1 ? "vencido" : "vencidos"}
              </a>
            ) : null}
            {weekTruncated ? (
              <p className="text-xs font-medium text-on-surface-variant">
                Mostrando los primeros {WEEK_ROWS_LIMIT} de {weekTotal} seguimientos de esta semana.
              </p>
            ) : null}

            {profile.role === "admin" ? (
              <form method="get" className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="week" value={String(weekOffset)} />
                <select
                  name="seller"
                  defaultValue={params.seller ?? ""}
                  className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-4 py-2 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                >
                  <option value="">Todos los vendedores</option>
                  {(sellerRows ?? []).map((seller) => (
                    <option key={seller.id} value={seller.id}>
                      {seller.full_name ?? seller.id}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-4 py-2 text-[11px] font-bold tracking-wider uppercase transition-colors hover:bg-surface-container"
                >
                  Filtrar
                </button>
              </form>
            ) : null}
          </div>

          {/* Vista mobile: lista vertical de dias, sin scroll horizontal */}
          <div className="space-y-3 xl:hidden">
            {week.map((day) => {
              const dayRows = rowsByDay.get(day.dateStr) ?? [];

              return (
                <div
                  key={day.dateStr}
                  className={clsx("card-premium rounded-xl p-4", day.isToday && "border-primary")}
                >
                  <div className="mb-3 flex items-center gap-3">
                    <span
                      className={clsx(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
                        day.isToday
                          ? "bg-primary text-on-primary"
                          : "bg-surface-container-low text-on-surface-variant",
                      )}
                    >
                      {day.dayNumber}
                    </span>
                    <div>
                      <p className="text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
                        {day.weekdayLabel}
                      </p>
                      {day.isToday ? (
                        <p className="text-[10px] font-bold text-primary uppercase">Hoy</p>
                      ) : null}
                    </div>
                    <span className="ml-auto text-xs text-on-surface-variant">
                      {dayRows.length === 0
                        ? "Libre"
                        : `${dayRows.length} ${dayRows.length === 1 ? "tarea" : "tareas"}`}
                    </span>
                  </div>
                  {dayRows.length > 0 ? (
                    <ul className="space-y-2">
                      {dayRows.map((row) => {
                        const missed = isOverdue(row.scheduled_at, nowIso);

                        return (
                          <li key={row.id}>
                            <Link
                              href={row.clients ? `/clients/${row.clients.id}` : "/agenda"}
                              className={clsx(
                                "block rounded-lg border-l-4 p-3",
                                missed ? "border-error bg-error-container/20" : "border-primary bg-primary/5",
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p
                                  className={clsx(
                                    "flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase",
                                    missed ? "text-error" : "text-primary",
                                  )}
                                >
                                  <span className="material-symbols-outlined text-xs">
                                    {activityTypeIcon(row.type)}
                                  </span>
                                  {activityTypeLabel(row.type)}
                                </p>
                                <span className="text-xs font-bold text-on-surface-variant">
                                  {formatTimeAr(row.scheduled_at)} hs
                                </span>
                              </div>
                              <p className="mt-1 truncate font-bold">{clientName(row)}</p>
                              {row.objective ? (
                                <p className="truncate text-xs text-on-surface-variant">{row.objective}</p>
                              ) : null}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="card-premium hidden overflow-x-auto rounded-xl p-3 xl:block">
            <div className="grid min-w-[720px] grid-cols-6 gap-2">
              {week.map((day) => {
                const dayRows = rowsByDay.get(day.dateStr) ?? [];

                return (
                  <div key={day.dateStr} className="flex min-h-72 flex-col">
                    <div
                      className={clsx(
                        "mb-2 rounded-lg px-2 py-2 text-center",
                        day.isToday ? "bg-primary" : "bg-surface-container-low/60",
                      )}
                    >
                      <p
                        className={clsx(
                          "text-[10px] font-bold tracking-wider uppercase",
                          day.isToday ? "text-on-primary/80" : "text-on-surface-variant",
                        )}
                      >
                        {day.weekdayLabel}
                      </p>
                      <p className={clsx("text-body-lg font-bold", day.isToday && "text-on-primary")}>
                        {day.dayNumber}
                      </p>
                    </div>

                    <div className="flex flex-1 flex-col gap-2">
                      {dayRows.map((row) => {
                        const missed = isOverdue(row.scheduled_at, nowIso);

                        return (
                          <Link
                            key={row.id}
                            href={row.clients ? `/clients/${row.clients.id}` : "/agenda"}
                            className={clsx(
                              "rounded-xl border-l-4 p-2 transition-shadow hover:shadow-md",
                              missed
                                ? "border-error bg-error-container/30"
                                : "border-primary bg-primary/5",
                            )}
                          >
                            <p
                              className={clsx(
                                "flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase",
                                missed ? "text-error" : "text-primary",
                              )}
                            >
                              <span className="material-symbols-outlined text-xs">
                                {activityTypeIcon(row.type)}
                              </span>
                              {activityTypeLabel(row.type)}
                            </p>
                            <p className="mt-0.5 truncate text-body-md font-bold">{clientName(row)}</p>
                            <p className="text-label-sm text-on-surface-variant">
                              {formatTimeAr(row.scheduled_at)} hs
                            </p>
                            {row.objective ? (
                              <p className="mt-0.5 line-clamp-2 text-label-sm text-on-surface-variant">
                                {row.objective}
                              </p>
                            ) : null}
                          </Link>
                        );
                      })}
                      {dayRows.length === 0 ? (
                        <p className="mt-4 text-center text-label-sm text-on-surface-variant/50">Libre</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Panel lateral */}
        <aside className="space-y-6">
          <section className="card-premium rounded-xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-headline-sm font-bold">Tareas del dia</h2>
              <span className="rounded border border-outline-variant/40 bg-surface-container px-2 py-1 text-[10px] font-bold tracking-wider text-on-surface uppercase">
                {todayRows.length} pendientes
              </span>
            </div>
            {todayRows.length === 0 ? (
              <p className="text-body-md text-on-surface-variant">
                No queda nada pendiente para hoy.
              </p>
            ) : (
              <ul className="space-y-3">
                {todayRows.map((row) => (
                  <li key={row.id} className="rounded-2xl border border-outline-variant/30 bg-surface-container-low/40 p-3">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined mt-0.5 text-outline">
                        radio_button_unchecked
                      </span>
                      <div className="min-w-0 flex-1">
                        {row.clients ? (
                          <Link href={`/clients/${row.clients.id}`} className="block truncate font-bold hover:underline">
                            {clientName(row)}
                          </Link>
                        ) : (
                          <p className="truncate font-bold">{clientName(row)}</p>
                        )}
                        <p className="text-label-sm text-on-surface-variant">
                          {activityTypeLabel(row.type)} - Hoy, {formatTimeAr(row.scheduled_at)}
                        </p>
                        {row.objective ? (
                          <p className="truncate text-label-sm text-on-surface-variant">{row.objective}</p>
                        ) : null}
                        <QuickActivityActions row={row} />
                      </div>
                      {row.clients ? (
                        <a
                          href={`https://wa.me/${row.clients.phone_normalized.replace(/\D+/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Abrir WhatsApp"
                          className="rounded-full bg-green-100 p-2 text-green-700 transition-colors hover:bg-green-200"
                        >
                          <span className="material-symbols-outlined text-base">chat</span>
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="vencidos" className="scroll-mt-24 card-premium rounded-xl p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-headline-sm font-bold">
                <span className="material-symbols-outlined text-error">warning</span>
                Vencidos
              </h2>
              {overdueTotal > 0 ? (
                <span className="rounded border border-error/20 bg-error-container/20 px-2 py-1 text-[10px] font-bold tracking-wider text-error uppercase">
                  {overdueTotal} {overdueTotal === 1 ? "total" : "totales"}
                </span>
              ) : null}
            </div>
            {overdue.length === 0 ? (
              <p className="text-body-md text-on-surface-variant">
                Sin seguimientos vencidos. Buen trabajo.
              </p>
            ) : (
              <ul className="space-y-3">
                {overdue.map((row) => {
                  const client = row.clients;
                  const whatsappDigits = client?.phone_normalized.replace(/\D+/g, "") ?? "";
                  const priority = computePriority(true, client?.status ?? "");

                  return (
                    <li key={row.id} className="rounded-2xl border border-error/30 bg-error-container/20 p-4">
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-error-container px-2 py-0.5 text-[10px] font-bold tracking-wide text-on-error-container uppercase">
                            {activityTypeLabel(row.type)} vencida
                          </span>
                          {priority === "alta" ? (
                            <span className="rounded-full bg-error px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
                              Prioridad {PRIORITY_LABELS[priority]}
                            </span>
                          ) : null}
                        </div>
                        <span className="text-label-sm font-bold text-error">
                          {formatRelativeAr(row.scheduled_at)}
                        </span>
                      </div>
                      {client ? (
                        <Link href={`/clients/${client.id}`} className="block font-bold hover:underline">
                          {clientName(row)}
                        </Link>
                      ) : (
                        <p className="font-bold">{clientName(row)}</p>
                      )}
                      <p className="text-label-sm text-on-surface-variant">
                        {row.objective ?? `Agendado para el ${formatDateAr(row.scheduled_at)}`}
                      </p>
                      {whatsappDigits ? (
                        <a
                          href={`https://wa.me/${whatsappDigits}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-error py-2 text-label-md font-bold text-white transition-all hover:bg-error/90 active:scale-[0.99]"
                        >
                          <span className="material-symbols-outlined text-base">chat</span>
                          Contactar ahora
                        </a>
                      ) : null}
                      <QuickActivityActions row={row} />
                    </li>
                  );
                })}
              </ul>
            )}
            {hasMoreOverdue ? (
              <a
                href={showMoreOverdueHref}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/40 py-2.5 text-label-md font-bold text-primary transition-colors hover:bg-surface-container"
              >
                Mostrar mas ({overdueTotal - overdue.length} restantes)
              </a>
            ) : null}
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
