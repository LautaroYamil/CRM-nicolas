import Link from "next/link";
import { checkinExistingAction, checkinNewAction } from "@/app/checkin/actions";
import { AppShell } from "@/components/layout/app-shell";
import { SubmitOnceButton } from "@/components/ui/submit-once-button";
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
  locality: string | null;
};

type InterestOption = {
  id: string;
  name: string;
};

const inputClasses =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3.5 text-lg focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none";

// Evento del momento, precargado para no tener que tipearlo en el stand.
// Para el proximo evento, cambiar este valor (o dejarlo vacio y tipear a mano).
const DEFAULT_EVENT_TAG = "Fiesta del Agricultor 2026";

/**
 * "Solo paso" / "Interes real de compra": dos botones grandes, un solo tap,
 * pensado para tablet. Cuando se elige "Interes real" aparece un cajon de
 * texto opcional para anotar que fue lo que la persona busco -mostrado y
 * ocultado solo con CSS (`:has()`), sin JS, para no convertir la pantalla en
 * un client component.
 */
function InterestLevelPicker({ levelName, noteName }: { levelName: string; noteName: string }) {
  return (
    <div className="group/interest">
      <span className="mb-1.5 block text-label-md font-semibold">Que tan interesado se mostro?</span>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-outline-variant/40 bg-surface-container-lowest px-3 py-3 text-center transition-colors has-checked:border-on-surface-variant has-checked:bg-surface-container-high">
          <input type="radio" name={levelName} value="paso" required className="sr-only" />
          <span className="material-symbols-outlined text-[22px] text-on-surface-variant">directions_walk</span>
          <span className="text-label-sm font-bold">Solo paso</span>
        </label>
        <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-outline-variant/40 bg-surface-container-lowest px-3 py-3 text-center transition-colors has-checked:border-primary has-checked:bg-primary has-checked:text-on-primary">
          <input type="radio" name={levelName} value="interesado" required className="sr-only" />
          <span className="material-symbols-outlined text-[22px]">local_fire_department</span>
          <span className="text-label-sm font-bold">Interes real</span>
        </label>
      </div>
      <label className="mt-3 hidden group-has-[input[value='interesado']:checked]/interest:block">
        <span className="mb-1.5 block text-label-md font-semibold">Que le interesa? (opcional)</span>
        <textarea
          name={noteName}
          rows={2}
          maxLength={500}
          placeholder="Ej: living de 3 cuerpos, color gris"
          className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-base focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
        />
      </label>
    </div>
  );
}

function InterestsPicker({ interests, name }: { interests: InterestOption[]; name: string }) {
  if (interests.length === 0) {
    return null;
  }

  return (
    <div>
      <span className="mb-1.5 block text-label-md font-semibold">Intereses (opcional)</span>
      <div className="flex flex-wrap gap-2">
        {interests.map((interest) => (
          <label
            key={interest.id}
            className="cursor-pointer rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3.5 py-2 text-[11px] font-bold tracking-wider text-on-surface-variant uppercase transition-colors select-none has-checked:border-primary has-checked:bg-primary has-checked:text-on-primary"
          >
            <input type="checkbox" name={name} value={interest.id} className="sr-only" />
            {interest.name}
          </label>
        ))}
      </div>
    </div>
  );
}

function LocalityInput({ listId, defaultValue }: { listId: string; defaultValue?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-label-md font-semibold">Localidad (opcional)</span>
      <input
        name="locality"
        list={listId}
        defaultValue={defaultValue}
        placeholder="Ej: Colon"
        className={inputClasses}
      />
    </label>
  );
}

