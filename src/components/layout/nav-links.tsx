"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export type NavItem = {
  label: string;
  href: string;
  icon: string;
};

const FILLED_ICON = { fontVariationSettings: "'FILL' 1" } as const;

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-4">
      {items.map((item) => {
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "flex items-center gap-3 rounded-lg border-l-4 px-4 py-3 transition-all duration-150",
              active
                ? "border-primary bg-surface-container-highest/30 font-bold text-on-surface"
                : "border-transparent font-medium text-on-surface-variant hover:bg-surface-container/50 hover:text-primary",
            )}
          >
            <span className="material-symbols-outlined" style={active ? FILLED_ICON : undefined}>
              {item.icon}
            </span>
            <span className="text-body-md">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex items-stretch justify-around">
      {items.map((item) => {
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-label-sm",
              active ? "font-bold text-primary" : "text-on-surface-variant",
            )}
          >
            <span
              className={clsx(
                "material-symbols-outlined rounded-lg px-4 py-0.5",
                active && "bg-surface-container-highest/60",
              )}
              style={active ? FILLED_ICON : undefined}
            >
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
