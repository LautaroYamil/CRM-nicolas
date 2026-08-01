import { redirect } from "next/navigation";
import clsx from "clsx";
import { inviteSellerAction, toggleUserActiveAction, updateUserRoleAction } from "./actions";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUserContext } from "@/lib/auth/current-user";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/database";

type UsersPageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: UserRole;
  active: boolean;
  created_at: string;
};

export default async function UsersAdminPage({ searchParams }: UsersPageProps) {
  const params = await searchParams;
  const { supabase, profile: currentProfile } = await getCurrentUserContext();

  if (currentProfile.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, active, created_at")
    .order("created_at", { ascending: true })
    .returns<ProfileRow[]>();

  if (error) {
    return (
      <AppShell profile={currentProfile} title="Equipo">
        <p className="text-error">Error al cargar usuarios: {error.message}</p>
      </AppShell>
    );
  }

  // Email vive en auth.users, no en profiles: se pide con la service role key.
  const emailsById = new Map<string, string>();
  try {
    const admin = getSupabaseAdminClient();
    const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 200 });
    for (const authUser of authUsers?.users ?? []) {
      if (authUser.email) {
        emailsById.set(authUser.id, authUser.email);
      }
    }
  } catch {
    // Sin SUPABASE_SERVICE_ROLE_KEY configurada: se pierde el email en la lista,
    // pero el resto de la gestion (rol, activo) sigue funcionando.
  }

  return (
    <AppShell profile={currentProfile} title="Equipo">
      <div className="mx-auto max-w-3xl">
        <section className="mb-6">
          <h1 className="text-headline-md font-bold lg:text-headline-lg">Equipo</h1>
          <p className="text-body-lg text-on-surface-variant">
            Invita vendedores, cambia roles y activa o desactiva cuentas.
          </p>
        </section>

        {params.error ? (
          <p className="mb-4 rounded-xl border border-error/30 bg-error-container/40 px-4 py-3 text-body-md font-medium text-on-error-container">
            {params.error}
          </p>
        ) : null}
        {params.success ? (
          <p className="mb-4 rounded-xl border border-green-600/30 bg-green-50 px-4 py-3 text-body-md font-medium text-green-800">
            {params.success}
          </p>
        ) : null}

        <form
          action={inviteSellerAction}
          className="card-premium mb-6 flex flex-wrap items-end gap-3 rounded-xl p-4"
        >
          <label className="block min-w-40 flex-1">
            <span className="mb-1.5 block text-label-md font-semibold">Nombre</span>
            <input
              name="fullName"
              required
              placeholder="Nombre y apellido"
              className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3.5 py-2.5 text-sm focus:border-transparent focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </label>
          <label className="block min-w-52 flex-1">
            <span className="mb-1.5 block text-label-md font-semibold">Email</span>
            <input
              name="email"
              type="email"
              required
              placeholder="vendedor@correo.com"
              className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3.5 py-2.5 text-sm focus:border-transparent focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-xs font-bold tracking-widest text-on-primary uppercase shadow-sm transition-all hover:bg-on-surface-variant active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            Invitar
          </button>
        </form>

        <section className="card-premium rounded-xl p-5 lg:p-6">
          <h2 className="mb-4 text-headline-sm font-bold">
            Usuarios ({(profiles ?? []).length})
          </h2>
          <ul className="space-y-2">
            {(profiles ?? []).map((row) => {
              const isSelf = row.id === currentProfile.id;
              const nextRole: UserRole = row.role === "admin" ? "seller" : "admin";

              return (
                <li
                  key={row.id}
                  className={clsx(
                    "flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3",
                    row.active
                      ? "border-outline-variant/40 bg-surface-container-low/50"
                      : "border-outline-variant/30 bg-surface-container-low/30 opacity-70",
                  )}
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-bold">
                      {row.full_name ?? "Sin nombre"}
                      {isSelf ? (
                        <span className="text-[10px] font-bold tracking-wider text-on-surface-variant/60 uppercase">
                          (vos)
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-label-sm text-on-surface-variant">
                      {emailsById.get(row.id) ?? "-"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={clsx(
                        "rounded border px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase",
                        row.role === "admin"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-outline-variant/40 bg-surface-container text-on-surface-variant",
                      )}
                    >
                      {row.role === "admin" ? "Administrador" : "Vendedor"}
                    </span>
                    <span
                      className={clsx(
                        "rounded border px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase",
                        row.active
                          ? "border-green-600/20 bg-green-50 text-green-700"
                          : "border-error/20 bg-error-container/20 text-error",
                      )}
                    >
                      {row.active ? "Activo" : "Inactivo"}
                    </span>

                    {!isSelf ? (
                      <>
                        <form action={updateUserRoleAction}>
                          <input type="hidden" name="userId" value={row.id} />
                          <input type="hidden" name="nextRole" value={nextRole} />
                          <button
                            type="submit"
                            className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-[11px] font-bold tracking-wider text-on-surface-variant uppercase transition-colors hover:bg-surface-container"
                          >
                            Hacer {nextRole === "admin" ? "admin" : "vendedor"}
                          </button>
                        </form>
                        <form action={toggleUserActiveAction}>
                          <input type="hidden" name="userId" value={row.id} />
                          <input type="hidden" name="nextActive" value={(!row.active).toString()} />
                          <button
                            type="submit"
                            className={clsx(
                              "rounded-lg px-3 py-2 text-[11px] font-bold tracking-wider uppercase transition-colors",
                              row.active
                                ? "border border-error/30 text-error hover:bg-error/10"
                                : "bg-primary text-on-primary hover:bg-on-surface-variant",
                            )}
                          >
                            {row.active ? "Desactivar" : "Reactivar"}
                          </button>
                        </form>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
