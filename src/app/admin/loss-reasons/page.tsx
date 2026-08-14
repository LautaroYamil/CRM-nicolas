import { redirect } from "next/navigation";
import clsx from "clsx";
import { createLossReasonAction, toggleLossReasonAction } from "@/app/admin/loss-reasons/actions";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUserContext } from "@/lib/auth/current-user";

type LossReasonsPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LossReasonsAdminPage({ searchParams }: LossReasonsPageProps) {
  const params = await searchParams;
  const { supabase, profile } = await getCurrentUserContext();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: reasons, error } = await supabase
    .from("loss_reasons")
    .select("id, name, active, created_at")
    .order("name");

  if (error) {
    return (
      <AppShell profile={profile} title="Motivos de perdida">
        <p className="text-error">Error al cargar motivos: {error.message}</p>
      </AppShell>
    );
  }

  const activeReasons = (reasons ?? []).filter((reason) => reason.active);
  const inactiveReasons = (reasons ?? []).filter((reason) => !reason.active);

  return (
    <AppShell profile={profile} title="Motivos de perdida">
      <div className="mx-auto max-w-3xl">
        <section className="mb-6">
          <h1 className="text-headline-md font-bold lg:text-headline-lg">Catalogo de motivos de perdida</h1>
          <p className="text-body-lg text-on-surface-variant">
            Las opciones que se piden al marcar un cliente como &quot;No interesado&quot;. Desactivar un
            motivo lo oculta para clientes nuevos, sin borrar nada de los existentes.
          </p>
        </section>

        {params.error ? (
          <p className="mb-4 rounded-xl border border-error/30 bg-error-container/40 px-4 py-3 text-body-md font-medium text-on-error-container">
            {params.error}
          </p>
        ) : null}

        <form
          action={createLossReasonAction}
          className="card-premium mb-6 flex flex-wrap items-center gap-3 rounded-xl p-4"
        >
          <input
            name="name"
            required
            placeholder="Ej: Financiacion, Precio..."
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
          <h2 className="mb-4 text-headline-sm font-bold">Activos ({activeReasons.length})</h2>
          {activeReasons.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">Todavia no hay motivos cargados.</p>
          ) : (
            <ul className="space-y-2">
              {activeReasons.map((reason) => (
                <ReasonRow key={reason.id} id={reason.id} name={reason.name} active={reason.active} />
              ))}
            </ul>
          )}

          {inactiveReasons.length > 0 ? (
            <details className="mt-6">
              <summary className="cursor-pointer text-label-md font-bold text-on-surface-variant">
                Desactivados ({inactiveReasons.length})
              </summary>
              <ul className="mt-3 space-y-2">
                {inactiveReasons.map((reason) => (
                  <ReasonRow key={reason.id} id={reason.id} name={reason.name} active={reason.active} />
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}

function ReasonRow({ id, name, active }: { id: string; name: string; active: boolean }) {
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
          sentiment_dissatisfied
        </span>
        <p className="font-bold">{name}</p>
      </div>
      <form action={toggleLossReasonAction}>
        <input type="hidden" name="reasonId" value={id} />
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
