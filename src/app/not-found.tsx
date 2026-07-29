import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-4">
      <div className="max-w-md rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-8 text-center shadow-sm">
        <span className="material-symbols-outlined mb-2 text-5xl text-primary-container">search_off</span>
        <h1 className="text-headline-md font-bold">No encontramos esa pagina</h1>
        <p className="mt-2 text-body-md text-on-surface-variant">
          Puede que el cliente o la pagina ya no existan, o que el link este mal escrito.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-label-md font-bold text-on-primary transition-all hover:bg-primary/90 active:scale-95"
        >
          <span className="material-symbols-outlined text-base">home</span>
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
