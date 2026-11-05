export type Gender = "femenino" | "masculino" | "unisex";
export type Status = "draft" | "published" | "archived";

export type BrandOption = {
  id: number;
  name: string;
};

export type ProductFormValues = {
  id: number;
  name: string;
  brandId: number;
  gender: Gender;
  description: string;
  price: string;
  status: Status;
  featured: boolean;
  sortOrder: string;
  notesTop: string;
  notesHeart: string;
  notesBase: string;
};

export type ProductSource = {
  id: number;
  name: string;
  brand: { id: number };
  gender: Gender;
  description: string | null;
  priceCents: number | null;
  status: Status;
  featured: boolean;
  sortOrder: number;
  notes: { top: string[]; heart: string[]; base: string[] };
};

function centsToPriceInput(cents: number | null): string {
  if (cents === null) return "";
  const whole = Math.trunc(cents / 100);
  const frac = Math.abs(cents % 100);
  if (frac === 0) return String(whole);
  return `${whole}.${String(frac).padStart(2, "0")}`;
}

export function toFormValues(product: ProductSource): ProductFormValues {
  return {
    id: product.id,
    name: product.name,
    brandId: product.brand.id,
    gender: product.gender,
    description: product.description ?? "",
    price: centsToPriceInput(product.priceCents),
    status: product.status,
    featured: product.featured,
    sortOrder: String(product.sortOrder),
    notesTop: product.notes.top.join(", "),
    notesHeart: product.notes.heart.join(", "),
    notesBase: product.notes.base.join(", "),
  };
}
