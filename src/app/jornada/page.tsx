import Link from "next/link";
import { redirect } from "next/navigation";
import clsx from "clsx";
import { completeActivityAction } from "@/app/clients/[id]/actions";
import { AppShell } from "@/components/layout/app-shell";
import { OutcomeTypeSelect } from "@/components/crm/outcome-type-select";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { activityTypeIcon, activityTypeLabel, clientStatusChipClasses, clientStatusLabel } from "@/lib/crm/constants";
import { argTodayRange, formatRelativeAr, formatTimeAr } from "@/lib/crm/dates";
import { isOverdue, overdueActivitiesQuery } from "@/lib/crm/overdue";
import { computePriority, PRIORITY_LABELS } from "@/lib/crm/priority";

// Tope de la cola: mantiene la URL en un tamano razonable. Si hay mas
// vencidos/hoy que esto, se toman los mas viejos primero (los mas urgentes) y
// el resto queda para la proxima vez que se abra "Empezar jornada".
const JORNADA_QUEUE_LIMIT = 50;

type JornadaPageProps = {
  searchParams: Promise<{ queue?: string; pos?: string }>;
};

type QueueActivity = {
  id: string;
  type: string;
  scheduled_at: string;
  objective: string | null;
  client_id: string;
  clients: {
    id: string;
    first_name: string;
    last_name: string | null;
    phone_normalized: string;
    status: string;
  } | null;
};

const priorityBadgeClasses: Record<string, string> = {
  alta: "bg-error text-white",
  media: "border border-yellow-600/30 bg-yellow-50 text-yellow-800",
  baja: "border border-outline-variant/40 bg-surface-container text-on-surface-variant",
};

function EmptyScreen({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <span className="material-symbols-outlined mb-3 text-5xl text-on-surface-variant/40">task_alt</span>
      <h1 className="mb-1 text-headline-sm font-bold">{title}</h1>
      <p className="mb-6 text-body-md text-on-surface-variant">{subtitle}</p>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-xs font-bold tracking-widest text-on-primary uppercase shadow-sm transition-all hover:bg-on-surface-variant active:scale-[0.98]"
      >
        Volver al inicio
      </Link>
    </div>
  );
}

