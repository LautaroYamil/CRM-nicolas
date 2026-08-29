import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/login/actions";
import { formatLongDateAr } from "@/lib/crm/dates";
import type { Profile } from "@/types/database";
import { BottomNavLinks, SidebarNavLinks, type NavItem } from "./nav-links";

type AppShellProps = {
  profile: Profile;
  title: string;
  children: ReactNode;
};

export function AppShell({ profile, title, children }: AppShellProps) {
  const navItems: NavItem[] = [
    { label: "Inicio", href: "/dashboard", icon: "dashboard" },
    { label: "Clientes", href: "/clients", icon: "groups" },
    { label: "Agenda", href: "/agenda", icon: "calendar_today" },
    { label: "Reportes", href: "/reports", icon: "analytics" },
    { label: "Check-in evento", href: "/checkin", icon: "how_to_reg" },
    ...(profile.role === "admin"
      ? [
          { label: "Intereses", href: "/admin/interests", icon: "favorite" },
          { label: "Objetivos", href: "/admin/contact-objectives", icon: "flag" },
          { label: "Motivos de perdida", href: "/admin/loss-reasons", icon: "sentiment_dissatisfied" },
          { label: "Equipo", href: "/admin/users", icon: "manage_accounts" },
          { label: "Auditoria", href: "/admin/audit-log", icon: "history" },
        ]
      : []),
  ];

  const initials = (profile.full_name ?? "?")
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-on-surface">
      {/* Sidebar (desktop) */}
      <aside className="fixed top-0 left-0 z-50 hidden h-full w-[260px] flex-col border-r border-outline-variant/30 bg-surface-container-low lg:flex">
        <div className="px-8 py-10">
          <h1 className="text-2xl font-extrabold tracking-tight text-primary">EL GALLEGO</h1>
          <p className="mt-1 text-[10px] font-bold tracking-[0.2em] text-on-surface-variant/70 uppercase">
            CRM Corporativo
          </p>
        </div>

        <SidebarNavLinks items={navItems} />

        <div className="mt-auto space-y-1 border-t border-outline-variant/30 p-3">
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-container"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-container font-bold text-on-primary shadow-sm">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-on-surface">
                {profile.full_name ?? "Sin nombre"}
              </p>
              <p className="text-[10px] tracking-wider text-on-surface-variant uppercase">
                {profile.role === "admin" ? "Administrador" : "Vendedor"}
              </p>
            </div>
            <span className="material-symbols-outlined shrink-0 text-on-surface-variant/60">
              chevron_right
            </span>
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg p-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-error-container/30 hover:text-error"
            >
              <span className="material-symbols-outlined ml-1 text-[20px]">logout</span>
              Cerrar sesion
            </button>
          </form>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex min-h-screen flex-col lg:ml-[260px]">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-outline-variant/20 bg-surface/80 px-4 backdrop-blur-md lg:h-20 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-8">
            <h2 className="truncate text-xl font-bold tracking-tight text-on-surface">{title}</h2>
            <form action="/clients" method="get" className="relative hidden w-full max-w-md md:block">
              <span className="material-symbols-outlined absolute top-1/2 left-4 -translate-y-1/2 text-on-surface-variant/60">
                search
              </span>
              <input
                type="text"
                name="search"
                placeholder="Buscar clientes..."
                className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-low py-2.5 pr-4 pl-11 text-sm transition-all focus:border-transparent focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </form>
          </div>
          <div className="flex items-center gap-4 lg:gap-8">
            <span className="hidden border-r border-outline-variant/20 pr-8 text-xs font-semibold tracking-widest text-on-surface-variant/70 uppercase xl:block">
              {formatLongDateAr()}
            </span>
            <Link
              href="/clients/new"
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold tracking-widest text-on-primary uppercase shadow-sm transition-all hover:bg-on-surface-variant active:scale-[0.98] lg:px-6"
            >
              <span className="material-symbols-outlined text-[20px]">person_add</span>
              <span className="hidden sm:inline">Nuevo cliente</span>
            </Link>
            <div className="flex items-center gap-1 lg:hidden">
              <Link
                href="/profile"
                title="Mi perfil"
                className="flex items-center justify-center rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
              >
                <span className="material-symbols-outlined">account_circle</span>
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  title="Cerrar sesion"
                  className="flex items-center justify-center rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-error-container/30 hover:text-error"
                >
                  <span className="material-symbols-outlined">logout</span>
                </button>
              </form>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-6 pb-24 lg:px-10 lg:pt-10 lg:pb-12">
          {children}
        </main>
      </div>

      {/* Barra inferior (celular) */}
      <div className="fixed right-0 bottom-0 left-0 z-50 border-t border-outline-variant/30 bg-surface-container-lowest/95 backdrop-blur-md lg:hidden">
        <BottomNavLinks items={navItems} />
      </div>
    </div>
  );
}
