import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import {
  ACTIVITY_TYPE_OPTIONS,
  activityTypeIcon,
  activityTypeLabel,
  clientStatusChipClasses,
  clientStatusLabel,
} from "@/lib/crm/constants";
import {
  defaultFollowUpLocalValue,
  formatDateAr,
  formatDateTimeAr,
  formatPlainDateAr,
  formatRelativeAr,
} from "@/lib/crm/dates";
import { buildMessageTemplates, waLink } from "@/lib/crm/whatsapp";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import type { Activity, ClientStatusChange } from "@/types/database";
import { archiveClientAction, restoreClientAction } from "@/app/clients/actions";
import {
  cancelActivityAction,
  completeActivityAction,
  deletePurchaseAction,
  logContactAction,
  registerPurchaseAction,
  rescheduleActivityAction,
  scheduleFollowUpAction,
} from "./actions";

type ClientDetailRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  phone_raw: string;
  phone_normalized: string;
  dni: string | null;
  birth_date: string | null;
  locality: string | null;
  address: string | null;
  status: string;
  assigned_user_id: string;
  notes: string | null;
  last_contact_at: string | null;
  next_follow_up_at: string | null;
  created_at: string;
  archived_at: string | null;
  client_interests: { interests: { name: string } | null }[];
};

type PurchaseRow = {
  id: string;
  purchased_at: string;
};

type ClientDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

type TimelineEvent = {
  key: string;
  at: string;
  icon: string;
  iconClasses: string;
  title: string;
  detail: string | null;
};

