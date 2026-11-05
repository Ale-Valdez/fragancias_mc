import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogApiError, getProduct } from "@/lib/catalog-api";
import { formatPrice, GENDER_LABEL, NOTE_LABEL, primaryImage } from "@/lib/labels";
import { siteConfig } from "@/lib/site";
import { TrackProductView } from "../../track-event";
import { WhatsappLink } from "./whatsapp-link";

export const instant = false;

type FichaProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: FichaProps): Promise<Metadata> {
  const { slug } = await params;
  let product;
  try {
    product = await getProduct(slug);
  } catch (error) {
    if (error instanceof CatalogApiError) return { title: "Fragancia" };
    throw error;
  }
  if (!product) return { title: "Fragancia no encontrada" };

  const description =
    product.description?.trim() || `${product.name}, extracto inspirado en ${product.brand.name}.`;
  const image = primaryImage(product.images);
  const path = `/catalogo/${product.slug}`;

  return {
    title: product.name,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${product.name} · ${product.brand.name}`,
      description,
      url: path,
      images: image ? [{ url: image.urlLarge, alt: product.name }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: FichaProps) {
  const { slug } = await params;

  let product;
  try {
    product = await getProduct(slug);
  } catch (error) {
    if (error instanceof CatalogApiError) {
      return <p className="text-sm text-gold-bright">No se pudo cargar la fragancia.</p>;
    }
    throw error;
  }
  if (!product) notFound();

  const site = await siteConfig();
  const image = primaryImage(product.images);
  const gallery = product.images.filter((item) => item.id !== image?.id);
  const notes = (["top", "heart", "base"] as const).filter((level) => product.notes[level].length > 0);

  return (
    <article className="grid gap-10 lg:grid-cols-2">
      <TrackProductView productId={product.id} />
      <div>
        <div className="relative aspect-square bg-card border border-card-edge">
          {image ? (
            <Image
              src={image.urlLarge}
              alt={product.name}
              fill
              unoptimized
              priority
              sizes="(min-width: 1024px) 480px, 100vw"
              className="object-contain p-8"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-sm text-muted">Sin foto</span>
          )}
        </div>
        {gallery.length > 0 ? (
          <ul className="mt-3 grid grid-cols-4 gap-3">
            {gallery.map((item) => (
              <li key={item.id} className="relative aspect-square bg-card border border-card-edge">
                <Image
                  src={item.urlThumb}
                  alt=""
                  fill
                  unoptimized
                  sizes="120px"
                  className="object-contain p-2"
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div>
        <p className="text-xs tracking-[0.18em] text-gold uppercase">{product.brand.name}</p>
        <h1 className="mt-2 text-4xl font-light">{product.name}</h1>
        <p className="mt-3 text-sm text-muted">{GENDER_LABEL[product.gender]}</p>
        {product.priceCents !== null ? <p className="mt-4 text-lg">{formatPrice(product.priceCents)}</p> : null}
        {product.description ? <p className="mt-6 max-w-prose leading-relaxed text-reason">{product.description}</p> : null}
        {notes.length > 0 ? (
          <dl className="mt-8 grid gap-4">
            {notes.map((level) => (
              <div key={level}>
                <dt className="text-xs tracking-[0.16em] text-gold uppercase">{NOTE_LABEL[level]}</dt>
                <dd className="mt-1 text-sm text-reason">{product.notes[level].join(", ")}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {site.whatsappPhone ? (
          <div className="mt-8">
            <WhatsappLink
              productId={product.id}
              phone={site.whatsappPhone}
              name={product.name}
              brand={product.brand.name}
              pageUrl={`${site.siteUrl}/catalogo/${product.slug}`}
            />
          </div>
        ) : null}
        <p className="mt-8">
          <Link href="/catalogo" className="text-sm text-gold-bright underline underline-offset-4">
            Volver al catálogo
          </Link>
        </p>
      </div>
    </article>
  );
}