export default async function CheckinPage({ searchParams }: CheckinPageProps) {
  const params = await searchParams;
  const { supabase, profile } = await getCurrentUserContext();

  const eventTag = (params.event ?? "").trim() || DEFAULT_EVENT_TAG;
  const query = (params.q ?? "").trim();
  const redirectBase = eventTag ? `/checkin?event=${encodeURIComponent(eventTag)}` : "/checkin";

  const [eventCountResult, interestsResult, localitiesResult] = await Promise.all([
    eventTag
      ? supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("event_tag", eventTag)
          .is("archived_at", null)
      : Promise.resolve({ count: 0 }),
    supabase.from("interests").select("id, name").eq("active", true).order("name").returns<InterestOption[]>(),
    supabase
      .from("clients")
      .select("locality")
      .not("locality", "is", null)
      .limit(1000)
      .returns<{ locality: string | null }[]>(),
  ]);

  const eventCount = eventCountResult.count ?? 0;
  const interests = interestsResult.data ?? [];
  const localities = Array.from(
    new Set((localitiesResult.data ?? []).map((row) => row.locality?.trim()).filter((value): value is string => Boolean(value))),
  ).sort((a, b) => a.localeCompare(b, "es"));

  let matches: MatchRow[] = [];
  const purchaseCounts = new Map<string, number>();

  if (eventTag && query) {
    // Mismo saneo que el buscador del directorio: se sacan los caracteres con
    // significado especial en la sintaxis de .or() de PostgREST.
    const safeQuery = query.replace(/[,()"'\\]/g, " ").trim();

    if (safeQuery) {
      const { data } = await supabase
        .from("clients")
        .select("id, first_name, last_name, phone_normalized, status, event_tag, locality")
        .is("archived_at", null)
        .or(
          `first_name.ilike.%${safeQuery}%,last_name.ilike.%${safeQuery}%,phone_normalized.ilike.%${safeQuery}%`,
        )
        .limit(6)
        .returns<MatchRow[]>();

      matches = data ?? [];

      if (matches.length > 0) {
        const { data: purchaseRows } = await supabase
          .from("client_purchases")
          .select("client_id")
          .in(
            "client_id",
            matches.map((match) => match.id),
          )
          .returns<{ client_id: string }[]>();

        for (const row of purchaseRows ?? []) {
          purchaseCounts.set(row.client_id, (purchaseCounts.get(row.client_id) ?? 0) + 1);
        }
      }
    }
  }

  return (
    <AppShell profile={profile} title="Check-in evento">
      <div className="mx-auto max-w-xl">
        <datalist id="checkin-localities">
          {localities.map((locality) => (
            <option key={locality} value={locality} />
          ))}
        </datalist>

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
                  const purchases = purchaseCounts.get(client.id) ?? 0;

                  return (
                    <div key={client.id} className="card-premium rounded-xl p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-lg font-bold">{name}</p>
                          <p className="text-body-md text-on-surface-variant">{client.phone_normalized}</p>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <span
                            className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase ${clientStatusChipClasses(client.status)}`}
                          >
                            {clientStatusLabel(client.status)}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase ${
                              purchases > 1
                                ? "bg-secondary-fixed text-on-secondary-fixed"
                                : purchases === 1
                                  ? "bg-surface-container-high text-on-surface-variant"
                                  : "bg-surface-container-low text-on-surface-variant/70"
                            }`}
                          >
                            {purchases === 0
                              ? "Sin compras"
                              : purchases === 1
                                ? "1 compra previa"
                                : `Cliente frecuente · ${purchases} compras`}
                          </span>
                        </div>
                      </div>
                      {alreadyTagged ? (
                        <p className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2.5 text-body-md font-semibold text-green-800">
                          <span className="material-symbols-outlined text-[20px]">check_circle</span>
                          Ya está anotado para este evento
                        </p>
                      ) : (
                        <form
                          action={checkinExistingAction.bind(null, client.id, eventTag, `${redirectBase}&done=1`)}
                          className="space-y-3"
                        >
                          <LocalityInput listId="checkin-localities" defaultValue={client.locality ?? ""} />
                          <InterestsPicker interests={interests} name="interestIds" />
                          <InterestLevelPicker levelName="interestLevel" noteName="interestNote" />
                          <SubmitOnceButton
                            pendingLabel="Guardando..."
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-lg font-bold text-on-primary shadow-sm transition-all hover:bg-on-surface-variant active:scale-[0.98] disabled:opacity-60"
                          >
                            <span className="material-symbols-outlined">how_to_reg</span>
                            Marcar que vino
                          </SubmitOnceButton>
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
                <LocalityInput listId="checkin-localities" />
                <InterestsPicker interests={interests} name="interestIds" />
                <InterestLevelPicker levelName="interestLevel" noteName="interestNote" />
                <SubmitOnceButton
                  pendingLabel="Guardando..."
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-lg font-bold text-on-primary shadow-sm transition-all hover:bg-on-surface-variant active:scale-[0.98] disabled:opacity-60"
                >
                  <span className="material-symbols-outlined">person_add</span>
                  Cargar y anotar
                </SubmitOnceButton>
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
