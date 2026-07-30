import Link from "next/link";
import { permanentlyDeleteClientAction, restoreClientAction } from "@/app/clients/actions";
import { AppShell } from "@/components/layout/app-shell";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { formatDateTimeAr } from "@/lib/crm/dates";

type ArchivedClientRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  phone_normalized: string;
  archived_at: string;
};

type TrashPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ClientsTrashPage({ searchParams }: TrashPageProps) {
  const { error: errorMessage } = await searchParams;
  const { supabase, profile } = await getCurrentUserContext();

  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, first_name, last_name, phone_normalized, archived_at")
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false })
    .returns<ArchivedClientRow[]>();

  if (error) {
    return (
      <AppShell profile={profile} title="Papelera">
        <p className="text-error">Error al cargar la papelera: {error.message}</p>
      </AppShell>
    );
  }

  return (
    <AppShell profile={profile} title="Papelera">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-headline-md font-bold tracking-tight lg:text-headline-xl">Papelera</h1>
            <p className="mt-1 font-medium text-on-surface-variant">
              Clientes eliminados. Se pueden restaurar en cualquier momento.
            </p>
          </div>
          <Link
            href="/clients"
            className="flex items-center gap-1.5 rounded-lg border border-outline-variant/40 px-3 py-2 text-xs font-bold tracking-wider text-on-surface-variant uppercase transition-colors hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Volver al directorio
          </Link>
        </div>

        {errorMessage ? (
          <p className="rounded-lg border border-error/30 bg-error-container/40 px-4 py-3 text-body-md font-medium text-on-error-container">
            {errorMessage}
          </p>
        ) : null}

        {(clients ?? []).length === 0 ? (
          <div className="card-premium rounded-xl p-10 text-center">
            <span className="material-symbols-outlined mb-2 text-4xl text-on-surface-variant/40">
              delete
            </span>
            <p className="font-bold">La papelera esta vacia</p>
            <p className="text-body-md text-on-surface-variant">
              Los clientes que elimines desde su ficha o el directorio van a aparecer aca.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {(clients ?? []).map((client) => {
              const clientName = `${client.first_name} ${client.last_name ?? ""}`.trim();

              return (
                <li
                  key={client.id}
                  className="card-premium flex flex-wrap items-center justify-between gap-3 rounded-xl p-4"
                >
                  <div>
                    <p className="font-bold">{clientName}</p>
                    <p className="text-sm text-on-surface-variant">
                      {client.phone_normalized} - Eliminado el {formatDateTimeAr(client.archived_at)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={restoreClientAction.bind(null, client.id, "/clients/trash")}>
                      <button
                        type="submit"
                        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold tracking-widest text-on-primary uppercase transition-all hover:bg-on-surface-variant active:scale-[0.98]"
                      >
                        <span className="material-symbols-outlined text-[18px]">restore_from_trash</span>
                        Restaurar
                      </button>
                    </form>
                    {profile.role === "admin" ? (
                      <form action={permanentlyDeleteClientAction.bind(null, client.id)}>
                        <ConfirmSubmitButton
                          confirmMessage={`Eliminar definitivamente a ${clientName}? Esta accion no se puede deshacer: se pierde todo su historial, seguimientos e intereses.`}
                          className="rounded-lg border border-error/40 px-4 py-2 text-xs font-bold tracking-widest text-error uppercase transition-colors hover:bg-error/10"
                        >
                          Eliminar definitivo
                        </ConfirmSubmitButton>
                      </form>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
