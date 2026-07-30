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
    { label: "Inicio", href: "/dashboard", icon: "home" },
    { label: "Clientes", href: "/clients", icon: "group" },
    { label: "Agenda", href: "/agenda", icon: "calendar_today" },
    { label: "Reportes", href: "/reports", icon: "monitoring" },
    ...(profile.role === "admin"
      ? [{ label: "Intereses", href: "/admin/interests", icon: "star" }]
      : []),
  ];

  const initials = (profile.full_name ?? "?")
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background text-on-surface">
      {/* Sidebar (desktop) */}
      <aside className="fixed top-0 left-0 z-50 hidden h-full w-[260px] flex-col border-r border-white/5 bg-gradient-to-b from-[#141927] via-[#161b2a] to-[#1b2236] py-6 shadow-2xl lg:flex">
        <div className="mb-8 px-6">
          <h1 className="text-[24px] leading-tight font-black tracking-tight text-white">
            El Gallego<span className="text-amber-400">.</span>
          </h1>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="h-px w-7 bg-gradient-to-r from-amber-400/70 to-transparent" />
            <p className="text-[10px] font-semibold tracking-[0.3em] text-white/40 uppercase">
              CRM Comercial
            </p>
          </div>
        </div>

        <SidebarNavLinks items={navItems} />

        <div className="mt-auto px-6">
          <div className="flex items-center gap-3 border-t border-white/10 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-fixed text-label-md font-bold text-primary">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-label-md leading-none font-semibold text-white">
                {profile.full_name ?? "Sin nombre"}
              </p>
              <p className="text-xs text-secondary-fixed-dim">
                {profile.role === "admin" ? "Administrador" : "Vendedor"}
              </p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                title="Cerrar sesion"
                className="rounded-full p-2 text-secondary-fixed-dim transition-colors hover:bg-white/10 hover:text-white"
              >
                <span className="material-symbols-outlined">logout</span>
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Contenido */}
      <div className="lg:ml-[260px]">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-outline-variant/50 bg-surface/80 px-4 backdrop-blur-md lg:h-20 lg:px-8">
          <div className="flex min-w-0 items-center gap-6">
            <h2 className="truncate text-headline-sm font-bold">{title}</h2>
            <form action="/clients" method="get" className="relative hidden w-72 md:block">
              <span className="material-symbols-outlined absolute top-1/2 left-3 -translate-y-1/2 text-outline">
                search
              </span>
              <input
                type="text"
                name="search"
                placeholder="Buscar clientes..."
                className="w-full rounded-full border-none bg-surface-container-low py-2 pr-4 pl-10 text-body-md focus:ring-2 focus:ring-primary/20"
              />
            </form>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-label-md text-on-surface-variant xl:block">
              Hoy: {formatLongDateAr()}
            </span>
            <Link
              href="/clients/new"
              className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-label-md font-semibold text-on-primary shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95"
            >
              <span className="material-symbols-outlined text-base">person_add</span>
              <span className="hidden sm:inline">Nuevo cliente</span>
            </Link>
            <form action={logoutAction} className="lg:hidden">
              <button
                type="submit"
                title="Cerrar sesion"
                className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined">logout</span>
              </button>
            </form>
          </div>
        </header>

        <main className="px-4 pt-6 pb-24 lg:px-8 lg:pb-10">{children}</main>
      </div>

      {/* Barra inferior (celular) */}
      <div className="fixed right-0 bottom-0 left-0 z-50 border-t border-outline-variant/50 bg-surface-container-lowest/95 backdrop-blur-md lg:hidden">
        <BottomNavLinks items={navItems} />
      </div>
    </div>
  );
}
