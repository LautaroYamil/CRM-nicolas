import Link from "next/link";
import clsx from "clsx";
import { archiveClientAction } from "@/app/clients/actions";
import { AppShell } from "@/components/layout/app-shell";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { CLIENT_STATUS_OPTIONS, clientStatusChipClasses, clientStatusLabel } from "@/lib/crm/constants";
import { formatDateTimeAr, formatRelativeAr, isoDaysAgo } from "@/lib/crm/dates";
import { isOverdue } from "@/lib/crm/overdue";
import { getClientStatusCounts } from "@/lib/crm/queries";

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

type ClientRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  phone_normalized: string;
  status: string;
  locality: string | null;
  assigned_user_id: string;
  last_contact_at: string | null;
  next_follow_up_at: string | null;
  created_at: string;
};

type InterestRow = {
  client_id: string;
  interests: { name: string } | null;
};

type SellerRow = {
  id: string;
  full_name: string | null;
};

type InterestOption = {
  id: string;
  name: string;
};

type ClientsPageProps = {
  searchParams: Promise<{
    search?: string;
    status?: string;
    seller?: string;
    interest?: string;
    page?: string;
    pageSize?: string;
  }>;
};

const SOON_WINDOW_MS = 48 * 60 * 60 * 1000;

type FollowUpUrgency = "overdue" | "soon" | "scheduled" | "none";

function followUpUrgency(nextFollowUpAt: string | null, nowIso: string): FollowUpUrgency {
  if (!nextFollowUpAt) {
    return "none";
  }

  if (nextFollowUpAt < nowIso) {
    return "overdue";
  }

  const isSoon = new Date(nextFollowUpAt).getTime() - new Date(nowIso).getTime() <= SOON_WINDOW_MS;
  return isSoon ? "soon" : "scheduled";
}

/** Punto + fondo del "Proximo seguimiento": vencido, por vencer (48hs), agendado, o sin agendar. */
function followUpBadgeClasses(urgency: FollowUpUrgency) {
  switch (urgency) {
    case "overdue":
      return "bg-error-container/30 text-error font-bold";
    case "soon":
      return "bg-secondary-fixed/35 text-on-secondary-fixed font-semibold";
    case "scheduled":
      return "text-on-surface";
    case "none":
      return "text-on-surface-variant/60";
  }
}

function followUpDotClasses(urgency: FollowUpUrgency) {
  switch (urgency) {
    case "overdue":
      return "bg-error";
    case "soon":
      return "bg-secondary";
    case "scheduled":
      return "bg-outline";
    case "none":
      return "bg-outline-variant/50";
  }
}

// Paleta chica para variar el color del avatar de cada cliente -solo estetico
// (determinista por id, asi el mismo cliente siempre tiene el mismo color),
// no representa ningun dato real.
const AVATAR_PALETTE = [
  "bg-primary-container/10 text-primary",
  "bg-secondary-fixed/45 text-on-secondary-fixed",
  "bg-error-container/25 text-on-error-container",
  "bg-green-50 text-green-700",
  "bg-surface-container-high text-on-surface-variant",
];

function hashToIndex(value: string, mod: number) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash % mod;
}

function avatarClasses(clientId: string) {
  return AVATAR_PALETTE[hashToIndex(clientId, AVATAR_PALETTE.length)];
}

function buildQuery(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value);
    }
  }

  const text = query.toString();
  return text ? `?${text}` : "";
}

