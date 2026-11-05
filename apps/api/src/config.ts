import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  SITE_URL: z.url(),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  /** false en pruebas: agrega X-Robots-Tag noindex. true solo en producción. */
  ALLOW_INDEXING: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  // Almacenamiento (cualquier servidor compatible con S3)
  S3_ENDPOINT: z.string().optional(), // vacío = AWS S3 real
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  S3_BUCKET_MEDIA: z.string().default("media"),
  S3_BUCKET_PRIVATE: z.string().default("private"),

  // PDF
  CHROMIUM_PATH: z.string().optional(),
  PRINT_BASE_URL: z.string().default("http://web:3000"),
});

export const config = schema.parse(process.env);
export type Config = typeof config;