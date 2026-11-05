import { GENDERS, PRODUCT_STATUSES } from "@fmc/shared";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const genderEnum = pgEnum("gender", GENDERS);
export const productStatusEnum = pgEnum("product_status", PRODUCT_STATUSES);
export const noteLevelEnum = pgEnum("note_level", ["top", "heart", "base"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 20 }).notNull().default("admin"),
  ...timestamps,
});

export const sessions = pgTable("sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const brands = pgTable("brands", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 140 }).notNull().unique(),
});

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 160 }).notNull().unique(),
    name: varchar("name", { length: 160 }).notNull(),
    brandId: integer("brand_id")
      .notNull()
      .references(() => brands.id),
    gender: genderEnum("gender").notNull(),
    description: text("description"),
    status: productStatusEnum("status").notNull().default("draft"),
    featured: boolean("featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    priceCents: integer("price_cents"), // opcional
    priceUpdatedAt: timestamp("price_updated_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("products_status_idx").on(t.status), index("products_brand_idx").on(t.brandId)],
);

export const productImages = pgTable("product_images", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  // Claves de objeto en el bucket "media" (no URLs completas)
  keyThumb: text("key_thumb").notNull(),
  keyMedium: text("key_medium").notNull(),
  keyLarge: text("key_large").notNull(),
  keyOriginal: text("key_original"), // bucket "private"
  isPrimary: boolean("is_primary").notNull().default(false),
  position: integer("position").notNull().default(0),
});

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 80 }).notNull().unique(),
});

export const productNotes = pgTable(
  "product_notes",
  {
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    noteId: integer("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    level: noteLevelEnum("level").notNull(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.noteId, t.level] })],
);

export const catalogVersions = pgTable("catalog_versions", {
  id: serial("id").primaryKey(),
  variant: varchar("variant", { length: 60 }).notNull(), // ej: "dark", "light-prices"
  objectKey: text("object_key").notNull(), // bucket "media"
  productCount: integer("product_count").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  contentHash: varchar("content_hash", { length: 64 }).notNull(),
  isCurrent: boolean("is_current").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const pages = pgTable("pages", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  title: varchar("title", { length: 200 }).notNull(),
  bodyMd: text("body_md").notNull().default(""),
  published: boolean("published").notNull().default(false),
  ...timestamps,
});

export const settings = pgTable("settings", {
  key: varchar("key", { length: 80 }).primaryKey(),
  value: jsonb("value").notNull(),
});

export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    type: varchar("type", { length: 40 }).notNull(),
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    sessionId: varchar("session_id", { length: 64 }),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("events_type_created_idx").on(t.type, t.createdAt)],
);