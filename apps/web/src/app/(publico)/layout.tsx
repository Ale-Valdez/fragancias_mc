import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { siteConfig } from "@/lib/site";
import { SiteHeader } from "./site-header";

const DESCRIPTION = "Extractos de perfume de 60 ml, inspirados en fragancias reconocidas.";

export async function generateMetadata(): Promise<Metadata> {
  const site = await siteConfig();
  return {
    metadataBase: new URL(site.siteUrl),
    title: {
      default: "Fragancias MC",
      template: "%s · Fragancias MC",
    },
    description: DESCRIPTION,
    robots: site.indexing ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      locale: "es_AR",
      siteName: "Fragancias MC",
      type: "website",
      description: DESCRIPTION,
    },
  };
}

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-1 flex-col bg-page font-sans text-ink">
      <Suspense fallback={<div className="h-14 border-b border-rule" />}>
        <SiteHeader />
      </Suspense>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8">{children}</div>
      <footer className="border-t border-rule px-4 py-6 text-center text-xs tracking-[0.16em] text-gold uppercase">
        Olores que enamoran, aromas que dejan huella.
      </footer>
    </div>
  );
}
