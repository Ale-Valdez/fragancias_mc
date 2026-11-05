import { formatPrice, GENDER_LABEL, type Gender } from "@/lib/labels";

export type { Gender };
export { formatPrice, GENDER_LABEL };

export type Status = "draft" | "published" | "archived";

export type ProductRow = {
  id: number;
  name: string;
  brand: { name: string };
  gender: Gender;
  status: Status;
  priceCents: number | null;
};

export type ProductList = {
  items: ProductRow[];
  total: number;
};

export const STATUS_LABEL: Record<Status, string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
};