export default async function JornadaPage({ searchParams }: JornadaPageProps) {
  const params = await searchParams;
  const { supabase, user, profile } = await getCurrentUserContext();

  // Sin cola todavia: se arma una vez (vencidos mas viejos primero, despues
  // lo de hoy por hora) y se "congela" codificandola en la URL -asi no se
  // reordena sola mientras el vendedor va trabajando cliente por cliente.
  if (!params.queue) {
    const nowIso = new Date().toISOString();
    const { endIso: todayEndIso } = argTodayRange();

    const [{ data: overdueRows }, { data: todayRows }] = await Promise.all([
      overdueActivitiesQuery(supabase, nowIso, "id", {
        limit: JORNADA_QUEUE_LIMIT,
        scope: { assignedUserId: user.id },
      }).returns<{ id: string }[]>(),
      supabase
        .from("activities")
        .select("id")
        .eq("status", "pendiente")
        .eq("assigned_user_id", user.id)
        .gte("scheduled_at", nowIso)
        .lt("scheduled_at", todayEndIso)
        .order("scheduled_at", { ascending: true })
        .limit(JORNADA_QUEUE_LIMIT)
        .returns<{ id: string }[]>(),
    ]);

    const ids = [...(overdueRows ?? []).map((row) => row.id), ...(todayRows ?? []).map((row) => row.id)].slice(
      0,
      JORNADA_QUEUE_LIMIT,
    );

    if (ids.length === 0) {
      return (
        <AppShell profile={profile} title="Empezar jornada">
          <EmptyScreen
            title="No tenes nada pendiente ahora"
            subtitle="Ni vencidos ni seguimientos para hoy. Buen trabajo."
          />
        </AppShell>
      );
    }

    redirect(`/jornada?queue=${ids.join(",")}&pos=0`);
  }

  const queueIds = params.queue.split(",").filter(Boolean);
  const pos = Math.max(0, Number.parseInt(params.pos ?? "0", 10) || 0);
  const nextHref = `/jornada?queue=${params.queue}&pos=${pos + 1}`;

  if (pos >= queueIds.length || queueIds.length === 0) {
    return (
      <AppShell profile={profile} title="Empezar jornada">
        <EmptyScreen
          title="Listo, terminaste la jornada"
          subtitle={`Trabajaste ${queueIds.length} de ${queueIds.length}.`}
        />
      </AppShell>
    );
  }

  const currentActivityId = queueIds[pos];
  const { data: activity } = await supabase
    .from("activities")
    .select(
      "id, type, scheduled_at, objective, client_id, clients(id, first_name, last_name, phone_normalized, status)",
    )
    .eq("id", currentActivityId)
    .eq("status", "pendiente")
    .maybeSingle<QueueActivity>();

  // Si ya no esta pendiente (se completo/cancelo desde otro lado mientras
  // tanto), no rompe la jornada: se salta sola al siguiente.
  if (!activity || !activity.clients) {
    redirect(nextHref);
  }

  const client = activity.clients;
  const clientName = `${client.first_name} ${client.last_name ?? ""}`.trim();
  const whatsappDigits = client.phone_normalized.replace(/\D+/g, "");
  const nowIso = new Date().toISOString();
  const overdue = isOverdue(activity.scheduled_at, nowIso);
  const priority = computePriority(overdue, client.status);
  const completeAction = completeActivityAction.bind(null, activity.id, client.id, nextHref);

  return (
    <AppShell profile={profile} title="Empezar jornada">
      <div className="mx-auto max-w-xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-label-md font-bold tracking-wider text-on-surface-variant uppercase">
            {pos + 1} de {queueIds.length}
          </p>
          <Link
            href="/dashboard"
            className="text-label-md font-semibold text-on-surface-variant hover:text-primary"
          >
            Salir
          </Link>
        </div>

        <section className="card-premium rounded-xl p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span
              className={clsx(
                "rounded-full px-3 py-1 text-[11px] font-bold uppercase",
                clientStatusChipClasses(client.status),
              )}
            >
              {clientStatusLabel(client.status)}
            </span>
            <span className={clsx("rounded-full px-3 py-1 text-[11px] font-bold uppercase", priorityBadgeClasses[priority])}>
              Prioridad {PRIORITY_LABELS[priority]}
            </span>
            {overdue ? (
              <span className="text-label-sm font-bold text-error">
                Vencido {formatRelativeAr(activity.scheduled_at)}
              </span>
            ) : (
              <span className="text-label-sm text-on-surface-variant">Hoy, {formatTimeAr(activity.scheduled_at)}</span>
            )}
          </div>

          <h1 className="mb-1 text-headline-md font-bold">{clientName}</h1>
          <p className="mb-4 flex items-center gap-1.5 text-body-md text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px]">{activityTypeIcon(activity.type)}</span>
            {activityTypeLabel(activity.type)} - {client.phone_normalized}
          </p>

          {activity.objective ? (
            <p className="mb-5 rounded-xl bg-surface-container-low px-4 py-3 text-body-md text-on-surface-variant italic">
              Objetivo: &quot;{activity.objective}&quot;
            </p>
          ) : null}

          <div className="mb-5 flex flex-wrap gap-2">
            <a
              href={`https://wa.me/${whatsappDigits}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-xs font-bold tracking-widest text-white uppercase shadow-sm transition-all hover:bg-green-800 active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[18px]">chat</span>
              WhatsApp
            </a>
            <a
              href={`tel:${client.phone_normalized}`}
              className="flex items-center gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-4 py-2 text-xs font-bold tracking-widest text-on-surface-variant uppercase transition-colors hover:bg-surface-container"
            >
              <span className="material-symbols-outlined text-[18px]">call</span>
              Llamar
            </a>
            <Link
              href={`/clients/${client.id}`}
              className="flex items-center gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-4 py-2 text-xs font-bold tracking-widest text-on-surface-variant uppercase transition-colors hover:bg-surface-container"
            >
              <span className="material-symbols-outlined text-[18px]">visibility</span>
              Ver ficha
            </Link>
          </div>

          <form action={completeAction} className="space-y-3 border-t border-outline-variant/30 pt-4">
            <textarea
              name="outcome"
              required
              rows={3}
              placeholder="Que paso con este contacto?"
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
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-label-md font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.99]"
            >
              <span className="material-symbols-outlined text-base">check</span>
              Guardar y siguiente
            </button>
          </form>

          <div className="mt-3 border-t border-outline-variant/20 pt-3 text-center">
            <Link href={nextHref} className="text-label-md font-bold text-on-surface-variant hover:text-primary">
              Posponer (saltear sin registrar)
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
