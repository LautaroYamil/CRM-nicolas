import { loginAction } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <main className="grid min-h-dvh place-items-center bg-surface-container p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-surface-container-lowest shadow-xl md:grid-cols-2">
        {/* Panel de marca */}
        <section className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-on-primary md:flex">
          <div>
            <div className="mb-10 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                <span className="material-symbols-outlined">chair</span>
              </span>
              <div>
                <p className="text-body-lg leading-none font-black">El Gallego</p>
                <p className="text-label-sm tracking-widest uppercase opacity-70">CRM Comercial</p>
              </div>
            </div>
            <h1 className="text-headline-lg font-bold">
              Que ningun cliente se pierda.
            </h1>
            <p className="mt-3 text-body-lg opacity-80">
              Accede a tu panel comercial: seguimientos, agenda y toda tu cartera en un solo lugar.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { icon: "event_available", text: "Sabes a quien contactar cada dia" },
              { icon: "forum", text: "WhatsApp a un click, con todo el contexto" },
              { icon: "history", text: "Cada conversacion queda registrada" },
            ].map((item) => (
              <div key={item.icon} className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3">
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="text-body-md font-medium">{item.text}</span>
              </div>
            ))}
          </div>

          <p className="text-label-sm opacity-60">
            (c) 2026 Muebleria El Gallego. Todos los derechos reservados.
          </p>

          {/* Decoracion */}
          <span className="material-symbols-outlined pointer-events-none absolute -right-10 -bottom-10 text-[220px] opacity-10">
            chair
          </span>
        </section>

        {/* Formulario */}
        <section className="p-8 lg:p-12">
          <div className="mb-8 flex items-center gap-3 md:hidden">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-on-primary">
              <span className="material-symbols-outlined">chair</span>
            </span>
            <div>
              <p className="text-body-lg leading-none font-black">El Gallego</p>
              <p className="text-label-sm tracking-widest uppercase text-on-surface-variant">CRM Comercial</p>
            </div>
          </div>

          <h2 className="text-headline-md font-bold">Bienvenido de nuevo</h2>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Ingresa tus credenciales para acceder a tu cuenta.
          </p>

          {error ? (
            <p className="mt-5 rounded-xl border border-error/30 bg-error-container/40 px-4 py-3 text-body-md font-medium text-on-error-container">
              {error}
            </p>
          ) : null}

          <form action={loginAction} className="mt-6 space-y-5">
            <label className="block">
              <span className="mb-1.5 block text-label-md font-semibold">Correo electronico</span>
              <div className="relative">
                <span className="material-symbols-outlined absolute top-1/2 left-3.5 -translate-y-1/2 text-outline">
                  mail
                </span>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  placeholder="nombre@correo.com"
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest py-3 pr-4 pl-11 text-body-lg focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-label-md font-semibold">Contrasena</span>
              <div className="relative">
                <span className="material-symbols-outlined absolute top-1/2 left-3.5 -translate-y-1/2 text-outline">
                  lock
                </span>
                <input
                  type="password"
                  name="password"
                  required
                  autoComplete="current-password"
                  placeholder="Tu contrasena"
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest py-3 pr-4 pl-11 text-body-lg focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
              </div>
            </label>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-label-md font-bold tracking-wider text-on-primary uppercase shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 active:scale-[0.99]"
            >
              Iniciar sesion
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          </form>

          <p className="mt-6 text-center text-body-md text-on-surface-variant">
            No tenes cuenta? Pedile acceso al administrador.
          </p>
        </section>
      </div>
    </main>
  );
}