export default async function ClientDetailPage({ params, searchParams }: ClientDetailPageProps) {
  const [{ id }, { error: errorMessage }] = await Promise.all([params, searchParams]);
  const { supabase, profile } = await getCurrentUserContext();

  const { data: client } = await supabase
    .from("clients")
    .select(
      "id, first_name, last_name, phone_raw, phone_normalized, dni, birth_date, locality, address, status, assigned_user_id, notes, last_contact_at, next_follow_up_at, created_at, archived_at, client_interests(interests(name))",
    )
    .eq("id", id)
    .single<ClientDetailRow>();

  if (!client) {
    notFound();
  }

  const [{ data: activities }, { data: statusChanges }, { data: sellerRows }, { data: purchases }] =
    await Promise.all([
      supabase
        .from("activities")
        .select("*")
        .eq("client_id", id)
        .order("scheduled_at", { ascending: true })
        .returns<Activity[]>(),
      supabase
        .from("client_status_changes")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false })
        .returns<ClientStatusChange[]>(),
      supabase.from("profiles").select("id, full_name").returns<{ id: string; full_name: string | null }[]>(),
      supabase
        .from("client_purchases")
        .select("id, purchased_at")
        .eq("client_id", id)
        .order("purchased_at", { ascending: false })
        .returns<PurchaseRow[]>(),
    ]);

  const purchaseCount = (purchases ?? []).length;
  const isFrequentClient = purchaseCount >= 2;

  const sellersById = new Map((sellerRows ?? []).map((seller) => [seller.id, seller.full_name ?? "Vendedor"]));
  const sellerName = sellersById.get(client.assigned_user_id) ?? "Vendedor";
  const interests = client.client_interests
    .map((row) => row.interests?.name)
    .filter((name): name is string => Boolean(name));

  const nowIso = new Date().toISOString();
  const pendingActivities = (activities ?? []).filter((activity) => activity.status === "pendiente");
  const historyActivities = (activities ?? []).filter((activity) => activity.status !== "pendiente");
  const overdueCount = pendingActivities.filter((activity) => activity.scheduled_at < nowIso).length;

  const timeline: TimelineEvent[] = [
    ...historyActivities.map((activity) => ({
      key: `activity-${activity.id}`,
      at: activity.completed_at ?? activity.updated_at,
      icon: activity.status === "realizada" ? activityTypeIcon(activity.type) : "block",
      iconClasses:
        activity.status === "realizada"
          ? "bg-primary-fixed text-primary"
          : "bg-surface-container-high text-on-surface-variant",
      title:
        activity.status === "realizada"
          ? `${activityTypeLabel(activity.type)} realizada`
          : `${activityTypeLabel(activity.type)} cancelada`,
      detail: activity.outcome ?? activity.objective,
    })),
    ...(statusChanges ?? []).map((change) => ({
      key: `status-${change.id}`,
      at: change.created_at,
      icon: change.old_status ? "swap_horiz" : "person_add",
      iconClasses: "bg-yellow-100 text-yellow-700",
      title: change.old_status
        ? `Estado: ${clientStatusLabel(change.old_status)} a ${clientStatusLabel(change.new_status)}`
        : `Cliente creado como ${clientStatusLabel(change.new_status)}`,
      detail: change.changed_by ? `Por ${sellersById.get(change.changed_by) ?? "un usuario"}` : null,
    })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  const whatsappDigits = client.phone_normalized.replace(/\D+/g, "");
  const fullName = `${client.first_name} ${client.last_name ?? ""}`.trim();
  const initials = fullName
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const defaultFollowUp = defaultFollowUpLocalValue();
  const messageTemplates = buildMessageTemplates({
    clientFirstName: client.first_name,
    sellerName: (profile.full_name ?? "").split(/\s+/)[0] || "el equipo",
    interest: interests[0],
  });

  return (
    <AppShell profile={profile} title="Ficha de cliente">
      <Link
        href="/clients"
        className="mb-4 inline-flex items-center gap-1 text-label-md font-semibold text-on-surface-variant hover:text-primary"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        Volver a clientes
      </Link>

      {errorMessage ? (
        <p className="mb-4 rounded-xl border border-error/30 bg-error-container/40 px-4 py-3 text-body-md font-medium text-on-error-container">
          {errorMessage}
        </p>
      ) : null}

      {client.archived_at ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error/30 bg-error-container/20 px-4 py-3">
          <p className="text-body-md font-medium text-on-error-container">
            Este cliente esta eliminado desde el {formatDateAr(client.archived_at)}. No aparece en el
            directorio ni en la agenda.
          </p>
          <form action={restoreClientAction.bind(null, client.id, `/clients/${client.id}`)}>
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-xs font-bold tracking-widest text-on-primary uppercase transition-all hover:bg-on-surface-variant active:scale-[0.98]"
            >
              Restaurar cliente
            </button>
          </form>
        </div>
      ) : null}

      {/* Header */}
      <section className="mb-6 card-premium rounded-xl p-5 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary-container/10 text-headline-sm font-black text-primary">
              {initials}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-headline-md font-bold">{fullName}</h1>
                <span
                  className={clsx(
                    "rounded-full px-3 py-1 text-[11px] font-bold uppercase",
                    clientStatusChipClasses(client.status),
                  )}
                >
                  {clientStatusLabel(client.status)}
                </span>
              </div>
              <p className="text-body-md text-on-surface-variant">
                Vendedor: <span className="font-semibold">{sellerName}</span>
                {client.locality ? ` - ${client.locality}` : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`https://wa.me/${whatsappDigits}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg bg-green-700 px-5 py-2.5 text-xs font-bold tracking-widest text-white uppercase shadow-sm transition-all hover:bg-green-800 active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[18px]">chat</span>
              WhatsApp
            </a>
            <a
              href={`tel:${client.phone_normalized}`}
              title="Llamar"
              className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-2.5 transition-colors hover:bg-surface-container"
            >
              <span className="material-symbols-outlined text-base">call</span>
            </a>
            <a
              href="#programar"
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-xs font-bold tracking-widest text-on-primary uppercase shadow-sm transition-all hover:bg-on-surface-variant active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[18px]">event_available</span>
              Nuevo seguimiento
            </a>
            <Link
              href={`/clients/${client.id}/edit`}
              title="Editar cliente"
              className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-2.5 transition-colors hover:bg-surface-container"
            >
              <span className="material-symbols-outlined text-base">edit</span>
            </Link>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-3 border-t border-outline-variant/30 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-label-sm tracking-wider text-on-surface-variant uppercase">Ultimo contacto</dt>
            <dd className="m-0 text-body-lg font-bold">{formatRelativeAr(client.last_contact_at)}</dd>
          </div>
          <div>
            <dt className="text-label-sm tracking-wider text-on-surface-variant uppercase">Proximo seguimiento</dt>
            <dd
              className={clsx(
                "m-0 text-body-lg font-bold",
                client.next_follow_up_at && client.next_follow_up_at < nowIso ? "text-error" : "text-primary",
              )}
            >
              {formatDateTimeAr(client.next_follow_up_at)}
            </dd>
          </div>
          <div>
            <dt className="text-label-sm tracking-wider text-on-surface-variant uppercase">Cliente desde</dt>
            <dd className="m-0 text-body-lg font-bold">{formatDateAr(client.created_at)}</dd>
          </div>
          <div>
            <dt className="text-label-sm tracking-wider text-on-surface-variant uppercase">Compras</dt>
            <dd className="m-0 flex items-center gap-2 text-body-lg font-bold">
              {purchaseCount}
              {isFrequentClient ? (
                <span className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-on-primary uppercase">
                  Frecuente
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr] xl:grid-cols-[280px_1fr_320px]">
        {/* Columna izquierda: datos */}
        <aside className="order-2 space-y-6 xl:order-none">
          <section className="card-premium rounded-xl p-5">
            <h2 className="mb-3 text-label-md font-bold tracking-wider text-on-surface-variant uppercase">
              Contacto
            </h2>
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">call</span>
                <span className="text-body-md font-medium">{client.phone_normalized}</span>
              </li>
              {client.locality ? (
                <li className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">location_on</span>
                  <span className="text-body-md font-medium">{client.locality}</span>
                </li>
              ) : null}
              {client.address ? (
                <li className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">home</span>
                  <span className="text-body-md font-medium">{client.address}</span>
                </li>
              ) : null}
              {client.dni ? (
                <li className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">badge</span>
                  <span className="text-body-md font-medium">DNI {client.dni}</span>
                </li>
              ) : null}
              {client.birth_date ? (
                <li className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">cake</span>
                  <span className="text-body-md font-medium">{formatPlainDateAr(client.birth_date)}</span>
                </li>
              ) : null}
            </ul>
          </section>

          <section className="card-premium rounded-xl p-5">
            <h2 className="mb-3 text-label-md font-bold tracking-wider text-on-surface-variant uppercase">
              Intereses
            </h2>
            {interests.length === 0 ? (
              <p className="text-body-md text-on-surface-variant">
                Sin intereses cargados.{" "}
                <Link href={`/clients/${client.id}/edit`} className="font-semibold text-primary hover:underline">
                  Agregar
                </Link>
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {interests.map((interest) => (
                  <span
                    key={interest}
                    className="rounded border border-outline-variant/40 bg-surface-container px-2.5 py-1 text-[10px] font-bold tracking-wider text-on-surface uppercase"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="card-premium rounded-xl p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-label-md font-bold tracking-wider text-on-surface-variant uppercase">
                Compras ({purchaseCount})
              </h2>
              <form action={registerPurchaseAction.bind(null, client.id, `/clients/${client.id}`)}>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold tracking-wider text-on-primary uppercase transition-all hover:bg-on-surface-variant active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-base">add_shopping_cart</span>
                  Sumar compra
                </button>
              </form>
            </div>
            {isFrequentClient ? (
              <p className="mb-3 text-body-md font-semibold text-primary">Cliente frecuente</p>
            ) : null}
            {(purchases ?? []).length === 0 ? (
              <p className="text-body-md text-on-surface-variant">Todavia no compro nada.</p>
            ) : (
              <ul className="space-y-2">
                {(purchases ?? []).map((purchase) => (
                  <li
                    key={purchase.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-surface-container-low/60 px-3 py-2"
                  >
                    <span className="text-body-md font-medium">{formatDateAr(purchase.purchased_at)}</span>
                    <form action={deletePurchaseAction.bind(null, purchase.id, client.id, `/clients/${client.id}`)}>
                      <ConfirmSubmitButton
                        confirmMessage="Quitar esta compra del historial?"
                        title="Quitar"
                        className="p-1 text-on-surface-variant transition-colors hover:text-error"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </ConfirmSubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {client.notes ? (
            <section className="card-premium rounded-xl p-5">
              <h2 className="mb-3 text-label-md font-bold tracking-wider text-on-surface-variant uppercase">
                Notas
              </h2>
              <p className="text-body-md whitespace-pre-wrap text-on-surface-variant">{client.notes}</p>
            </section>
          ) : null}
        </aside>

        {/* Columna central: registrar + historial */}
        <div className="order-3 space-y-6 xl:order-none">
          <section className="card-premium rounded-xl p-5">
            <h2 className="mb-1 text-headline-sm font-bold">Registrar contacto</h2>
            <p className="mb-4 text-body-md text-on-surface-variant">
              Ya hablaste con {client.first_name}? Deja registro y programa el proximo paso.
            </p>
            <form action={logContactAction.bind(null, client.id)} className="space-y-3">
              <div className="rounded-2xl bg-surface-container-low p-4">
                <textarea
                  name="outcome"
                  required
                  rows={3}
                  placeholder="Que se hablo? Que quedo pendiente?"
                  className="w-full resize-y border-none bg-transparent text-body-lg focus:ring-0 focus:outline-none"
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/30 pt-3">
                  <select
                    name="type"
                    defaultValue="whatsapp"
                    className="rounded-full border-none bg-surface-container px-4 py-2 text-body-md focus:ring-2 focus:ring-primary/20"
                  >
                    {ACTIVITY_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded-xl bg-primary px-5 py-2.5 text-label-md font-bold text-on-primary transition-all hover:bg-primary/90 active:scale-95"
                  >
                    Guardar contacto
                  </button>
                </div>
              </div>
              <details className="rounded-2xl border border-outline-variant/40 px-4 py-3">
                <summary className="cursor-pointer text-label-md font-semibold text-primary">
                  Programar proximo seguimiento en el mismo paso (opcional)
                </summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input
                    type="datetime-local"
                    name="nextScheduledAt"
                    className="rounded-xl border border-outline-variant px-3 py-2 text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  />
                  <input
                    name="nextObjective"
                    placeholder="Objetivo del proximo contacto"
                    className="rounded-xl border border-outline-variant px-3 py-2 text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  />
                </div>
              </details>
            </form>
          </section>

          <section className="card-premium rounded-xl p-5">
            <details>
              <summary className="flex flex-wrap cursor-pointer items-center gap-2 text-headline-sm font-bold">
                <span className="material-symbols-outlined text-green-600">chat</span>
                Plantillas de WhatsApp
                <span className="ml-auto hidden text-label-sm font-semibold text-on-surface-variant sm:inline">
                  Tocar para ver
                </span>
              </summary>
              <p className="mt-2 mb-4 text-body-md text-on-surface-variant">
                Abren el chat con el texto ya escrito. Vos lo revisas, lo editas si queres, y lo mandas.
                Nada se envia solo.
              </p>
              <ul className="space-y-3">
                {messageTemplates.map((template) => (
                  <li
                    key={template.id}
                    className="rounded-2xl border border-outline-variant/40 bg-surface-container-low/50 p-4"
                  >
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold">{template.label}</p>
                      <a
                        href={waLink(client.phone_normalized, template.text)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 rounded-full bg-green-600 px-4 py-1.5 text-label-sm font-bold text-white transition-all hover:bg-green-700 active:scale-95"
                      >
                        <span className="material-symbols-outlined text-sm">send</span>
                        Usar
                      </a>
                    </div>
                    <p className="text-label-sm text-on-surface-variant">{template.description}</p>
                    <p className="mt-2 rounded-xl bg-surface-container-lowest px-3 py-2 text-body-md italic">
                      &ldquo;{template.text}&rdquo;
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          </section>

          <section className="card-premium rounded-xl p-5">
            <h2 className="mb-4 text-headline-sm font-bold">Historial de actividad</h2>
            {timeline.length === 0 ? (
              <p className="text-body-md text-on-surface-variant">Todavia no hay actividad registrada.</p>
            ) : (
              <ol className="space-y-0">
                {timeline.map((event, index) => (
                  <li key={event.key} className="relative flex gap-4 pb-6">
                    {index < timeline.length - 1 ? (
                      <span className="absolute top-10 left-5 h-full w-px bg-outline-variant/50" />
                    ) : null}
                    <span
                      className={clsx(
                        "z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                        event.iconClasses,
                      )}
                    >
                      <span className="material-symbols-outlined text-lg">{event.icon}</span>
                    </span>
                    <div className="min-w-0 flex-1 rounded-2xl bg-surface-container-low/60 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-bold">{event.title}</p>
                        <p className="text-label-sm text-on-surface-variant">{formatDateTimeAr(event.at)}</p>
                      </div>
                      {event.detail ? (
                        <p className="mt-1 text-body-md whitespace-pre-wrap text-on-surface-variant">
                          {event.detail}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* Columna derecha: pendientes + programar */}
        <aside className="order-1 space-y-6 lg:col-span-2 xl:order-none xl:col-span-1">
          <section className="card-premium rounded-xl p-5">
            <h2 className="mb-4 flex flex-wrap items-center gap-2 text-headline-sm font-bold">
              Pendientes ({pendingActivities.length})
              {overdueCount > 0 ? (
                <span className="rounded-full bg-error px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-white uppercase">
                  {overdueCount} {overdueCount === 1 ? "vencido" : "vencidos"}
                </span>
              ) : null}
            </h2>
            {pendingActivities.length === 0 ? (
              <p className="text-body-md text-on-surface-variant">
                Sin seguimientos pendientes. Programa el proximo para no perder a este cliente.
              </p>
            ) : (
              <ul className="space-y-3">
                {pendingActivities.map((activity) => {
                  const overdue = activity.scheduled_at < nowIso;
                  const fichaPath = `/clients/${client.id}`;
                  const completeAction = completeActivityAction.bind(null, activity.id, client.id, fichaPath);
                  const rescheduleAction = rescheduleActivityAction.bind(null, activity.id, client.id, fichaPath);
                  const cancelAction = cancelActivityAction.bind(null, activity.id, client.id, fichaPath);

                  return (
                    <li
                      key={activity.id}
                      className={clsx(
                        "rounded-2xl border-l-4 p-4",
                        overdue
                          ? "border-error bg-error-container/20"
                          : "border-primary bg-surface-container-low/60",
                      )}
                    >
                      <p className="flex items-center gap-2 font-bold">
                        <span className="material-symbols-outlined text-lg">
                          {activityTypeIcon(activity.type)}
                        </span>
                        {activityTypeLabel(activity.type)}
                      </p>
                      <p className={clsx("text-body-md font-semibold", overdue ? "text-error" : "text-primary")}>
                        {formatDateTimeAr(activity.scheduled_at)}
                        {overdue ? " (vencido)" : ""}
                      </p>
                      {activity.objective ? (
                        <p className="mt-1 text-body-md text-on-surface-variant">{activity.objective}</p>
                      ) : null}
                      {activity.rescheduled_count > 0 ? (
                        <p className="mt-1 text-label-sm text-on-surface-variant">
                          Reprogramado {activity.rescheduled_count}{" "}
                          {activity.rescheduled_count === 1 ? "vez" : "veces"}
                        </p>
                      ) : null}

                      <details className="mt-3">
                        <summary className="cursor-pointer text-label-md font-bold text-primary">
                          Completar
                        </summary>
                        <form action={completeAction} className="mt-2 space-y-2">
                          <textarea
                            name="outcome"
                            required
                            rows={2}
                            placeholder="Que resulto del contacto?"
                            className="w-full rounded-xl border border-outline-variant px-3 py-2 text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                          />
                          <label className="block text-label-sm text-on-surface-variant">
                            Proximo seguimiento (opcional)
                            <input
                              type="datetime-local"
                              name="nextScheduledAt"
                              className="mt-1 w-full rounded-xl border border-outline-variant px-3 py-2 text-body-md focus:border-primary focus:outline-none"
                            />
                          </label>
                          <button
                            type="submit"
                            className="rounded-xl bg-primary px-4 py-2 text-label-md font-bold text-on-primary transition-all hover:bg-primary/90 active:scale-95"
                          >
                            Marcar realizada
                          </button>
                        </form>
                      </details>

                      <details className="mt-1.5">
                        <summary className="cursor-pointer text-label-md font-bold text-primary">
                          Reprogramar
                        </summary>
                        <form action={rescheduleAction} className="mt-2 space-y-2">
                          <input
                            type="datetime-local"
                            name="scheduledAt"
                            required
                            className="w-full rounded-xl border border-outline-variant px-3 py-2 text-body-md focus:border-primary focus:outline-none"
                          />
                          <button
                            type="submit"
                            className="rounded-xl bg-primary px-4 py-2 text-label-md font-bold text-on-primary transition-all hover:bg-primary/90 active:scale-95"
                          >
                            Guardar nueva fecha
                          </button>
                        </form>
                      </details>

                      <form action={cancelAction} className="mt-2">
                        <button type="submit" className="text-label-md font-bold text-error hover:underline">
                          Cancelar seguimiento
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section
            id="programar"
            className="scroll-mt-24 card-premium rounded-xl p-5"
          >
            <h2 className="mb-1 text-headline-sm font-bold">Programar seguimiento</h2>
            <p className="mb-4 text-body-md text-on-surface-variant">
              Agenda una accion futura para este cliente.
            </p>
            <form action={scheduleFollowUpAction.bind(null, client.id)} className="space-y-3">
              <select
                name="type"
                defaultValue="llamada"
                className="w-full rounded-xl border border-outline-variant px-3 py-2.5 text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              >
                {ACTIVITY_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                type="datetime-local"
                name="scheduledAt"
                defaultValue={defaultFollowUp}
                required
                className="w-full rounded-xl border border-outline-variant px-3 py-2.5 text-body-md focus:border-primary focus:outline-none"
              />
              <input
                name="objective"
                placeholder="Objetivo (ej: pasar precio del sillon)"
                className="w-full rounded-xl border border-outline-variant px-3 py-2.5 text-body-md focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-label-md font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.99]"
              >
                <span className="material-symbols-outlined text-base">event_available</span>
                Agendar
              </button>
            </form>
          </section>
        </aside>
      </div>

      {!client.archived_at ? (
        <section className="mt-6 rounded-xl border border-error/20 bg-error-container/10 p-5">
          <h2 className="mb-1 text-label-md font-bold tracking-wider text-error uppercase">Zona de riesgo</h2>
          <p className="mb-3 text-body-md text-on-surface-variant">
            Eliminar oculta a {client.first_name} del directorio y de la agenda, y cancela sus seguimientos
            pendientes. El historial se conserva y se puede restaurar despues desde la Papelera.
          </p>
          <form action={archiveClientAction.bind(null, client.id, "/clients")}>
            <ConfirmSubmitButton
              confirmMessage={`Eliminar a ${fullName}? Se cancelan sus seguimientos pendientes y se puede restaurar despues desde la Papelera.`}
              className="rounded-lg border border-error/40 px-4 py-2 text-xs font-bold tracking-widest text-error uppercase transition-colors hover:bg-error/10"
            >
              Eliminar cliente
            </ConfirmSubmitButton>
          </form>
        </section>
      ) : null}
    </AppShell>
  );
}
