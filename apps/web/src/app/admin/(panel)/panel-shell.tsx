"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ThemeSwitch } from "@/components/theme-switch";
import { LogoutButton } from "./logout-button";

const LINKS: { href: string; label: string; active: (pathname: string) => boolean }[] = [
  {
    href: "/admin",
    label: "Productos",
    active: (pathname) => pathname === "/admin" || pathname.startsWith("/admin/productos"),
  },
  { href: "/admin/marcas", label: "Marcas", active: (pathname) => pathname.startsWith("/admin/marcas") },
  {
    href: "/admin/herramientas",
    label: "Herramientas",
    active: (pathname) => pathname.startsWith("/admin/herramientas"),
  },
  { href: "/admin/publicar", label: "Publicar", active: (pathname) => pathname.startsWith("/admin/publicar") },
  { href: "/admin/metricas", label: "Métricas", active: (pathname) => pathname.startsWith("/admin/metricas") },
];

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 5h14M3 10h14M3 15h14" />
    </svg>
  );
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 px-3">
      {LINKS.map((link) => {
        const current = link.active(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={current ? "page" : undefined}
            onClick={onNavigate}
            className={`rounded-md px-3 py-3 text-sm ${
              current ? "bg-page font-medium text-gold" : "hover:bg-page"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function PanelShell({ email, children }: { email: string; children: ReactNode }) {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const closeRef = useRef<HTMLButtonElement>(null);
  const current = LINKS.find((link) => link.active(pathname))?.label ?? "Panel";

  function openMenu() {
    setOpenPath(pathname);
  }

  function closeMenu() {
    setOpenPath(null);
  }

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenPath(null);
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col self-start overflow-y-auto border-r border-rule bg-elevated lg:flex">
        <div className="px-4 py-5">
          <p className="text-sm font-semibold">Fragancias MC</p>
          <p className="mt-1 truncate text-xs text-muted">{email}</p>
        </div>
        <NavLinks pathname={pathname} />
        <div className="mt-auto flex flex-col items-start gap-4 border-t border-rule p-4">
          <ThemeSwitch />
          <LogoutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-rule px-4 py-3 lg:hidden">
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-rule"
            aria-expanded={open}
            aria-controls="admin-menu"
            onClick={openMenu}
          >
            <span className="sr-only">Abrir menú</span>
            <MenuIcon />
          </button>
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{current}</p>
          <ThemeSwitch />
        </header>
        <div className="flex flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Cerrar menú" className="absolute inset-0 bg-black/40" onClick={closeMenu} />
          <aside id="admin-menu" className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-elevated shadow-xl">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Fragancias MC</p>
                <p className="truncate text-xs text-muted">{email}</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={closeMenu}
                className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-rule text-sm"
              >
                <span className="sr-only">Cerrar menú</span>
                <span aria-hidden="true">✕</span>
              </button>
            </div>
            <NavLinks pathname={pathname} onNavigate={closeMenu} />
            <div className="mt-auto flex flex-col items-start gap-4 border-t border-rule p-4">
              <ThemeSwitch />
              <LogoutButton />
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
