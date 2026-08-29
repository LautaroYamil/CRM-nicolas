import Link from "next/link";
import { pickWinnerAction } from "@/app/checkin/actions";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUserContext } from "@/lib/auth/current-user";

type SorteoPageProps = {
  searchParams: Promise<{ event?: string; excluded?: string; error?: string }>;
};

type WinnerRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  phone_normalized: string;
};

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
  const redirectBase = `/checkin/sorteo?event=${encodeURIComponent(eventTag)}`;

  let remainingQuery = supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("event_tag", eventTag)
    .is("archived_at", null);

  if (excludedIds.length > 0) {
    remainingQuery = remainingQuery.not("id", "in", `(${excludedIds.join(",")})`);
  }

  const { count: remainingCount } = await remainingQuery;

  const { count: totalCount } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("event_tag", eventTag)
    .is("archived_at", null);

  const { data: winner } = winnerId
    ? await supabase
        .from("clients")
        .select("id, first_name, last_name, phone_normalized")
        .eq("id", winnerId)
        .maybeSingle<WinnerRow>()
    : { data: null };

  const pickAction = pickWinnerAction.bind(null, eventTag, excludedCsv, redirectBase);

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
        <p className="mb-8 text-body-lg text-on-surface-variant">
          {totalCount ?? 0} {totalCount === 1 ? "participante" : "participantes"}
          {excludedIds.length > 0 ? ` · ${excludedIds.length} ya salieron sorteados` : ""}
        </p>

        {params.error ? (
          <p className="mb-6 rounded-xl border border-error/30 bg-error-container/40 px-4 py-3 text-body-md font-medium text-on-error-container">
            {params.error}
          </p>
        ) : null}

        {winner ? (
          <div className="mb-8 card-premium rounded-2xl border-2 border-primary/30 p-10">
            <span className="material-symbols-outlined animate-bounce mb-3 text-6xl text-primary">
              emoji_events
            </span>
            <p className="mb-1 text-label-md font-bold tracking-[0.2em] text-primary uppercase">Ganador</p>
            <p className="text-headline-md font-bold">
              {winner.first_name} {winner.last_name ?? ""}
            </p>
            <p className="mt-1 text-body-lg text-on-surface-variant">{winner.phone_normalized}</p>
          </div>
        ) : (
          <div className="mb-8 card-premium rounded-2xl p-10">
            <span className="material-symbols-outlined mb-3 text-6xl text-on-surface-variant/30">
              emoji_events
            </span>
            <p className="text-body-lg text-on-surface-variant">Todavía no se sorteó a nadie.</p>
          </div>
        )}

        {(remainingCount ?? 0) > 0 ? (
          <form action={pickAction}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-lg font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.99]"
            >
              <span className="material-symbols-outlined">casino</span>
              {winner ? "Sortear otro" : "Sortear ganador"}
            </button>
          </form>
        ) : (
          <p className="text-body-md text-on-surface-variant">
            {(totalCount ?? 0) === 0
              ? "Todavía no hay participantes anotados para este evento."
              : "Ya se sorteó a todos los participantes."}
          </p>
        )}
      </div>
    </AppShell>
  );
}
