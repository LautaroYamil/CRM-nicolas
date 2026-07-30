import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-4">
      <div className="card-premium max-w-md rounded-xl p-8 text-center">
        <span className="material-symbols-outlined mb-2 text-5xl text-primary-container">search_off</span>
        <h1 className="text-headline-md font-bold">No encontramos esa pagina</h1>
        <p className="mt-2 text-body-md text-on-surface-variant">
          Puede que el cliente o la pagina ya no existan, o que el link este mal escrito.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-xs font-bold tracking-widest text-on-primary uppercase transition-all hover:bg-on-surface-variant active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-base">home</span>
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
