import Link from "next/link";
import { redirect } from "next/navigation";
import clsx from "clsx";
import { createInterestAction, toggleInterestAction } from "@/app/admin/interests/actions";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUserContext } from "@/lib/auth/current-user";

type InterestsPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function InterestsAdminPage({ searchParams }: InterestsPageProps) {
  const params = await searchParams;
  const { supabase, profile } = await getCurrentUserContext();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const [{ data: interests, error }, { data: usageRows }] = await Promise.all([
    supabase.from("interests").select("id, name, active, created_at").order("name"),
    supabase
      .from("client_interests")
      .select("interest_id")
      .limit(5000)
      .returns<{ interest_id: string }[]>(),
  ]);

  if (error) {
    return (
      <AppShell profile={profile} title="Intereses">
        <p className="text-error">Error al cargar intereses: {error.message}</p>
      </AppShell>
    );
  }

  const usageByInterest = new Map<string, number>();
  for (const row of usageRows ?? []) {
    usageByInterest.set(row.interest_id, (usageByInterest.get(row.interest_id) ?? 0) + 1);
  }

  const activeInterests = (interests ?? []).filter((interest) => interest.active);
  const inactiveInterests = (interests ?? []).filter((interest) => !interest.active);

  return (
    <AppShell profile={profile} title="Intereses">
      <div className="mx-auto max-w-3xl">
        <section className="mb-6">
          <h1 className="text-headline-md font-bold lg:text-headline-lg">Catalogo de intereses</h1>
          <p className="text-body-lg text-on-surface-variant">
            Lo que los vendedores pueden marcar en cada cliente. Desactivar un interes lo oculta para
            clientes nuevos, sin borrar nada de los existentes.
          </p>
        </section>

        {params.error ? (
          <p className="mb-4 rounded-xl border border-error/30 bg-error-container/40 px-4 py-3 text-body-md font-medium text-on-error-container">
            {params.error}
          </p>
        ) : null}

        <form
          action={createInterestAction}
          className="card-premium mb-6 flex flex-wrap items-center gap-3 rounded-xl p-4"
        >
          <input
            name="name"
            required
            placeholder="Ej: Sillones, Colchones, Comedor..."
            className="min-w-52 flex-1 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3.5 py-2.5 text-sm focus:border-transparent focus:ring-1 focus:ring-primary focus:outline-none"
          />
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-xs font-bold tracking-widest text-on-primary uppercase shadow-sm transition-all hover:bg-on-surface-variant active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Agregar
          </button>
        </form>

        <section className="card-premium rounded-xl p-5 lg:p-6">
          <h2 className="mb-4 text-headline-sm font-bold">Activos ({activeInterests.length})</h2>
          {activeInterests.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">
              Todavia no hay intereses. Carga los rubros que se venden en el local: living, dormitorio,
              colchones, etc.
            </p>
          ) : (
            <ul className="space-y-2">
              {activeInterests.map((interest) => (
                <InterestRow
                  key={interest.id}
                  id={interest.id}
                  name={interest.name}
                  active={interest.active}
                  usageCount={usageByInterest.get(interest.id) ?? 0}
                />
              ))}
            </ul>
          )}

          {inactiveInterests.length > 0 ? (
            <details className="mt-6">
              <summary className="cursor-pointer text-label-md font-bold text-on-surface-variant">
                Desactivados ({inactiveInterests.length})
              </summary>
              <ul className="mt-3 space-y-2">
                {inactiveInterests.map((interest) => (
                  <InterestRow
                    key={interest.id}
                    id={interest.id}
                    name={interest.name}
                    active={interest.active}
                    usageCount={usageByInterest.get(interest.id) ?? 0}
                  />
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}

function InterestRow({
  id,
  name,
  active,
  usageCount,
}: {
  id: string;
  name: string;
  active: boolean;
  usageCount: number;
}) {
  return (
    <li
      className={clsx(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3",
        active
          ? "border-outline-variant/40 bg-surface-container-low/50"
          : "border-outline-variant/30 bg-surface-container-low/30 opacity-70",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={clsx(
            "material-symbols-outlined rounded p-1.5",
            active ? "bg-primary-container/10 text-primary" : "bg-surface-container-high text-on-surface-variant",
          )}
        >
          sell
        </span>
        <div>
          <p className="font-bold">{name}</p>
          <Link
            href={`/clients?interest=${id}`}
            className="text-label-sm text-on-surface-variant hover:text-primary hover:underline"
          >
            {usageCount} {usageCount === 1 ? "cliente" : "clientes"} con este interes
          </Link>
        </div>
      </div>
      <form action={toggleInterestAction}>
        <input type="hidden" name="interestId" value={id} />
        <input type="hidden" name="nextActive" value={active ? "false" : "true"} />
        <button
          type="submit"
          className={clsx(
            "rounded-lg px-4 py-2 text-[11px] font-bold tracking-wider uppercase transition-colors",
            active
              ? "border border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container"
              : "bg-primary text-on-primary hover:bg-on-surface-variant",
          )}
        >
          {active ? "Desactivar" : "Reactivar"}
        </button>
      </form>
    </li>
  );
}
