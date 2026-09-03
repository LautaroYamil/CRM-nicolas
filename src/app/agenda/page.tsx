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
  formatRelativeAr,
  formatTimeAr,
} from "@/lib/crm/dates";
import { countOverdueActivities, isOverdue, overdueActivitiesQuery } from "@/lib/crm/overdue";
import { computePriority } from "@/lib/crm/priority";

const OVERDUE_PAGE_SIZE = 30;
const WEEK_ROWS_LIMIT = 300;
const PRIORITY_PREVIEW_SIZE = 4;

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
  searchParams: Promise<{ week?: string; day?: string; seller?: string; error?: string; overdueLimit?: string }>;
};

/** Completar y Reprogramar: misma logica y mismas server actions de siempre, solo mas discretas visualmente. */
function QuickActivityActions({ row }: { row: AgendaRow }) {
  if (!row.clients) {
    return null;
  }

  const completeAction = completeActivityAction.bind(null, row.id, row.clients.id, "/agenda");
  const rescheduleAction = rescheduleActivityAction.bind(null, row.id, row.clients.id, "/agenda");

  return (
    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
      <details className="[&_summary::-webkit-details-marker]:hidden">
        <summary className="cursor-pointer text-label-sm font-semibold text-primary hover:underline">
          Completar
        </summary>
        <form action={completeAction} className="mt-2 max-w-sm space-y-2">
          <textarea
            name="outcome"
            required
            rows={2}
            placeholder="Que resulto del contacto?"
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
          />
          <OutcomeTypeSelect />
          <label className="block text-label-sm text-on-surface-variant">
            Proximo seguimiento (opcional)
            <input
              type="datetime-local"
              name="nextScheduledAt"
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md focus:border-primary focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-label-sm font-bold text-on-primary transition-all hover:bg-primary/90 active:scale-95"
          >
            Marcar realizada
          </button>
        </form>
      </details>
      <details className="[&_summary::-webkit-details-marker]:hidden">
        <summary className="cursor-pointer text-label-sm font-semibold text-primary hover:underline">
          Reprogramar
        </summary>
        <form action={rescheduleAction} className="mt-2 flex max-w-sm flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            name="scheduledAt"
            required
            className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-label-sm font-bold text-on-primary transition-all hover:bg-primary/90 active:scale-95"
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

/** Fila compacta de la lista cronologica principal. El rojo aparece solo como acento (borde/badge), nunca como fondo de toda la fila. */
function TaskRow({ row, nowIso }: { row: AgendaRow; nowIso: string }) {
  const client = row.clients;
  const overdueFlag = isOverdue(row.scheduled_at, nowIso);
  const priority = computePriority(overdueFlag, client?.status ?? "");
  const whatsappDigits = client?.phone_normalized.replace(/\D+/g, "") ?? "";

  return (
    <li
      className={clsx(
        "flex flex-wrap items-start gap-3 rounded-lg border-l-[3px] bg-surface-container-lowest px-3 py-3 transition-colors hover:bg-surface-container-low/60 sm:flex-nowrap",
        priority === "alta" ? "border-l-error" : overdueFlag ? "border-l-error/40" : "border-l-transparent",
      )}
    >
      <div className="w-16 shrink-0 pt-0.5">
        <p
          className={clsx(
            "text-label-md font-bold [font-variant-numeric:tabular-nums]",
            overdueFlag ? "text-error" : "text-on-surface",
          )}
        >
          {formatTimeAr(row.scheduled_at)}
        </p>
        {overdueFlag ? (
          <p className="text-[10px] font-bold tracking-wide text-error/80 uppercase">
            {formatRelativeAr(row.scheduled_at)}
          </p>
        ) : null}
      </div>

      <span className="material-symbols-outlined mt-0.5 shrink-0 text-[20px] text-on-surface-variant/60">
        {activityTypeIcon(row.type)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {client ? (
            <Link href={`/clients/${client.id}`} className="truncate font-bold text-on-surface hover:underline">
              {clientName(row)}
            </Link>
          ) : (
            <p className="truncate font-bold">{clientName(row)}</p>
          )}
          {priority === "alta" ? (
            <span className="shrink-0 rounded-full bg-error-container px-2 py-0.5 text-[9px] font-bold tracking-wide text-error uppercase">
              Prioridad alta
            </span>
          ) : null}
        </div>
        <p className="truncate text-label-sm text-on-surface-variant">
          {row.objective ? row.objective : "Sin objetivo cargado"}
          <span className="text-on-surface-variant/60"> · {activityTypeLabel(row.type)}</span>
        </p>
        <QuickActivityActions row={row} />
      </div>

      {client ? (
        <a
          href={`https://wa.me/${whatsappDigits}`}
          target="_blank"
          rel="noreferrer"
          title="Contactar por WhatsApp"
          className="ml-auto flex shrink-0 items-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-[11px] font-bold tracking-wide text-white uppercase transition-colors hover:bg-green-800 active:scale-95 sm:ml-0"
        >
          <span className="material-symbols-outlined text-[16px]">chat</span>
          <span className="hidden sm:inline">Contactar</span>
        </a>
      ) : null}
    </li>
  );
}

/** Fila compacta del panel de prioridad (vencidos). Mismo dato, presentacion mas chica que TaskRow. */
function PriorityRow({ row }: { row: AgendaRow }) {
  const client = row.clients;
  const whatsappDigits = client?.phone_normalized.replace(/\D+/g, "") ?? "";
  const priority = computePriority(true, client?.status ?? "");

  return (
    <li className={clsx("rounded-lg border-l-[3px] bg-surface-container-lowest p-3", priority === "alta" ? "border-l-error" : "border-l-error/40")}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold tracking-wide text-error uppercase">
          {activityTypeLabel(row.type)} vencida · {formatRelativeAr(row.scheduled_at)}
        </span>
      </div>
      {client ? (
        <Link href={`/clients/${client.id}`} className="block truncate font-bold hover:underline">
          {clientName(row)}
        </Link>
      ) : (
        <p className="truncate font-bold">{clientName(row)}</p>
      )}
      {row.objective ? (
        <p className="truncate text-label-sm text-on-surface-variant">{row.objective}</p>
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-2">
        <QuickActivityActions row={row} />
        {whatsappDigits ? (
          <a
            href={`https://wa.me/${whatsappDigits}`}
            target="_blank"
            rel="noreferrer"
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-error px-3 py-1.5 text-[11px] font-bold tracking-wide text-white uppercase transition-colors hover:bg-error/90 active:scale-95"
          >
            <span className="material-symbols-outlined text-[15px]">chat</span>
            Contactar
          </a>
        ) : null}
      </div>
    </li>
  );
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
  const isCurrentWeek = weekOffset === 0;
  const selectedDay = (params.day ?? "").trim();

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

  // Prioridad alta = vencido + estado con oportunidad activa. Conteo total
  // (no solo lo cargado en la pagina de vencidos), mismo criterio que
  // computePriority() para que el numero del panel nunca se desincronice de
  // lo que se ve marcado como "Prioridad alta" en las filas.
  let highPriorityQuery = supabase
    .from("activities")
    .select("id, clients!inner(status)", { count: "exact", head: true })
    .eq("status", "pendiente")
    .lt("scheduled_at", nowIso)
    .in("clients.status", ["interesado", "en_seguimiento"]);

  if (sellerScope) {
    weekQuery = weekQuery.eq("assigned_user_id", sellerScope.assignedUserId);
    weekCountQuery = weekCountQuery.eq("assigned_user_id", sellerScope.assignedUserId);
    highPriorityQuery = highPriorityQuery.eq("assigned_user_id", sellerScope.assignedUserId);
  }

  const [
    { data: weekRows, error },
    { count: weekTotal },
    { data: overdueRows },
    overdueTotal,
    { count: highPriorityCount },
    { data: sellerRows },
  ] = await Promise.all([
    weekQuery.returns<AgendaRow[]>(),
    weekCountQuery,
    overdueQuery.returns<AgendaRow[]>(),
    countOverdueActivities(supabase, nowIso, sellerScope),
    highPriorityQuery,
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
  const overdue = overdueRows ?? [];

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

  const sellerParam = params.seller ? `&seller=${params.seller}` : "";
  const showMoreOverdueHref = `/agenda?week=${weekOffset}${sellerParam}&overdueLimit=${overdueLimit + OVERDUE_PAGE_SIZE}`;

  // Agrupacion de la lista principal: si hay un dia elegido en la tira, se
  // muestra solo ese dia. Si no, se arma la vista "de un vistazo" -Hoy
  // primero, despues Proximos agrupados por dia- tal como pide el diseno.
  type DayGroup = { key: string; label: string; superLabel: "HOY" | "PROXIMOS" | null; rows: AgendaRow[] };
  const sortByTime = (rows: AgendaRow[]) => [...rows].sort((a, b) => (a.scheduled_at < b.scheduled_at ? -1 : 1));

  let dayGroups: DayGroup[] = [];

  if (selectedDay) {
    const dayInfo = week.find((d) => d.dateStr === selectedDay);
    dayGroups = [
      {
        key: selectedDay,
        label: dayInfo ? `${dayInfo.weekdayLabel} ${dayInfo.dayNumber}` : selectedDay,
        superLabel: dayInfo?.isToday ? "HOY" : null,
        rows: sortByTime(rowsByDay.get(selectedDay) ?? []),
      },
    ];
  } else {
    if (isCurrentWeek) {
      dayGroups.push({ key: "hoy", label: "HOY", superLabel: null, rows: todayRows });
    }

    let taggedProximos = false;
    for (const day of week) {
      if (isCurrentWeek && day.isToday) {
        continue;
      }

      const rows = sortByTime(rowsByDay.get(day.dateStr) ?? []);
      if (rows.length === 0) {
        continue;
      }

      dayGroups.push({
        key: day.dateStr,
        label: `${day.weekdayLabel} ${day.dayNumber}`,
        // "PROXIMOS" solo tiene sentido si el dia esta hoy en adelante -en una
        // semana pasada (weekOffset < 0) todo lo que quedo pendiente ya paso,
        // etiquetarlo como "proximo" seria incorrecto.
        superLabel: taggedProximos || weekOffset < 0 ? null : "PROXIMOS",
        rows,
      });
      taggedProximos = true;
    }
  }

  const hasAnyTask = dayGroups.some((group) => group.rows.length > 0);

  return (
    <AppShell profile={profile} title="Agenda">
      {params.error ? (
        <p className="mb-4 rounded-xl border border-error/30 bg-error-container/40 px-4 py-3 text-body-md font-medium text-on-error-container">
          {params.error}
        </p>
      ) : null}

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-headline-md font-bold lg:text-headline-lg">Agenda</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/agenda?week=0${sellerParam}`}
            className={clsx(
              "rounded-lg border px-4 py-2 text-[11px] font-bold tracking-wider uppercase transition-colors",
              isCurrentWeek && !selectedDay
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
          <span className="min-w-32 text-center text-body-md font-semibold capitalize text-on-surface-variant">
            {argMonthYearLabel(week[0].startIso)}
          </span>
          <Link
            href={`/agenda?week=${weekOffset + 1}${sellerParam}`}
            className="flex items-center rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-2 transition-colors hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-base">chevron_right</span>
          </Link>
          {profile.role === "admin" ? (
            <form method="get" className="flex items-center gap-2">
              <input type="hidden" name="week" value={String(weekOffset)} />
              <select
                name="seller"
                defaultValue={params.seller ?? ""}
                className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
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
                className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-[11px] font-bold tracking-wider uppercase transition-colors hover:bg-surface-container"
              >
                Filtrar
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {/* Badges compactos */}
      <div className="mb-5 flex flex-wrap gap-2">
        <span className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-1.5 text-label-sm font-semibold text-on-surface">
          {todayRows.length} para hoy
        </span>
        <span
          className={clsx(
            "rounded-lg border px-3 py-1.5 text-label-sm font-semibold",
            overdueTotal > 0
              ? "border-error/25 bg-error-container/15 text-error"
              : "border-outline-variant/30 bg-surface-container-lowest text-on-surface",
          )}
        >
          {overdueTotal} vencidos
        </span>
        <span className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-1.5 text-label-sm font-semibold text-on-surface">
          {(weekRows ?? []).filter((row) => row.scheduled_at >= todayEndIso).length} proximos
        </span>
      </div>
      {weekTruncated ? (
        <p className="mb-4 text-xs font-medium text-on-surface-variant">
          Mostrando los primeros {WEEK_ROWS_LIMIT} de {weekTotal} seguimientos de esta semana.
        </p>
      ) : null}

      {/* Tira semanal compacta */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1 xl:grid xl:grid-cols-6 xl:overflow-visible">
        {week.map((day) => {
          const count = rowsByDay.get(day.dateStr)?.length ?? 0;
          const selected = selectedDay ? selectedDay === day.dateStr : isCurrentWeek && day.isToday;

          return (
            <Link
              key={day.dateStr}
              href={`/agenda?week=${weekOffset}${sellerParam}&day=${day.dateStr}`}
              className={clsx(
                "flex min-w-[62px] flex-1 flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5 text-center transition-colors",
                selected
                  ? "border-primary bg-primary text-on-primary"
                  : "border-outline-variant/30 bg-surface-container-lowest hover:bg-surface-container-low",
              )}
            >
              <span
                className={clsx(
                  "text-[10px] font-bold tracking-wide uppercase",
                  selected ? "text-on-primary/80" : "text-on-surface-variant",
                )}
              >
                {day.weekdayLabel}
              </span>
              <span className="text-lg font-bold [font-variant-numeric:tabular-nums]">{day.dayNumber}</span>
              <span
                className={clsx(
                  "text-[10px] font-semibold [font-variant-numeric:tabular-nums]",
                  selected ? "text-on-primary/80" : "text-on-surface-variant/70",
                )}
              >
                {count > 0 ? count : "-"}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        {/* Lista cronologica principal */}
        <div className="min-w-0 space-y-6">
          {!hasAnyTask ? (
            <div className="card-premium rounded-xl p-10 text-center">
              <span className="material-symbols-outlined mb-2 text-4xl text-on-surface-variant/40">task_alt</span>
              <p className="font-bold">Nada agendado</p>
              <p className="text-body-md text-on-surface-variant">
                {selectedDay ? "No hay seguimientos para este dia." : "No queda nada pendiente esta semana."}
              </p>
            </div>
          ) : (
            dayGroups.map((group) => (
              <section key={group.key}>
                {group.superLabel ? (
                  <p className="mb-2 text-[11px] font-bold tracking-[0.2em] text-primary uppercase">
                    {group.superLabel}
                  </p>
                ) : null}
                <h2 className="mb-2 text-label-md font-bold tracking-wider text-on-surface-variant uppercase">
                  {group.label}
                </h2>
                {group.rows.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-outline-variant/40 px-3 py-4 text-center text-body-md text-on-surface-variant">
                    {group.key === "hoy" ? "Nada pendiente para hoy." : "Nada pendiente para este dia."} Buen
                    trabajo.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {group.rows.map((row) => (
                      <TaskRow key={row.id} row={row} nowIso={nowIso} />
                    ))}
                  </ul>
                )}
              </section>
            ))
          )}
        </div>

        {/* Panel de prioridad */}
        <aside>
          <section className="card-premium rounded-xl p-5">
            <h2 className="mb-4 text-headline-sm font-bold">Prioridad de hoy</h2>

            <div className="mb-5 grid grid-cols-3 gap-2 text-center">
              <div
                className={clsx(
                  "rounded-lg px-2 py-3",
                  overdueTotal > 0 ? "bg-error-container/20" : "bg-surface-container-low",
                )}
              >
                <p className={clsx("text-2xl font-bold", overdueTotal > 0 ? "text-error" : "text-on-surface")}>
                  {overdueTotal}
                </p>
                <p
                  className={clsx(
                    "text-[9px] font-bold tracking-wide uppercase",
                    overdueTotal > 0 ? "text-error/80" : "text-on-surface-variant",
                  )}
                >
                  Vencidos
                </p>
              </div>
              <div className="rounded-lg bg-surface-container-low px-2 py-3">
                <p className="text-2xl font-bold text-on-surface">{highPriorityCount ?? 0}</p>
                <p className="text-[9px] font-bold tracking-wide text-on-surface-variant uppercase">
                  Prioridad alta
                </p>
              </div>
              <div className="rounded-lg bg-surface-container-low px-2 py-3">
                <p className="text-2xl font-bold text-on-surface">{todayRows.length}</p>
                <p className="text-[9px] font-bold tracking-wide text-on-surface-variant uppercase">Hoy</p>
              </div>
            </div>

            {overdue.length === 0 ? (
              <p className="text-body-md text-on-surface-variant">Sin seguimientos vencidos. Buen trabajo.</p>
            ) : (
              <>
                <ul className="space-y-2.5">
                  {overdue.slice(0, PRIORITY_PREVIEW_SIZE).map((row) => (
                    <PriorityRow key={row.id} row={row} />
                  ))}
                </ul>

                {overdueTotal > PRIORITY_PREVIEW_SIZE ? (
                  <details className="mt-4 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex w-full cursor-pointer list-none items-center justify-center gap-1.5 rounded-lg border border-outline-variant/40 py-2.5 text-label-md font-bold text-primary transition-colors hover:bg-surface-container">
                      Ver los {overdueTotal} vencidos
                      <span className="material-symbols-outlined text-base">expand_more</span>
                    </summary>
                    <ul className="mt-3 space-y-2.5 border-t border-outline-variant/20 pt-3">
                      {overdue.slice(PRIORITY_PREVIEW_SIZE).map((row) => (
                        <PriorityRow key={row.id} row={row} />
                      ))}
                    </ul>
                    {hasMoreOverdue ? (
                      <a
                        href={showMoreOverdueHref}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-outline-variant/40 py-2.5 text-label-sm font-bold text-primary transition-colors hover:bg-surface-container"
                      >
                        Cargar {OVERDUE_PAGE_SIZE} mas ({overdueTotal - overdue.length} restantes)
                      </a>
                    ) : null}
                  </details>
                ) : null}
              </>
            )}
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
