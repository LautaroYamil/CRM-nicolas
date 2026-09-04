import Link from "next/link";
import { pickWinnerAction } from "@/app/checkin/actions";
import { RouletteWheel } from "@/components/checkin/roulette-wheel";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUserContext } from "@/lib/auth/current-user";

const MAX_WHEEL_SEGMENTS = 10;
const MAX_PLACES = 7;

type SorteoPageProps = {
  searchParams: Promise<{ event?: string; excluded?: string; error?: string }>;
};

type PoolRow = {
  id: string;
  first_name: string;
  last_name: string | null;
};

function fullName(row: PoolRow) {
  return `${row.first_name} ${row.last_name ?? ""}`.trim();
}

/** Mezcla determinista solo para variar que subconjunto se muestra girando, no afecta al ganador (ya elegido en el servidor). */
function shuffled<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default async function SorteoPage({ searchParams }: SorteoPageProps) {
  const params = await searchParams;
  const { supabase, profile } = await getCurrentUserContext();
  const eventTag = (params.event ?? "").trim();

  if (!eventTag) {
    return (
      <AppShell profile={profile} title="Sorteo">
        <div className="mx-auto max-w-md py-16 text-center">
          <p className="mb-4 text-body-lg text-on-surface-variant">
            Falta indicar el evento. Volvé al check-in y entrá al sorteo desde ahí.
          </p>
          <Link
            href="/checkin"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-xs font-bold tracking-widest text-on-primary uppercase shadow-sm"
          >
            Ir a Check-in
          </Link>
        </div>
      </AppShell>
    );
  }

  const excludedCsv = (params.excluded ?? "").trim();
  const excludedIds = excludedCsv.split(",").filter(Boolean);
  const winnerId = excludedIds[excludedIds.length - 1] ?? null;
  // Exclusiones vigentes ANTES de este sorteo (para reconstruir que pool estuvo en juego).
  const priorExcludedIds = winnerId ? excludedIds.slice(0, -1) : excludedIds;
  // excludedIds.length es la cantidad de puestos ya sorteados (cada exclusion es un ganador).
  const placesAwarded = excludedIds.length;
  const redirectBase = `/checkin/sorteo?event=${encodeURIComponent(eventTag)}`;

  let totalQuery = supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("event_tag", eventTag)
    .is("archived_at", null);

  let remainingQuery = supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("event_tag", eventTag)
    .is("archived_at", null);

  if (excludedIds.length > 0) {
    remainingQuery = remainingQuery.not("id", "in", `(${excludedIds.join(",")})`);
  }

  // Pool que estuvo "en juego" en esta ronda (para mostrar en la ruleta): todos
  // los que quedaban antes de este sorteo -no se filtra por compras, esa
  // ponderacion la aplica pickWinnerAction al elegir, no cambia quien aparece
  // como candidato visible.
  let poolQuery = supabase
    .from("clients")
    .select("id, first_name, last_name")
    .eq("event_tag", eventTag)
    .is("archived_at", null);

  if (priorExcludedIds.length > 0) {
    poolQuery = poolQuery.not("id", "in", `(${priorExcludedIds.join(",")})`);
  }

  // Las 4 consultas independientes viajan juntas (no una atras de otra): en el
  // wifi del stand cada round-trip de mas se nota.
  const [{ count: totalCount }, { count: remainingCount }, { data: rawPool }, { data: fetchedWinner }] =
    await Promise.all([
      totalQuery,
      remainingQuery,
      poolQuery.returns<PoolRow[]>(),
      winnerId
        ? supabase.from("clients").select("id, first_name, last_name").eq("id", winnerId).maybeSingle<PoolRow>()
        : Promise.resolve({ data: null }),
    ]);

  let pool = rawPool ?? [];

  // El ganador siempre se muestra, aunque por algun motivo no haya aparecido
  // en el pool reconstruido (ej. quedo archivado despues de ganar): el nombre
  // del cartel de "Ganador" nunca depende de esa reconstruccion.
  const winnerRow = fetchedWinner ?? undefined;
  if (winnerRow && !pool.some((client) => client.id === winnerRow.id)) {
    pool = [winnerRow, ...pool];
  }

  // Armado de segmentos a mostrar: si hay mas candidatos que el maximo visual,
  // se muestra un subconjunto al azar (el ganador siempre incluido) -no cambia
  // quien gano, solo que tan lleno se ve el disco.
  let wheelPool = pool;
  if (pool.length > MAX_WHEEL_SEGMENTS) {
    const others = shuffled(pool.filter((client) => client.id !== winnerId)).slice(
      0,
      MAX_WHEEL_SEGMENTS - (winnerRow ? 1 : 0),
    );
    wheelPool = winnerRow ? shuffled([winnerRow, ...others]) : others;
  }

  const names = wheelPool.map(fullName);
  const highlightIndex = winnerRow ? wheelPool.findIndex((client) => client.id === winnerRow.id) : null;
  const winnerName = winnerRow ? fullName(winnerRow) : null;
  // Los puestos se sortean del mas chico al mas grande: el primer sorteo de la
  // tanda es el 7mo puesto y el ultimo (el gran premio) es el 1er puesto.
  const nextPlaceNumber = MAX_PLACES - placesAwarded;
  const allPlacesAwarded = placesAwarded >= MAX_PLACES;

  const pickAction = pickWinnerAction.bind(null, eventTag, excludedCsv, redirectBase);

  // Mensaje neutro a proposito: esta pantalla se graba para el publico del
  // stand, asi que no explica que el sorteo pondera por compras previas -la
  // logica sigue funcionando igual por atras, solo que no se explica en pantalla.
  const emptyLabel = "No quedan mas participantes para sortear.";

  return (
    <AppShell profile={profile} title="Sorteo">
      <div className="mx-auto max-w-lg text-center">
        <Link
          href={`/checkin?event=${encodeURIComponent(eventTag)}`}
          className="mb-4 inline-flex items-center gap-1 text-label-md font-semibold text-on-surface-variant hover:text-primary"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Volver al check-in
        </Link>

        <h1 className="mb-1 text-headline-lg font-bold">{eventTag}</h1>
        <p className="mb-4 text-body-lg text-on-surface-variant">
          {totalCount ?? 0} {totalCount === 1 ? "participante" : "participantes"}
          {excludedIds.length > 0 ? ` · ${excludedIds.length} ya salieron sorteados` : ""}
        </p>

        <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container-lowest px-4 py-1.5 text-label-md font-bold text-on-surface-variant uppercase tracking-wider">
          <span className="material-symbols-outlined text-[18px] text-primary">military_tech</span>
          {allPlacesAwarded
            ? `Sorteo terminado (${MAX_PLACES} de ${MAX_PLACES})`
            : `${nextPlaceNumber === 1 ? "1er" : `${nextPlaceNumber}°`} puesto de ${MAX_PLACES}`}
        </p>

        {params.error ? (
          <p className="mb-6 rounded-xl border border-error/30 bg-error-container/40 px-4 py-3 text-body-md font-medium text-on-error-container">
            {params.error}
          </p>
        ) : null}

        <div className="mb-8">
          <RouletteWheel
            names={names}
            highlightIndex={highlightIndex}
            winnerName={winnerName}
            spinToken={excludedCsv}
            emptyLabel={emptyLabel}
          />
        </div>

        {!allPlacesAwarded && (remainingCount ?? 0) > 0 ? (
          <form action={pickAction}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-lg font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.99]"
            >
              <span className="material-symbols-outlined">casino</span>
              {winnerId ? "Sortear otro" : "Sortear ganador"}
            </button>
          </form>
        ) : (
          <p className="text-body-md text-on-surface-variant">
            {allPlacesAwarded
              ? `Ya se sortearon los ${MAX_PLACES} puestos.`
              : (totalCount ?? 0) === 0
                ? "Todavía no hay participantes anotados para este evento."
                : "Ya se sorteó a todos los participantes."}
          </p>
        )}
      </div>
    </AppShell>
  );
}
