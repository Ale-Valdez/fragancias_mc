import { z } from "zod";

/** Tipos que escribe el servidor o el navegador. La columna sigue siendo texto. */
export const PUBLIC_EVENT_TYPES = ["product_view", "whatsapp_click"] as const;
export const EVENT_TYPES = ["catalog_download", ...PUBLIC_EVENT_TYPES] as const;
export const METRIC_RANGES = ["7d", "30d", "90d"] as const;

const productIdSchema = z.number().int().positive().max(2_147_483_647);

/** Lo único que puede mandar el catálogo público. La descarga la anota el servidor. */
export const publicEventSchema = z.object({
  type: z.enum(PUBLIC_EVENT_TYPES),
  productId: productIdSchema,
});

export const metricsQuerySchema = z.object({
  range: z.enum(METRIC_RANGES).default("30d"),
});

const metricCountsSchema = z.object({
  catalogDownloads: z.number().int().nonnegative(),
  productViews: z.number().int().nonnegative(),
  whatsappClicks: z.number().int().nonnegative(),
});

export const metricsSchema = z.object({
  range: z.enum(METRIC_RANGES),
  from: z.iso.datetime(),
  to: z.iso.datetime(),
  totals: metricCountsSchema.extend({
    visitors: z.number().int().nonnegative(),
  }),
  series: z.array(
    metricCountsSchema.extend({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  ),
  topProducts: z.array(
    z.object({
      productId: productIdSchema,
      name: z.string(),
      brand: z.string(),
      views: z.number().int().nonnegative(),
      whatsappClicks: z.number().int().nonnegative(),
    }),
  ),
});

export type PublicEvent = z.infer<typeof publicEventSchema>;
export type MetricRange = (typeof METRIC_RANGES)[number];
export type Metrics = z.infer<typeof metricsSchema>;
