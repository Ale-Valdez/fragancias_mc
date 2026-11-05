"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeSwitch } from "@/components/theme-switch";

const LINKS = [
  { href: "/", label: "Inicio", active: (pathname: string) => pathname === "/" },
  { href: "/catalogo", label: "Catálogo", active: (pathname: string) => pathname.startsWith("/catalogo") },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="text-sm tracking-[0.22em] uppercase">
          Fragancias MC
        </Link>
        <div className="flex items-center gap-4 sm:gap-6">
          <nav className="flex gap-4 text-sm sm:gap-6">
            {LINKS.map((link) => {
              const current = link.active(pathname);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={current ? "page" : undefined}
                  className={current ? "text-gold-bright" : "text-reason hover:text-ink"}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <ThemeSwitch />
        </div>
      </div>
    </header>
  );
}
