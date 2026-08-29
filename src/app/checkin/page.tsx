import Link from "next/link";
import { checkinExistingAction, checkinNewAction } from "@/app/checkin/actions";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { clientStatusChipClasses, clientStatusLabel } from "@/lib/crm/constants";

type CheckinPageProps = {
  searchParams: Promise<{ event?: string; q?: string; error?: string; done?: string }>;
};

type MatchRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  phone_normalized: string;
  status: string;
  event_tag: string | null;
};

const inputClasses =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3.5 text-lg focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none";

export default async function CheckinPage({ searchParams }: CheckinPageProps) {
  const params = await searchParams;
  const { supabase, profile } = await getCurrentUserContext();

  const eventTag = (params.event ?? "").trim();
  const query = (params.q ?? "").trim();
  const redirectBase = eventTag ? `/checkin?event=${encodeURIComponent(eventTag)}` : "/checkin";

  const eventCount = eventTag
    ? (
        await supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("event_tag", eventTag)
          .is("archived_at", null)
      ).count ?? 0
    : 0;

  let matches: MatchRow[] = [];
  if (eventTag && query) {
    // Mismo saneo que el buscador del directorio: se sacan los caracteres con
    // significado especial en la sintaxis de .or() de PostgREST.
    const safeQuery = query.replace(/[,()"'\\]/g, " ").trim();

    if (safeQuery) {
      const { data } = await supabase
        .from("clients")
        .select("id, first_name, last_name, phone_normalized, status, event_tag")
        .is("archived_at", null)
        .or(
          `first_name.ilike.%${safeQuery}%,last_name.ilike.%${safeQuery}%,phone_normalized.ilike.%${safeQuery}%`,
        )
        .limit(6)
        .returns<MatchRow[]>();

      matches = data ?? [];
    }
  }

  return (
    <AppShell profile={profile} title="Check-in evento">
      <div className="mx-auto max-w-xl">
        <form method="get" className="mb-6 space-y-3 card-premium rounded-xl p-5">
          <label className="block">
            <span className="mb-1.5 block text-label-md font-semibold">Evento</span>
            <input
              name="event"
              required
              defaultValue={eventTag}
              placeholder="Ej: Fiesta del Agricultor 2026"
              className={inputClasses}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-label-md font-semibold">Buscar por telefono o nombre</span>
            <input
              name="q"
              defaultValue={query}
              placeholder="Ej: 11 2345 6789"
              autoFocus
              className={inputClasses}
            />
          </label>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-lg font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.99]"
          >
            <span className="material-symbols-outlined">search</span>
            Buscar
          </button>
        </form>

        {eventTag ? (
          <p className="mb-4 text-center text-body-lg font-semibold text-on-surface-variant">
            {eventCount} {eventCount === 1 ? "persona anotada" : "personas anotadas"} para{" "}
            <span className="text-on-surface">{eventTag}</span>
          </p>
        ) : null}

        {params.done ? (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-green-600/30 bg-green-50 px-4 py-3 text-body-lg font-semibold text-green-800">
            <span className="material-symbols-outlined">check_circle</span>
            Listo, anotado. Siguiente persona.
          </div>
        ) : null}

        {params.error ? (
          <p className="mb-4 rounded-xl border border-error/30 bg-error-container/40 px-4 py-3 text-body-md font-medium text-on-error-container">
            {params.error}
          </p>
        ) : null}

        {eventTag && query ? (
          <>
            {matches.length > 0 ? (
              <section className="mb-6 space-y-3">
                <h2 className="text-label-md font-bold tracking-wider text-on-surface-variant uppercase">
                  Ya existen en el sistema
                </h2>
                {matches.map((client) => {
                  const name = `${client.first_name} ${client.last_name ?? ""}`.trim();
                  const alreadyTagged = client.event_tag === eventTag;

                  return (
                    <div key={client.id} className="card-premium rounded-xl p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-lg font-bold">{name}</p>
                          <p className="text-body-md text-on-surface-variant">{client.phone_normalized}</p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase ${clientStatusChipClasses(client.status)}`}
                        >
                          {clientStatusLabel(client.status)}
                        </span>
                      </div>
                      {alreadyTagged ? (
                        <p className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2.5 text-body-md font-semibold text-green-800">
                          <span className="material-symbols-outlined text-[20px]">check_circle</span>
                          Ya está anotado para este evento
                        </p>
                      ) : (
                        <form
                          action={checkinExistingAction.bind(
                            null,
                            client.id,
                            eventTag,
                            `${redirectBase}&done=1`,
                          )}
                        >
                          <button
                            type="submit"
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-lg font-bold text-on-primary shadow-sm transition-all hover:bg-on-surface-variant active:scale-[0.98]"
                          >
                            <span className="material-symbols-outlined">how_to_reg</span>
                            Marcar que vino
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </section>
            ) : (
              <p className="mb-6 text-center text-body-lg text-on-surface-variant">
                No encontré a nadie con esos datos.
              </p>
            )}

            <section className="card-premium rounded-xl p-5">
              <h2 className="mb-3 text-label-md font-bold tracking-wider text-on-surface-variant uppercase">
                ¿No está en la lista? Cargalo nuevo
              </h2>
              <form
                action={checkinNewAction.bind(null, eventTag, `${redirectBase}&done=1`)}
                className="space-y-3"
              >
                <input name="firstName" required placeholder="Nombre" className={inputClasses} />
                <input name="phone" required placeholder="Telefono" className={inputClasses} />
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-lg font-bold text-on-primary shadow-sm transition-all hover:bg-on-surface-variant active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined">person_add</span>
                  Cargar y anotar
                </button>
              </form>
            </section>
          </>
        ) : null}

        {eventTag ? (
          <div className="mt-6 text-center">
            <Link
              href={`/checkin/sorteo?event=${encodeURIComponent(eventTag)}`}
              className="inline-flex items-center gap-2 text-label-md font-bold text-primary hover:underline"
            >
              <span className="material-symbols-outlined text-[20px]">emoji_events</span>
              Ir al sorteo
            </Link>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
