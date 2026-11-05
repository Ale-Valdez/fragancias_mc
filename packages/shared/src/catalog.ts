import { z } from "zod";
import { genderSchema, productStatusSchema } from "./product.js";

export const CATALOG_SORTS = ["sort", "name", "price", "newest"] as const;

/** Filtros de querystring. `sort` usa `sort_order`. */
export const catalogListQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => value || undefined),
  gender: genderSchema.optional(),
  brand: z.string().trim().min(1).max(140).optional(),
  featured: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
  sort: z.enum(CATALOG_SORTS).default("sort"),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});

export const adminProductListQuerySchema = catalogListQuerySchema.extend({
  status: productStatusSchema.optional(),
});

export const brandInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

/**
 * Ajuste masivo. `value` son puntos porcentuales en "percent" (10 = +10%)
 * y centavos en "set" y "delta".
 * Sin `productIds`, `brandId` ni `gender`, el alcance es todo producto que ya tiene precio.
 */
export const priceAdjustSchema = z
  .object({
    mode: z.enum(["percent", "set", "delta"]),
    value: z.number().int(),
    productIds: z.array(z.number().int().positive()).min(1).max(500).optional(),
    brandId: z.number().int().positive().optional(),
    gender: genderSchema.optional(),
  })
  .superRefine((body, ctx) => {
    if (body.mode === "set" && body.value < 0) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "set_requires_nonnegative" });
    }
  });

/** Pesos con punto decimal y hasta 2 decimales. Vacío significa sin precio. */
export const pricePesosSchema = z
  .string()
  .trim()
  .transform((text, ctx) => {
    if (text === "") return null;
    if (!/^\d+(\.\d{1,2})?$/.test(text)) {
      ctx.addIssue({ code: "custom", message: "invalid_price" });
      return z.NEVER;
    }
    const [whole, frac = ""] = text.split(".");
    if (whole === undefined) {
      ctx.addIssue({ code: "custom", message: "invalid_price" });
      return z.NEVER;
    }
    const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
    if (!Number.isSafeInteger(cents)) {
      ctx.addIssue({ code: "custom", message: "invalid_price" });
      return z.NEVER;
    }
    return cents;
  });

const csvBooleanSchema = z
  .string()
  .trim()
  .optional()
  .default("")
  .transform((value, ctx) => {
    const text = value.toLowerCase();
    if (text === "" || text === "false" || text === "0" || text === "no") return false;
    if (text === "true" || text === "1" || text === "si" || text === "sí") return true;
    ctx.addIssue({ code: "custom", message: "invalid_boolean" });
    return z.NEVER;
  });

const csvStatusSchema = z
  .union([productStatusSchema, z.literal("")])
  .optional()
  .default("")
  .transform((value) => (value === "" ? "draft" : value));

const csvNoteListSchema = z
  .string()
  .trim()
  .optional()
  .default("")
  .transform((value, ctx) => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const part of value.split(",")) {
      const name = part.trim();
      if (!name || seen.has(name)) continue;
      if (name.length > 80) {
        ctx.addIssue({ code: "custom", message: "note_too_long" });
        return z.NEVER;
      }
      seen.add(name);
      names.push(name);
    }
    return names;
  });

/**
 * Fila de CSV. Columnas: name, brand, gender, description, price, status,
 * featured, notes_top, notes_heart, notes_base.
 * `price` va en pesos. Las notas de una familia van separadas por coma.
 */
export const csvProductRowSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    brand: z.string().trim().min(1).max(120),
    gender: genderSchema,
    description: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .default("")
      .transform((value) => (value === "" ? null : value)),
    price: z.string().optional().default("").pipe(pricePesosSchema),
    status: csvStatusSchema,
    featured: csvBooleanSchema,
    notes_top: csvNoteListSchema,
    notes_heart: csvNoteListSchema,
    notes_base: csvNoteListSchema,
  })
  .transform((row) => ({
    name: row.name,
    brand: row.brand,
    gender: row.gender,
    description: row.description,
    priceCents: row.price,
    status: row.status,
    featured: row.featured,
    notes: {
      top: row.notes_top,
      heart: row.notes_heart,
      base: row.notes_base,
    },
  }));

export const catalogBrandSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  slug: z.string(),
});

export const catalogBrandListSchema = z.array(catalogBrandSchema);

export const catalogImageSchema = z.object({
  id: z.number().int().positive(),
  urlThumb: z.string().min(1),
  urlMedium: z.string().min(1),
  urlLarge: z.string().min(1),
  isPrimary: z.boolean(),
  position: z.number().int().nonnegative(),
});

export const catalogNotesSchema = z.object({
  top: z.array(z.string()),
  heart: z.array(z.string()),
  base: z.array(z.string()),
});

export const catalogProductSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string(),
  name: z.string(),
  brand: catalogBrandSchema,
  gender: genderSchema,
  description: z.string().nullable(),
  priceCents: z.number().int().nonnegative().nullable(),
  featured: z.boolean(),
  images: z.array(catalogImageSchema),
  notes: catalogNotesSchema,
});

export const catalogListSchema = z.object({
  items: z.array(catalogProductSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export const adminProductSchema = catalogProductSchema.extend({
  status: productStatusSchema,
  sortOrder: z.number().int().nonnegative(),
  priceUpdatedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const adminProductListSchema = catalogListSchema.extend({
  items: z.array(adminProductSchema),
});

/** PDF vigente del catálogo. `url` se sirve por `/media`. */
export const catalogPublicationSchema = z.object({
  id: z.number().int().positive(),
  variant: z.string(),
  productCount: z.number().int().nonnegative(),
  sizeBytes: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  url: z.string().min(1),
});

export const currentCatalogSchema = z.object({
  current: catalogPublicationSchema.nullable(),
  light: catalogPublicationSchema.nullable().optional(),
});

export const publishedCatalogSchema = z.object({
  dark: catalogPublicationSchema,
  light: catalogPublicationSchema,
});

export type CatalogListQuery = z.infer<typeof catalogListQuerySchema>;
export type AdminProductListQuery = z.infer<typeof adminProductListQuerySchema>;
export type BrandInput = z.infer<typeof brandInputSchema>;
export type PriceAdjust = z.infer<typeof priceAdjustSchema>;
export type CsvProductRow = z.infer<typeof csvProductRowSchema>;
export type CatalogBrand = z.infer<typeof catalogBrandSchema>;
export type CatalogBrandList = z.infer<typeof catalogBrandListSchema>;
export type CatalogImage = z.infer<typeof catalogImageSchema>;
export type CatalogNotes = z.infer<typeof catalogNotesSchema>;
export type CatalogProduct = z.infer<typeof catalogProductSchema>;
export type CatalogList = z.infer<typeof catalogListSchema>;
export type AdminProduct = z.infer<typeof adminProductSchema>;
export type AdminProductList = z.infer<typeof adminProductListSchema>;
export type CatalogPublication = z.infer<typeof catalogPublicationSchema>;
export type CurrentCatalog = z.infer<typeof currentCatalogSchema>;
export type PublishedCatalog = z.infer<typeof publishedCatalogSchema>;
