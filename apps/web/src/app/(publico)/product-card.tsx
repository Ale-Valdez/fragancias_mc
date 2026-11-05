import type { CatalogProduct } from "@fmc/shared";
import Image from "next/image";
import Link from "next/link";
import { formatPrice, GENDER_LABEL, primaryImage } from "@/lib/labels";

export function ProductCard({
  product,
  layout = "grid",
}: {
  product: CatalogProduct;
  layout?: "grid" | "row";
}) {
  const image = primaryImage(product.images);
  const row = layout === "row";

  return (
    <Link
      href={`/catalogo/${product.slug}`}
      className={row ? "group flex items-center gap-4 sm:flex-col sm:items-stretch sm:gap-0" : "group flex flex-col"}
    >
      <div
        className={
          row
            ? "relative size-28 shrink-0 border border-card-edge bg-card sm:aspect-square sm:h-auto sm:w-full"
            : "relative aspect-square border border-card-edge bg-card"
        }
      >
        {image ? (
          <Image
            src={image.urlMedium}
            alt=""
            fill
            unoptimized
            sizes={
              row
                ? "(min-width: 1024px) 240px, (min-width: 640px) 30vw, 112px"
                : "(min-width: 1024px) 240px, (min-width: 640px) 30vw, 45vw"
            }
            className="object-contain p-3 sm:p-4"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-xs text-muted">Sin foto</span>
        )}
      </div>
      <div className="min-w-0">
        <p className={`${row ? "sm:mt-3" : "mt-3"} text-xs tracking-[0.14em] text-gold uppercase`}>{product.brand.name}</p>
        <p className="mt-1 text-sm font-medium tracking-wide uppercase group-hover:text-gold-bright">{product.name}</p>
        <p className="mt-1 text-xs text-muted">{GENDER_LABEL[product.gender]}</p>
        {product.priceCents !== null ? <p className="mt-1 text-sm">{formatPrice(product.priceCents)}</p> : null}
      </div>
    </Link>
  );
}