/** Ventana de numeros de pagina a mostrar, con "..." para los saltos grandes. */
function buildPageWindow(current: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const keep = new Set(
    [1, totalPages, current - 1, current, current + 1].filter((p) => p >= 1 && p <= totalPages),
  );
  const sorted = Array.from(keep).sort((a, b) => a - b);

  const result: (number | "...")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      result.push("...");
    }
    result.push(sorted[i]);
  }
  return result;
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const params = await searchParams;
  const { supabase, profile } = await getCurrentUserContext();

  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(params.pageSize))
    ? Number(params.pageSize)
    : DEFAULT_PAGE_SIZE;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const from = (page - 1) * pageSize;
  const nowIso = new Date().toISOString();

  // PostgREST usa comas y parentesis como sintaxis en .or(): se quitan del texto buscado
  const search = (params.search ?? "").replace(/[,()"'\\]/g, " ").trim();

  let query = supabase
    .from("clients")
    .select(
      "id, first_name, last_name, phone_normalized, status, locality, assigned_user_id, last_contact_at, next_follow_up_at, created_at",
      { count: "exact" },
    )
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (params.status) {
    query = query.eq("status", params.status);
  }

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone_normalized.ilike.%${search}%`,
    );
  }

  if (profile.role === "admin" && params.seller) {
    query = query.eq("assigned_user_id", params.seller);
  }

  if (params.interest) {
    const { data: matchingInterestRows } = await supabase
      .from("client_interests")
      .select("client_id")
      .eq("interest_id", params.interest)
      .returns<{ client_id: string }[]>();

    const matchingClientIds = (matchingInterestRows ?? []).map((row) => row.client_id);
    query = query.in(
      "id",
      matchingClientIds.length > 0 ? matchingClientIds : ["00000000-0000-0000-0000-000000000000"],
    );
  }

  // Clientes cuyo seguimiento mas proximo (next_follow_up_at, sincronizado desde
  // activities por trigger) ya paso. Mismo concepto de "vencido" que Agenda,
  // pero a nivel cliente (un cliente vencido, no un conteo de actividades).
  let overdueFollowUpQuery = supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .is("archived_at", null)
    .not("next_follow_up_at", "is", null)
    .lt("next_follow_up_at", nowIso);

  if (profile.role === "admin" && params.seller) {
    overdueFollowUpQuery = overdueFollowUpQuery.eq("assigned_user_id", params.seller);
  }

  const since30Iso = isoDaysAgo(30);

  let convertedLast30Query = supabase
    .from("client_status_changes")
    .select("id, clients!inner(assigned_user_id)", { count: "exact", head: true })
    .eq("new_status", "compro")
    .gte("created_at", since30Iso);

  if (profile.role === "admin" && params.seller) {
    convertedLast30Query = convertedLast30Query.eq("clients.assigned_user_id", params.seller);
  }

  const [
    { data: clients, count: totalFiltered, error },
    statusCountsResult,
    { data: sellerRows },
    { data: interestOptions },
    { count: overdueFollowUpCount },
    { count: convertedLast30Count },
  ] = await Promise.all([
    query.returns<ClientRow[]>(),
    getClientStatusCounts(supabase),
    supabase.from("profiles").select("id, full_name").eq("active", true).returns<SellerRow[]>(),
    supabase.from("interests").select("id, name").eq("active", true).order("name").returns<InterestOption[]>(),
    overdueFollowUpQuery,
    convertedLast30Query,
  ]);

  if (error) {
    return (
      <AppShell profile={profile} title="Clientes">
        <p className="text-error">Error al cargar clientes: {error.message}</p>
      </AppShell>
    );
  }

  const clientIds = (clients ?? []).map((client) => client.id);
  const [{ data: interestRows }, { data: purchaseRows }] =
    clientIds.length > 0
      ? await Promise.all([
          supabase
            .from("client_interests")
            .select("client_id, interests(name)")
            .in("client_id", clientIds)
            .returns<InterestRow[]>(),
          supabase
            .from("client_purchases")
            .select("client_id")
            .in("client_id", clientIds)
            .returns<{ client_id: string }[]>(),
        ])
      : [{ data: [] as InterestRow[] }, { data: [] as { client_id: string }[] }];

  const sellersById = new Map((sellerRows ?? []).map((seller) => [seller.id, seller.full_name ?? "Vendedor"]));

  const interestsByClient = new Map<string, string[]>();
  for (const row of interestRows ?? []) {
    if (!row.interests?.name) {
      continue;
    }

    const existing = interestsByClient.get(row.client_id) ?? [];
    existing.push(row.interests.name);
    interestsByClient.set(row.client_id, existing);
  }

  const purchaseCountByClient = new Map<string, number>();
  for (const row of purchaseRows ?? []) {
    purchaseCountByClient.set(row.client_id, (purchaseCountByClient.get(row.client_id) ?? 0) + 1);
  }

  const statusCounts = statusCountsResult.counts;
  const totalClients = statusCountsResult.total;

  const total = totalFiltered ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showingFrom = total === 0 ? 0 : from + 1;
  const showingTo = Math.min(from + pageSize, total);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const pageSizeParam = pageSize !== DEFAULT_PAGE_SIZE ? String(pageSize) : undefined;
  const baseParams = {
    search: search || undefined,
    seller: params.seller,
    interest: params.interest,
    pageSize: pageSizeParam,
  };

  return (
    <AppShell profile={profile} title="Clientes">
      <div className="space-y-8">
        <section className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-headline-md font-bold tracking-tight lg:text-headline-xl">
              Directorio de Clientes
            </h1>
            <p className="mt-1 font-medium text-on-surface-variant">
              Gestiona y segmenta tu cartera de clientes.
            </p>
          </div>
          <Link
            href="/clients/trash"
            className="flex items-center gap-1.5 rounded-lg border border-outline-variant/40 px-3 py-2 text-xs font-bold tracking-wider text-on-surface-variant uppercase transition-colors hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-base">delete</span>
            Papelera
          </Link>
        </section>

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card-premium rounded-xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-[0.15em] text-on-surface-variant/60 uppercase">
                Cartera activa
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-high text-on-surface-variant">
                <span className="material-symbols-outlined text-[18px]">groups</span>
              </span>
            </div>
            <p className="mt-2 text-headline-sm font-bold text-on-surface">{totalClients}</p>
            <p className="mt-1 text-[11px] text-on-surface-variant/70">Total registrados en el sistema</p>
          </div>

          <div className="card-premium rounded-xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-[0.15em] text-on-surface-variant/60 uppercase">
                Sin contactar
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary-fixed/45 text-on-secondary-fixed">
                <span className="material-symbols-outlined text-[18px]">schedule</span>
              </span>
            </div>
            <p className="mt-2 text-headline-sm font-bold text-on-surface">{statusCounts.get("nuevo") ?? 0}</p>
            <p className="mt-1 text-[11px] text-on-surface-variant/70">En estado Nuevo, sin primer contacto</p>
          </div>

          <div className="card-premium rounded-xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-[0.15em] text-on-surface-variant/60 uppercase">
                Clientes vencidos
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-error-container/30 text-error">
                <span className="material-symbols-outlined text-[18px]">warning</span>
              </span>
            </div>
            <p
              className={clsx(
                "mt-2 text-headline-sm font-bold",
                (overdueFollowUpCount ?? 0) > 0 ? "text-error" : "text-on-surface",
              )}
            >
              {overdueFollowUpCount ?? 0}
            </p>
            <p className="mt-1 text-[11px] text-on-surface-variant/70">Seguimiento pendiente ya vencido</p>
          </div>

          <div className="card-premium rounded-xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-[0.15em] text-on-surface-variant/60 uppercase">
                Convertidos (30 dias)
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-700">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
              </span>
            </div>
            <p className="mt-2 text-headline-sm font-bold text-on-surface">{convertedLast30Count ?? 0}</p>
            <p className="mt-1 text-[11px] text-on-surface-variant/70">Pasaron a Compro en los ultimos 30 dias</p>
          </div>
        </div>

        {/* Busqueda y filtros */}
        <section className="space-y-4 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 sm:p-5">
          <form method="get" className="flex flex-wrap items-center gap-3">
            {params.status ? <input type="hidden" name="status" value={params.status} /> : null}
            {pageSizeParam ? <input type="hidden" name="pageSize" value={pageSizeParam} /> : null}
            <div className="relative min-w-52 flex-1">
              <span className="material-symbols-outlined absolute top-1/2 left-4 -translate-y-1/2 text-on-surface-variant/60">
                search
              </span>
              <input
                type="text"
                name="search"
                defaultValue={search}
                placeholder="Buscar por nombre o telefono..."
                className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest py-2.5 pr-4 pl-11 text-sm transition-all focus:border-transparent focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>
            {profile.role === "admin" ? (
              <select
                name="seller"
                defaultValue={params.seller ?? ""}
                className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value="">Todos los vendedores</option>
                {(sellerRows ?? []).map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.full_name ?? seller.id}
                  </option>
                ))}
              </select>
            ) : null}
            <select
              name="interest"
              defaultValue={params.interest ?? ""}
              className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="">Todos los intereses</option>
              {(interestOptions ?? []).map((interest) => (
                <option key={interest.id} value={interest.id}>
                  {interest.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg bg-primary px-6 py-2.5 text-xs font-bold tracking-widest text-on-primary uppercase shadow-sm transition-all hover:bg-on-surface-variant active:scale-[0.98]"
            >
              Buscar
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/clients${buildQuery(baseParams)}`}
              className={clsx(
                "rounded-lg px-4 py-2 text-[11px] font-bold tracking-wider uppercase transition-colors",
                !params.status
                  ? "bg-primary text-on-primary"
                  : "border border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container",
              )}
            >
              Todos ({totalClients})
            </Link>
            {CLIENT_STATUS_OPTIONS.map((option) => (
              <Link
                key={option.value}
                href={`/clients${buildQuery({ ...baseParams, status: option.value })}`}
                className={clsx(
                  "rounded-lg px-4 py-2 text-[11px] font-bold tracking-wider uppercase transition-colors",
                  params.status === option.value
                    ? "bg-primary text-on-primary"
                    : "border border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container",
                )}
              >
                {option.label} ({statusCounts.get(option.value) ?? 0})
              </Link>
            ))}
          </div>
        </section>

        {/* Tabla */}
        {(clients ?? []).length === 0 ? (
          <div className="card-premium rounded-xl p-10 text-center">
            <span className="material-symbols-outlined mb-2 text-4xl text-on-surface-variant/40">
              person_search
            </span>
            <p className="font-bold">No hay clientes con estos filtros</p>
            <p className="mb-5 text-body-md text-on-surface-variant">
              Proba con otra busqueda o carga un cliente nuevo.
            </p>
            <Link
              href="/clients/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-xs font-bold tracking-widest text-on-primary uppercase"
            >
              <span className="material-symbols-outlined text-[20px]">person_add</span>
              Nuevo cliente
            </Link>
          </div>
        ) : (
          <>
          {/* Tarjetas (celular) */}
          <ul className="space-y-3 xl:hidden">
            {(clients ?? []).map((client) => {
              const clientName = `${client.first_name} ${client.last_name ?? ""}`.trim();
              const interests = interestsByClient.get(client.id) ?? [];
              const purchaseCount = purchaseCountByClient.get(client.id) ?? 0;
              const urgency = followUpUrgency(client.next_follow_up_at, nowIso);
              const followUpOverdue =
                client.next_follow_up_at !== null && isOverdue(client.next_follow_up_at, nowIso);

              return (
                <li key={client.id} className="card-premium rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/clients/${client.id}`} className="block truncate font-bold">
                        {clientName}
                      </Link>
                      <p className="truncate text-xs text-on-surface-variant/70">
                        {client.phone_normalized}
                        {client.locality ? ` - ${client.locality}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={clsx(
                          "rounded border px-2 py-1 text-[10px] font-bold tracking-wider whitespace-nowrap uppercase",
                          clientStatusChipClasses(client.status),
                        )}
                      >
                        {clientStatusLabel(client.status)}
                      </span>
                      {purchaseCount >= 2 ? (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold tracking-wider text-on-primary uppercase">
                          Frecuente
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2 space-y-0.5 text-sm">
                    <p className="text-on-surface-variant">
                      Ultimo contacto: {formatRelativeAr(client.last_contact_at)}
                    </p>
                    <p
                      className={clsx(
                        "inline-flex items-center gap-1.5 rounded px-1.5 py-0.5",
                        followUpBadgeClasses(urgency),
                        followUpOverdue ? "font-bold" : "",
                      )}
                    >
                      <span className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", followUpDotClasses(urgency))} />
                      Proximo: {formatDateTimeAr(client.next_follow_up_at)}
                    </p>
                    <p className="text-on-surface-variant">
                      Compras: <span className="font-semibold">{purchaseCount}</span>
                    </p>
                    {interests.length > 0 ? (
                      <p className="truncate text-on-surface-variant">{interests.join(", ")}</p>
                    ) : null}
                    {profile.role === "admin" ? (
                      <p className="text-on-surface-variant">
                        Vendedor: {sellersById.get(client.assigned_user_id) ?? "-"}
                      </p>
                    ) : null}
                  </div>
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
                    <Link
                      href={`/clients/${client.id}/edit`}
                      className="flex items-center justify-center rounded-lg border border-outline-variant/40 px-3 py-2"
                      title="Editar"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </Link>
                    <form action={archiveClientAction.bind(null, client.id, "/clients")} className="contents">
                      <ConfirmSubmitButton
                        confirmMessage={`Eliminar a ${clientName}? Se cancelan sus seguimientos pendientes y se puede restaurar despues desde la Papelera.`}
                        title="Eliminar"
                        className="flex items-center justify-center rounded-lg border border-outline-variant/40 px-3 py-2 transition-colors hover:border-error/40 hover:text-error"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Tabla (desktop) */}
          <div className="hidden overflow-x-auto rounded-xl border border-outline-variant/30 bg-surface-container-lowest xl:block">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-outline-variant/20 bg-surface-container-low/50 text-left text-[10px] font-bold tracking-[0.2em] text-on-surface-variant/60 uppercase">
                  <th className="py-5 pr-4 pl-5">Cliente</th>
                  <th className="px-4 py-5">Intereses</th>
                  <th className="px-4 py-5">Ultimo contacto</th>
                  <th className="px-4 py-5">Proximo seguimiento</th>
                  <th className="px-4 py-5">Estado</th>
                  <th className="px-4 py-5">Compras</th>
                  {profile.role === "admin" ? <th className="px-4 py-5">Vendedor</th> : null}
                  <th className="py-5 pr-5 pl-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {(clients ?? []).map((client) => {
                  const clientName = `${client.first_name} ${client.last_name ?? ""}`.trim();
                  const initials = clientName
                    .split(/\s+/)
                    .map((word) => word[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  const interests = interestsByClient.get(client.id) ?? [];
                  const purchaseCount = purchaseCountByClient.get(client.id) ?? 0;
                  const urgency = followUpUrgency(client.next_follow_up_at, nowIso);
                  const sellerName = sellersById.get(client.assigned_user_id) ?? "-";

                  return (
                    <tr key={client.id} className="group transition-colors hover:bg-surface-container-low">
                      <td className="py-4 pr-4 pl-5">
                        <div className="flex items-center gap-3">
                          <div
                            className={clsx(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold",
                              avatarClasses(client.id),
                            )}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/clients/${client.id}`}
                              className="block truncate font-bold text-on-surface transition-colors group-hover:text-primary hover:underline"
                            >
                              {clientName}
                            </Link>
                            <p className="truncate text-xs text-on-surface-variant/70">
                              {client.phone_normalized}
                              {client.locality ? ` - ${client.locality}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-48 px-4 py-4 text-sm text-on-surface-variant">
                        <span className="block truncate">
                          {interests.length > 0 ? interests.join(", ") : "-"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm">{formatRelativeAr(client.last_contact_at)}</td>
                      <td className="px-4 py-4 text-sm">
                        <span
                          className={clsx(
                            "inline-flex items-center gap-1.5 rounded px-2 py-1",
                            followUpBadgeClasses(urgency),
                          )}
                        >
                          <span
                            className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", followUpDotClasses(urgency))}
                          />
                          {formatDateTimeAr(client.next_follow_up_at)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={clsx(
                            "inline-block rounded border px-2 py-1 text-[10px] font-bold tracking-wider whitespace-nowrap uppercase",
                            clientStatusChipClasses(client.status),
                          )}
                        >
                          {clientStatusLabel(client.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{purchaseCount}</span>
                          {purchaseCount >= 2 ? (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold tracking-wider text-on-primary uppercase">
                              Frecuente
                            </span>
                          ) : null}
                        </div>
                      </td>
                      {profile.role === "admin" ? (
                        <td className="px-4 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-on-primary">
                              {sellerName.charAt(0).toUpperCase()}
                            </span>
                            <span className="font-semibold">{sellerName}</span>
                          </div>
                        </td>
                      ) : null}
                      <td className="py-4 pr-5 pl-4 text-right">
                        <div className="flex justify-end gap-3 opacity-60 transition-opacity group-hover:opacity-100">
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
                          <Link
                            href={`/clients/${client.id}/edit`}
                            title="Editar"
                            className="p-2 transition-colors hover:text-primary"
                          >
                            <span className="material-symbols-outlined">edit</span>
                          </Link>
                          <form action={archiveClientAction.bind(null, client.id, "/clients")} className="contents">
                            <ConfirmSubmitButton
                              confirmMessage={`Eliminar a ${clientName}? Se cancelan sus seguimientos pendientes y se puede restaurar despues desde la Papelera.`}
                              title="Eliminar"
                              className="p-2 transition-colors hover:text-error"
                            >
                              <span className="material-symbols-outlined">delete</span>
                            </ConfirmSubmitButton>
                          </form>
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

        {/* Paginacion */}
        {total > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/20 pt-4">
            <div className="flex flex-wrap items-center gap-3 text-sm text-on-surface-variant">
              <p>
                Mostrando{" "}
                <span className="font-bold text-on-surface">
                  {showingFrom} - {showingTo}
                </span>{" "}
                de <span className="font-bold text-on-surface">{total}</span> clientes
              </p>
              <form method="get" className="flex items-center gap-1.5 text-xs">
                {params.status ? <input type="hidden" name="status" value={params.status} /> : null}
                {search ? <input type="hidden" name="search" value={search} /> : null}
                {profile.role === "admin" && params.seller ? (
                  <input type="hidden" name="seller" value={params.seller} />
                ) : null}
                {params.interest ? <input type="hidden" name="interest" value={params.interest} /> : null}
                <span>Ver</span>
                <select
                  name="pageSize"
                  defaultValue={String(pageSize)}
                  className="rounded border border-outline-variant/40 bg-surface-container-lowest px-2 py-1 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <span>por pag.</span>
                <button
                  type="submit"
                  className="rounded border border-outline-variant/40 px-2 py-1 text-[10px] font-bold uppercase transition-colors hover:bg-surface-container"
                >
                  Aplicar
                </button>
              </form>
            </div>
            <nav className="flex flex-wrap items-center gap-1.5">
              {hasPrev ? (
                <Link
                  href={`/clients${buildQuery({ ...baseParams, status: params.status, page: String(page - 1) })}`}
                  className="flex items-center rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-2 transition-colors hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-base">chevron_left</span>
                </Link>
              ) : null}
              {buildPageWindow(page, totalPages).map((p, index) =>
                p === "..." ? (
                  <span key={`ellipsis-${index}`} className="px-1 text-sm text-on-surface-variant/50">
                    …
                  </span>
                ) : (
                  <Link
                    key={p}
                    href={`/clients${buildQuery({ ...baseParams, status: params.status, page: String(p) })}`}
                    className={clsx(
                      "flex min-w-9 items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-bold",
                      p === page
                        ? "bg-primary text-on-primary"
                        : "border border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container",
                    )}
                  >
                    {p}
                  </Link>
                ),
              )}
              {hasNext ? (
                <Link
                  href={`/clients${buildQuery({ ...baseParams, status: params.status, page: String(page + 1) })}`}
                  className="flex items-center rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-2 transition-colors hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-base">chevron_right</span>
                </Link>
              ) : null}
            </nav>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
