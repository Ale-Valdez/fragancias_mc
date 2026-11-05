"use client";

import { publishedCatalogSchema } from "@fmc/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminMutate } from "@/lib/admin-mutate";
import { errorClassName, primaryButtonClassName, quietButtonClassName } from "./form-styles";

type Publication = {
  id: number;
  productCount: number;
  sizeBytes: number;
  createdAt: string;
  url: string;
};

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(date);
}

function formatBytes(size: number): string {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toLocaleString("es-AR", { maximumFractionDigits: 1 })} MB`;
}

function readPublications(body: unknown): { dark: Publication; light: Publication } | null {
  const parsed = publishedCatalogSchema.safeParse(body);
  if (!parsed.success) return null;
  return parsed.data;
}

function PublicationLine({ label, publication }: { label: string; publication: Publication | null }) {
  if (!publication) return <p className="text-sm text-muted">Todavía no hay un PDF {label.toLowerCase()}.</p>;
  return (
    <p className="text-sm">
      {label} · {formatWhen(publication.createdAt)} · {publication.productCount} productos ·{" "}
      {formatBytes(publication.sizeBytes)} ·{" "}
      <a href={publication.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
        Abrir PDF
      </a>
    </p>
  );
}

export function PublishCatalog({ dark, light }: { dark: Publication | null; light: Publication | null }) {
  const router = useRouter();
  const [publications, setPublications] = useState({ dark, light });
  const knownKey = `${dark?.id ?? 0}:${light?.id ?? 0}`;
  const [known, setKnown] = useState(knownKey);
  if (knownKey !== known) {
    setKnown(knownKey);
    setPublications({ dark, light });
  }

  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function publish() {
    if (pending) return;
    if (!confirm) {
      setError(null);
      setNotice(null);
      setConfirm(true);
      return;
    }
    setPending(true);
    setError(null);
    const result = await adminMutate("/catalog/publish", "POST");
    setPending(false);
    setConfirm(false);
    if (!result.ok) {
      if (result.status === 401) {
        router.push("/admin/login");
        return;
      }
      setError(
        result.error === "empty"
          ? "No hay productos publicados. Publicá al menos uno antes de generar el PDF."
          : result.error === "busy"
            ? "Ya se está generando un catálogo."
            : result.error === "network"
              ? "No se pudo conectar con el servidor."
              : "No se pudo generar el PDF.",
      );
      return;
    }
    const created = readPublications(result.body);
    if (!created) {
      setError("Los PDF se generaron, pero no se pudieron mostrar. Recargá la página.");
      router.refresh();
      return;
    }
    setPublications(created);
    setNotice("Catálogo publicado.");
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold">Publicar catálogo</h1>
      <p className="max-w-2xl text-sm text-muted">
        Arma el PDF oscuro y el claro con los productos publicados, y los deja como versiones vigentes. Los
        borradores no entran.
      </p>
      <PublicationLine label="Oscuro" publication={publications.dark} />
      <PublicationLine label="Claro" publication={publications.light} />
      {error ? (
        <p role="alert" className={errorClassName}>
          {error}
        </p>
      ) : null}
      {notice ? <p className="text-sm text-muted">{notice}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => void publish()} className={primaryButtonClassName}>
          {pending ? "Generando…" : confirm ? "Confirmar publicación" : "Publicar catálogo"}
        </button>
        {confirm ? (
          <button type="button" disabled={pending} onClick={() => setConfirm(false)} className={quietButtonClassName}>
            Cancelar
          </button>
        ) : null}
        <a
          href="/print/catalog?theme=dark"
          target="_blank"
          rel="noreferrer"
          className={`${quietButtonClassName} inline-flex items-center`}
        >
          Vista previa oscura
        </a>
        <a
          href="/print/catalog?theme=light"
          target="_blank"
          rel="noreferrer"
          className={`${quietButtonClassName} inline-flex items-center`}
        >
          Vista previa clara
        </a>
      </div>
    </section>
  );
}
