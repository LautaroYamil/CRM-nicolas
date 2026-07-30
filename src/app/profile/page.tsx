import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { updatePasswordAction, updateProfileNameAction } from "./actions";

type ProfilePageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

const inputClasses =
  "w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3.5 py-2.5 text-sm focus:border-transparent focus:ring-1 focus:ring-primary focus:outline-none";

const labelClasses = "mb-1.5 block text-label-md font-semibold tracking-wider text-on-surface-variant uppercase";

const submitButtonClasses =
  "rounded-lg bg-primary px-6 py-2.5 text-xs font-bold tracking-widest text-on-primary uppercase shadow-sm transition-all hover:bg-on-surface-variant active:scale-[0.98]";

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const { error: errorMessage, success: successMessage } = await searchParams;
  const { user, profile } = await getCurrentUserContext();

  return (
    <AppShell profile={profile} title="Mi perfil">
      <div className="mx-auto max-w-xl space-y-6">
        <section>
          <h1 className="text-headline-md font-bold tracking-tight lg:text-headline-xl">Mi perfil</h1>
          <p className="mt-1 font-medium text-on-surface-variant">
            Tu nombre y tu contrasena de acceso al CRM.
          </p>
        </section>

        {errorMessage ? (
          <p className="rounded-lg border border-error/30 bg-error-container/40 px-4 py-3 text-body-md font-medium text-on-error-container">
            {errorMessage}
          </p>
        ) : null}
        {successMessage ? (
          <p className="rounded-lg border border-green-600/30 bg-green-50 px-4 py-3 text-body-md font-medium text-green-800">
            {successMessage}
          </p>
        ) : null}

        <section className="card-premium rounded-xl p-5 lg:p-6">
          <h2 className="mb-1 text-headline-sm font-bold">Datos personales</h2>
          <p className="mb-4 text-body-md text-on-surface-variant">
            Este nombre es el que ven tus compañeros y el que aparece en el saludo del inicio.
          </p>
          <form action={updateProfileNameAction} className="space-y-4">
            <label className="block">
              <span className={labelClasses}>Nombre completo</span>
              <input name="fullName" defaultValue={profile.full_name ?? ""} required className={inputClasses} />
            </label>
            <label className="block">
              <span className={labelClasses}>Email</span>
              <input
                value={user.email ?? ""}
                disabled
                className={`${inputClasses} bg-surface-container-low text-on-surface-variant`}
              />
            </label>
            <button type="submit" className={submitButtonClasses}>
              Guardar nombre
            </button>
          </form>
        </section>

        <section className="card-premium rounded-xl p-5 lg:p-6">
          <h2 className="mb-1 text-headline-sm font-bold">Seguridad</h2>
          <p className="mb-4 text-body-md text-on-surface-variant">
            Cambia tu contrasena cuando quieras, sin depender del administrador.
          </p>
          <form action={updatePasswordAction} className="space-y-4">
            <label className="block">
              <span className={labelClasses}>Contrasena nueva</span>
              <input
                type="password"
                name="password"
                required
                minLength={6}
                autoComplete="new-password"
                className={inputClasses}
              />
            </label>
            <label className="block">
              <span className={labelClasses}>Repetir contrasena</span>
              <input
                type="password"
                name="confirmPassword"
                required
                minLength={6}
                autoComplete="new-password"
                className={inputClasses}
              />
            </label>
            <button type="submit" className={submitButtonClasses}>
              Cambiar contrasena
            </button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
