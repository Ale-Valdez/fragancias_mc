import { CatalogApiError, getCurrentPublication } from "@/lib/catalog-api";
import { formatCount } from "@/lib/labels";
import { connection } from "next/server";
import Image from "next/image";
import { CatalogDownloadLink } from "./catalog-download";
import Link from "next/link";

const publishedOn = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const REASONS = [
  "Presentación de 60 ml",
  "Inspirados en perfumes reconocidos",
  "Aromas de excelente duración",
  "Femeninas, masculinas y unisex",
  "Tu fragancia favorita, a un precio accesible",
];

export async function PdfHero() {
  await connection();
  let failed = false;
  let current = null;
  try {
    current = await getCurrentPublication();
  } catch (error) {
    if (!(error instanceof CatalogApiError)) throw error;
    failed = true;
  }

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col items-center px-2 py-14 text-center sm:py-24">
      <p className="text-xs tracking-[0.35em] text-gold uppercase">Catálogo de perfumes</p>
      <h1 className="mt-10">
        <Image
          src="/logo-fragancias-mc.png"
          alt="Fragancias MC · Rojas - Junín - Pergamino"
          width={240}
          height={240}
          priority
          className="mx-auto h-48 w-48 sm:h-60 sm:w-60"
        />
      </h1>
      <div className="mx-auto mt-8 h-px w-36 bg-gold" />
      <p className="mx-auto mt-12 max-w-2xl text-xl leading-snug font-light sm:text-2xl">
        Extractos de perfume de 60 ml, inspirados en tus fragancias favoritas.
      </p>
      <p className="mx-auto mt-8 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
        Cada extracto está elaborado para ofrecer una experiencia olfativa muy similar a la del perfume de
        referencia, con una similitud aromática estimada del{" "}
        <strong className="font-medium text-gold-bright">90% al 95%</strong>. Las imágenes de este catálogo
        muestran esas fragancias originales: el producto es el extracto.
      </p>
      <div className="mt-14 flex items-center justify-center gap-10 sm:gap-16">
        <div>
          <span className="block text-3xl font-light tracking-wide sm:text-4xl">60 ml</span>
          <span className="mt-2 block text-[11px] tracking-[0.22em] text-gold uppercase">Extracto</span>
        </div>
        <div className="h-12 w-px bg-gold/50" aria-hidden="true" />
        <div className="max-w-48">
          <span className="block text-3xl font-light tracking-wide sm:text-4xl">90–95%</span>
          <span className="mt-2 block text-[11px] leading-snug tracking-[0.08em] text-gold uppercase">
            Similitud aromática estimada
          </span>
        </div>
      </div>
      <div className="mx-auto mt-14 flex w-fit max-w-full flex-col items-start gap-3 text-left">
        <p className="self-center text-xs tracking-[0.32em] text-gold uppercase">Por qué elegirlos</p>
        <ul className="space-y-2">
          {REASONS.map((reason) => (
            <li key={reason} className="relative pl-5 text-sm text-reason sm:text-base">
              <span className="absolute top-[0.65em] left-0 h-px w-2.5 bg-gold" aria-hidden="true" />
              {reason}
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-14 text-lg text-gold-bright italic sm:text-xl">Tu esencia, tu estilo, tu personalidad.</p>
      <p className="mx-auto mt-3 max-w-md text-sm tracking-wide text-muted">
        Elegí tu favorito y encontrá el aroma que te representa.
      </p>
      <div className="flex items-center justify-center md:flex-row flex-col gap-4">
        <div className="mt-12">
          <Link href="/catalogo" className="inline-flex h-12 items-center bg-gold px-8 text-sm font-medium tracking-wide text-page hover:bg-gold-bright">
            Ver catálogo online
          </Link>
        </div>
        <div className="mt-12">
          {current ? (
            <CatalogDownloadLink className="inline-flex h-12 items-center bg-gold px-8 text-sm font-medium tracking-wide text-page hover:bg-gold-bright">
              Descargar catálogo PDF
            </CatalogDownloadLink>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex h-12 items-center bg-gold/40 px-8 text-sm font-medium tracking-wide text-page"
            >
              Descargar catálogo PDF
            </button>
          )}
        </div>
      </div>

    </section>
  );
}
