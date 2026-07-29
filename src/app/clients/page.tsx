import Link from "next/link";
import clsx from "clsx";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { CLIENT_STATUS_OPTIONS, clientStatusLabel } from "@/lib/crm/constants";
import { formatDateTimeAr, formatRelativeAr } from "@/lib/crm/dates";

const PAGE_SIZE = 25;

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

type ClientsPageProps = {
  searchParams: Promise<{
    search?: string;
    status?: string;
    seller?: string;
    page?: string;
  }>;
};

const STATUS_CHIP_CLASSES: Record<string, string> = {
  nuevo: "bg-primary-fixed text-primary",
  interesado: "bg-yellow-100 text-yellow-800",
  en_seguimiento: "bg-orange-100 text-orange-700",
  compro: "bg-green-100 text-green-700",
  no_interesado: "bg-error-container/60 text-on-error-container",
  inactivo: "bg-surface-container-high text-on-surface-variant",
};

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

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const params = await searchParams;
  const { supabase, profile } = await getCurrentUserContext();

  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

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
    .range(from, from + PAGE_SIZE - 1);

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

  const [{ data: clients, count: totalFiltered, error }, { data: statusRows }, { data: sellerRows }] =
    await Promise.all([
      query.returns<ClientRow[]>(),
      supabase.from("clients").select("status").is("archived_at", null).limit(2000).returns<{ status: string }[]>(),
      supabase.from("profiles").select("id, full_name").eq("active", true).returns<SellerRow[]>(),
    ]);

  if (error) {
    return (
      <AppShell profile={profile} title="Clientes">
        <p className="text-error">Error al cargar clientes: {error.message}</p>
      </AppShell>
    );
  }

  const clientIds = (clients ?? []).map((client) => client.id);
  const { data: interestRows } =
    clientIds.length > 0
      ? await supabase
          .from("client_interests")
          .select("client_id, interests(name)")
          .in("client_id", clientIds)
          .returns<InterestRow[]>()
      : { data: [] as InterestRow[] };

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

  const statusCounts = new Map<string, number>();
  for (const row of statusRows ?? []) {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
  }
  const totalClients = (statusRows ?? []).length;

  const total = totalFiltered ?? 0;
  const showingFrom = total === 0 ? 0 : from + 1;
  const showingTo = Math.min(from + PAGE_SIZE, total);
  const hasPrev = page > 1;
  const hasNext = showingTo < total;
  const nowIso = new Date().toISOString();

  const baseParams = { search: search || undefined, seller: params.seller };

  return (
    <AppShell profile={profile} title="Clientes">
      <section className="mb-6">
        <h1 className="text-headline-md font-bold lg:text-headline-lg">Directorio de clientes</h1>
        <p className="text-body-lg text-on-surface-variant">
          Gestiona y segmenta tu cartera de clientes.
        </p>
      </section>

      <div className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm lg:p-6">
        {/* Busqueda y filtros */}
        <form method="get" className="mb-4 flex flex-wrap items-center gap-3">
          {params.status ? <input type="hidden" name="status" value={params.status} /> : null}
          <div className="relative min-w-52 flex-1">
            <span className="material-symbols-outlined absolute top-1/2 left-3 -translate-y-1/2 text-outline">
              search
            </span>
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Buscar por nombre o telefono..."
              className="w-full rounded-full border-none bg-surface-container-low py-2.5 pr-4 pl-10 text-body-md focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {profile.role === "admin" ? (
            <select
              name="seller"
              defaultValue={params.seller ?? ""}
              className="rounded-full border-none bg-surface-container-low px-4 py-2.5 text-body-md focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Todos los vendedores</option>
              {(sellerRows ?? []).map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.full_name ?? seller.id}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="submit"
            className="rounded-full bg-primary px-5 py-2.5 text-label-md font-semibold text-on-primary transition-all hover:bg-primary/90 active:scale-95"
          >
            Buscar
          </button>
        </form>

        {/* Chips de estado */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Link
            href={`/clients${buildQuery(baseParams)}`}
            className={clsx(
              "rounded-full px-4 py-2 text-label-md font-semibold transition-colors",
              !params.status
                ? "bg-primary-fixed text-primary"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high",
            )}
          >
            Todos ({totalClients})
          </Link>
          {CLIENT_STATUS_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={`/clients${buildQuery({ ...baseParams, status: option.value })}`}
              className={clsx(
                "rounded-full px-4 py-2 text-label-md font-semibold transition-colors",
                params.status === option.value
                  ? "bg-primary-fixed text-primary"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high",
              )}
            >
              {option.label} ({statusCounts.get(option.value) ?? 0})
            </Link>
          ))}
        </div>

        {/* Tabla */}
        {(clients ?? []).length === 0 ? (
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low/50 p-10 text-center">
            <span className="material-symbols-outlined mb-2 text-4xl text-primary-container">person_search</span>
            <p className="font-semibold">No hay clientes con estos filtros</p>
            <p className="mb-4 text-body-md text-on-surface-variant">
              Proba con otra busqueda o carga un cliente nuevo.
            </p>
            <Link
              href="/clients/new"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-label-md font-semibold text-on-primary"
            >
              <span className="material-symbols-outlined text-base">person_add</span>
              Nuevo cliente
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-y-2 text-left">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <th className="rounded-l-lg px-4 py-3 text-label-md font-semibold text-on-surface-variant">Cliente</th>
                  <th className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">Intereses</th>
                  <th className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">Ultimo contacto</th>
                  <th className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">Proximo seguimiento</th>
                  <th className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">Estado</th>
                  {profile.role === "admin" ? (
                    <th className="px-4 py-3 text-label-md font-semibold text-on-surface-variant">Vendedor</th>
                  ) : null}
                  <th className="rounded-r-lg px-4 py-3 text-center text-label-md font-semibold text-on-surface-variant">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {(clients ?? []).map((client) => {
                  const clientName = `${client.first_name} ${client.last_name ?? ""}`.trim();
                  const initials = clientName
                    .split(/\s+/)
                    .map((word) => word[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  const interests = interestsByClient.get(client.id) ?? [];
                  const followUpOverdue =
                    client.next_follow_up_at !== null && client.next_follow_up_at < nowIso;

                  return (
                    <tr key={client.id} className="bg-surface-container-lowest transition-colors hover:bg-surface-container-low/30">
                      <td className="rounded-l-xl border-y border-l border-outline-variant/30 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-xs font-bold text-primary">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <Link href={`/clients/${client.id}`} className="block truncate font-bold hover:underline">
                              {clientName}
                            </Link>
                            <p className="truncate text-label-sm text-on-surface-variant">
                              {client.phone_normalized}
                              {client.locality ? ` - ${client.locality}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-48 border-y border-outline-variant/30 px-4 py-3 text-body-md text-on-surface-variant">
                        <span className="block truncate">{interests.length > 0 ? interests.join(", ") : "-"}</span>
                      </td>
                      <td className="border-y border-outline-variant/30 px-4 py-3 text-body-md">
                        {formatRelativeAr(client.last_contact_at)}
                      </td>
                      <td
                        className={clsx(
                          "border-y border-outline-variant/30 px-4 py-3 text-body-md font-semibold",
                          followUpOverdue ? "text-error" : client.next_follow_up_at ? "text-primary" : "text-on-surface-variant",
                        )}
                      >
                        {formatDateTimeAr(client.next_follow_up_at)}
                      </td>
                      <td className="border-y border-outline-variant/30 px-4 py-3">
                        <span
                          className={clsx(
                            "inline-block rounded-full px-3 py-1 text-[11px] font-bold whitespace-nowrap",
                            STATUS_CHIP_CLASSES[client.status] ?? "bg-surface-container text-on-surface-variant",
                          )}
                        >
                          {clientStatusLabel(client.status)}
                        </span>
                      </td>
                      {profile.role === "admin" ? (
                        <td className="border-y border-outline-variant/30 px-4 py-3 text-body-md">
                          {sellersById.get(client.assigned_user_id) ?? "-"}
                        </td>
                      ) : null}
                      <td className="rounded-r-xl border-y border-r border-outline-variant/30 px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
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
                          <Link
                            href={`/clients/${client.id}/edit`}
                            title="Editar"
                            className="rounded-full bg-surface-container p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginacion */}
        {total > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-container-low/50 px-4 py-3">
            <p className="text-body-md text-on-surface-variant">
              Mostrando <span className="font-bold text-on-surface">{showingFrom} - {showingTo}</span> de{" "}
              <span className="font-bold text-on-surface">{total}</span> clientes
            </p>
            <div className="flex items-center gap-2">
              {hasPrev ? (
                <Link
                  href={`/clients${buildQuery({ ...baseParams, status: params.status, page: String(page - 1) })}`}
                  className="flex items-center rounded-lg border border-outline-variant bg-surface-container-lowest p-2 transition-colors hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-base">chevron_left</span>
                </Link>
              ) : null}
              <span className="rounded-lg bg-primary px-3.5 py-1.5 text-label-md font-bold text-on-primary">
                {page}
              </span>
              {hasNext ? (
                <Link
                  href={`/clients${buildQuery({ ...baseParams, status: params.status, page: String(page + 1) })}`}
                  className="flex items-center rounded-lg border border-outline-variant bg-surface-container-lowest p-2 transition-colors hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-base">chevron_right</span>
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
