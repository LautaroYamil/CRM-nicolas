"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export type NavItem = {
  label: string;
  href: string;
  icon: string;
};

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto">
      {items.map((item) => {
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "mx-2 flex items-center gap-3 px-4 py-3 transition-colors duration-200",
              active
                ? "rounded-full bg-primary-container font-bold text-on-primary-container"
                : "text-secondary-fixed-dim opacity-70 hover:bg-white/5 hover:text-white hover:opacity-100",
            )}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span className="text-label-md font-semibold">{item.label}</span>
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
                "material-symbols-outlined rounded-full px-4 py-0.5",
                active && "bg-primary-fixed",
              )}
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
