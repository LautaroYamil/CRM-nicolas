import { loginAction } from "./actions";
import { PasswordInput } from "./password-input";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background p-4 text-on-surface">
      {/* Decoracion de fondo */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden opacity-50">
        <div className="absolute -top-[10%] -left-[5%] h-[40%] w-[40%] rounded-full bg-surface-container-high blur-[100px]" />
        <div className="absolute -right-[5%] -bottom-[10%] h-[50%] w-[50%] rounded-full bg-surface-dim blur-[120px]" />
      </div>

      <div className="w-full max-w-md space-y-8 rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
        {/* Marca */}
        <header className="flex flex-col items-center space-y-4 pt-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-tertiary text-on-primary shadow-md transition-transform duration-200 hover:scale-105 active:scale-95">
            <span className="material-symbols-outlined text-4xl">chair</span>
          </div>
          <div className="space-y-1">
            <h1 className="text-[24px] leading-[30px] font-bold tracking-tight text-primary">El Gallego</h1>
            <p className="text-label-md font-semibold tracking-widest text-on-surface-variant/80 uppercase">
              CRM Comercial
            </p>
          </div>
        </header>

        {/* Formulario */}
        <section className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-[22px] leading-[28px] font-semibold text-on-surface">Bienvenido de nuevo</h2>
            <p className="text-body-md text-on-surface-variant/80">
              Ingresa tus credenciales para acceder a tu cuenta.
            </p>
          </div>

          {error ? (
            <p className="rounded-lg border border-error/30 bg-error-container/40 px-4 py-3 text-body-md font-medium text-on-error-container">
              {error}
            </p>
          ) : null}

          <form action={loginAction} className="space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="email"
                className="px-1 text-label-md font-semibold tracking-wider text-on-surface-variant uppercase"
              >
                Correo electronico
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <span className="material-symbols-outlined text-on-surface-variant/70">mail</span>
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="nombre@correo.com"
                  className="w-full rounded-lg border border-outline-variant bg-surface py-4 pr-4 pl-12 text-body-md transition-all focus:border-primary focus:ring-0 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="password"
                className="px-1 text-label-md font-semibold tracking-wider text-on-surface-variant uppercase"
              >
                Contrasena
              </label>
              <PasswordInput />
            </div>

            <button
              type="submit"
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-tertiary px-6 py-4 text-sm font-bold tracking-wider text-on-primary uppercase shadow-lg transition-all duration-200 hover:shadow-xl active:scale-95 active:opacity-90"
            >
              Iniciar sesion
              <span className="material-symbols-outlined text-xl">arrow_forward</span>
            </button>
          </form>
        </section>

        {/* Pie */}
        <footer className="border-t border-surface-container pt-6 text-center">
          <p className="text-body-md text-on-surface-variant/80">
            No tenes cuenta? <span className="font-bold text-primary">Pedile acceso al administrador.</span>
          </p>
        </footer>
      </div>
    </main>
  );
}
