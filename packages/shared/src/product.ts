import { z } from "zod";

export const GENDERS = ["femenino", "masculino", "unisex"] as const;
export const PRODUCT_STATUSES = ["draft", "published", "archived"] as const;
export const NOTE_LEVELS = ["top", "heart", "base"] as const;

export const genderSchema = z.enum(GENDERS);
export const productStatusSchema = z.enum(PRODUCT_STATUSES);
export const noteLevelSchema = z.enum(NOTE_LEVELS);

export const noteNameSchema = z.string().trim().min(1).max(80);

function uniqueNoteNames(names: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const name of names) {
    if (seen.has(name)) continue;
    seen.add(name);
    unique.push(name);
  }
  return unique;
}

/** Si `notes` viene en el body, reemplaza las tres familias. Un nivel ausente queda vacío. */
export const productNotesInputSchema = z
  .object({
    top: z.array(noteNameSchema).default([]),
    heart: z.array(noteNameSchema).default([]),
    base: z.array(noteNameSchema).default([]),
  })
  .transform((notes) => ({
    top: uniqueNoteNames(notes.top),
    heart: uniqueNoteNames(notes.heart),
    base: uniqueNoteNames(notes.base),
  }));

const descriptionWriteSchema = z
  .string()
  .trim()
  .max(2000)
  .nullable()
  .optional()
  .transform((value) => (value === "" ? null : value));

const priceCentsWriteSchema = z.number().int().nonnegative().nullable().optional();

export const productInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  brandId: z.number().int().positive(),
  gender: genderSchema,
  description: descriptionWriteSchema.transform((value) => value ?? null),
  priceCents: priceCentsWriteSchema.transform((value) => value ?? null),
  status: productStatusSchema.default("draft"),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
  notes: productNotesInputSchema.default({ top: [], heart: [], base: [] }),
});

export const productUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    brandId: z.number().int().positive().optional(),
    gender: genderSchema.optional(),
    description: descriptionWriteSchema,
    priceCents: priceCentsWriteSchema,
    status: productStatusSchema.optional(),
    featured: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    notes: productNotesInputSchema.optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: "empty",
  });

export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductUpdate = z.infer<typeof productUpdateSchema>;
export type ProductNotesInput = z.infer<typeof productNotesInputSchema>;
export type Gender = z.infer<typeof genderSchema>;
export type ProductStatus = z.infer<typeof productStatusSchema>;
export type NoteLevel = z.infer<typeof noteLevelSchema>;
