import { redirect } from "next/navigation";
import clsx from "clsx";
import { createContactObjectiveAction, toggleContactObjectiveAction } from "@/app/admin/contact-objectives/actions";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUserContext } from "@/lib/auth/current-user";

type ContactObjectivesPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ContactObjectivesAdminPage({ searchParams }: ContactObjectivesPageProps) {
  const params = await searchParams;
  const { supabase, profile } = await getCurrentUserContext();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: objectives, error } = await supabase
    .from("contact_objectives")
    .select("id, name, active, created_at")
    .order("name");

  if (error) {
    return (
      <AppShell profile={profile} title="Objetivos de contacto">
        <p className="text-error">Error al cargar objetivos: {error.message}</p>
      </AppShell>
    );
  }

  const activeObjectives = (objectives ?? []).filter((objective) => objective.active);
  const inactiveObjectives = (objectives ?? []).filter((objective) => !objective.active);

  return (
    <AppShell profile={profile} title="Objetivos de contacto">
      <div className="mx-auto max-w-3xl">
        <section className="mb-6">
          <h1 className="text-headline-md font-bold lg:text-headline-lg">Catalogo de objetivos</h1>
          <p className="text-body-lg text-on-surface-variant">
            Las opciones que aparecen al programar un proximo seguimiento (ademas de &quot;Otro&quot;, que
            siempre queda disponible para casos puntuales). Desactivar un objetivo lo oculta para
            seguimientos nuevos, sin borrar nada de los existentes.
          </p>
        </section>

        {params.error ? (
          <p className="mb-4 rounded-xl border border-error/30 bg-error-container/40 px-4 py-3 text-body-md font-medium text-on-error-container">
            {params.error}
          </p>
        ) : null}

        <form
          action={createContactObjectiveAction}
          className="card-premium mb-6 flex flex-wrap items-center gap-3 rounded-xl p-4"
        >
          <input
            name="name"
            required
            placeholder="Ej: Confirmar medidas, Coordinar flete..."
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
          <h2 className="mb-4 text-headline-sm font-bold">Activos ({activeObjectives.length})</h2>
          {activeObjectives.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">
              Todavia no hay objetivos cargados. Con &quot;Otro&quot; los vendedores siguen pudiendo
              escribir uno libre mientras tanto.
            </p>
          ) : (
            <ul className="space-y-2">
              {activeObjectives.map((objective) => (
                <ObjectiveRow key={objective.id} id={objective.id} name={objective.name} active={objective.active} />
              ))}
            </ul>
          )}

          {inactiveObjectives.length > 0 ? (
            <details className="mt-6">
              <summary className="cursor-pointer text-label-md font-bold text-on-surface-variant">
                Desactivados ({inactiveObjectives.length})
              </summary>
              <ul className="mt-3 space-y-2">
                {inactiveObjectives.map((objective) => (
                  <ObjectiveRow
                    key={objective.id}
                    id={objective.id}
                    name={objective.name}
                    active={objective.active}
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

function ObjectiveRow({ id, name, active }: { id: string; name: string; active: boolean }) {
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
          flag
        </span>
        <p className="font-bold">{name}</p>
      </div>
      <form action={toggleContactObjectiveAction}>
        <input type="hidden" name="objectiveId" value={id} />
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
