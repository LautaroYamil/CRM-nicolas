import Link from "next/link";
import clsx from "clsx";
import { archiveClientAction } from "@/app/clients/actions";
import { AppShell } from "@/components/layout/app-shell";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
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
  nuevo: "border-outline-variant/40 bg-surface-container text-on-surface",
  interesado: "border-yellow-600/20 bg-yellow-50 text-yellow-800",
  en_seguimiento: "border-orange-600/20 bg-orange-50 text-orange-700",
  compro: "border-green-600/20 bg-green-50 text-green-700",
  no_interesado: "border-error/20 bg-error-container/20 text-error",
  inactivo: "border-outline-variant/40 bg-surface-container-high text-on-surface-variant",
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

        {/* Busqueda y filtros */}
        <section className="space-y-4">
          <form method="get" className="flex flex-wrap items-center gap-3">
            {params.status ? <input type="hidden" name="status" value={params.status} /> : null}
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
          <ul className="space-y-3 lg:hidden">
            {(clients ?? []).map((client) => {
              const clientName = `${client.first_name} ${client.last_name ?? ""}`.trim();
              const interests = interestsByClient.get(client.id) ?? [];
              const followUpOverdue =
                client.next_follow_up_at !== null && client.next_follow_up_at < nowIso;

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
                    <span
                      className={clsx(
                        "shrink-0 rounded border px-2 py-1 text-[10px] font-bold tracking-wider whitespace-nowrap uppercase",
                        STATUS_CHIP_CLASSES[client.status] ??
                          "border-outline-variant/40 bg-surface-container text-on-surface-variant",
                      )}
                    >
                      {clientStatusLabel(client.status)}
                    </span>
                  </div>
                  <div className="mt-2 space-y-0.5 text-sm">
                    <p className="text-on-surface-variant">
                      Ultimo contacto: {formatRelativeAr(client.last_contact_at)}
                    </p>
                    <p className={clsx(followUpOverdue ? "font-bold text-error" : "text-on-surface-variant")}>
                      Proximo: {formatDateTimeAr(client.next_follow_up_at)}
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
          <div className="hidden overflow-x-auto border-t border-outline-variant/30 lg:block">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="text-left text-[10px] font-bold tracking-[0.2em] text-on-surface-variant/60 uppercase">
                  <th className="py-5 pr-4">Cliente</th>
                  <th className="px-4 py-5">Intereses</th>
                  <th className="px-4 py-5">Ultimo contacto</th>
                  <th className="px-4 py-5">Proximo seguimiento</th>
                  <th className="px-4 py-5">Estado</th>
                  {profile.role === "admin" ? <th className="px-4 py-5">Vendedor</th> : null}
                  <th className="py-5 pl-4 text-right">Acciones</th>
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
                  const followUpOverdue =
                    client.next_follow_up_at !== null && client.next_follow_up_at < nowIso;

                  return (
                    <tr key={client.id} className="group transition-colors hover:bg-surface-container-low">
                      <td className="py-5 pr-4">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-primary-container/10 font-bold text-primary">
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
                      <td className="max-w-48 px-4 py-5 text-sm text-on-surface-variant">
                        <span className="block truncate">
                          {interests.length > 0 ? interests.join(", ") : "-"}
                        </span>
                      </td>
                      <td className="px-4 py-5 text-sm">{formatRelativeAr(client.last_contact_at)}</td>
                      <td
                        className={clsx(
                          "px-4 py-5 text-sm font-bold",
                          followUpOverdue
                            ? "text-error"
                            : client.next_follow_up_at
                              ? "text-on-surface"
                              : "font-normal text-on-surface-variant/60",
                        )}
                      >
                        {formatDateTimeAr(client.next_follow_up_at)}
                      </td>
                      <td className="px-4 py-5">
                        <span
                          className={clsx(
                            "inline-block rounded border px-2 py-1 text-[10px] font-bold tracking-wider whitespace-nowrap uppercase",
                            STATUS_CHIP_CLASSES[client.status] ??
                              "border-outline-variant/40 bg-surface-container text-on-surface-variant",
                          )}
                        >
                          {clientStatusLabel(client.status)}
                        </span>
                      </td>
                      {profile.role === "admin" ? (
                        <td className="px-4 py-5 text-sm font-semibold">
                          {sellersById.get(client.assigned_user_id) ?? "-"}
                        </td>
                      ) : null}
                      <td className="py-5 pl-4 text-right">
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
            <p className="text-sm text-on-surface-variant">
              Mostrando{" "}
              <span className="font-bold text-on-surface">
                {showingFrom} - {showingTo}
              </span>{" "}
              de <span className="font-bold text-on-surface">{total}</span> clientes
            </p>
            <div className="flex items-center gap-2">
              {hasPrev ? (
                <Link
                  href={`/clients${buildQuery({ ...baseParams, status: params.status, page: String(page - 1) })}`}
                  className="flex items-center rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-2 transition-colors hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-base">chevron_left</span>
                </Link>
              ) : null}
              <span className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-bold text-on-primary">
                {page}
              </span>
              {hasNext ? (
                <Link
                  href={`/clients${buildQuery({ ...baseParams, status: params.status, page: String(page + 1) })}`}
                  className="flex items-center rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-2 transition-colors hover:bg-surface-container"
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
