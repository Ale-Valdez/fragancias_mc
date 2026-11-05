import { connection } from "next/server";

export type SiteConfig = {
  siteUrl: string;
  indexing: boolean;
  whatsappPhone: string | null;
};

/**
 * Configuración pública leída en cada request.
 * `connection()` evita que Next deje estos valores fijos en la imagen de Docker.
 */
export async function siteConfig(): Promise<SiteConfig> {
  await connection();

  const configured = process.env.SITE_URL?.trim();
  let siteUrl = "http://localhost:3000";
  if (configured) {
    try {
      siteUrl = new URL(configured).origin;
    } catch {
      siteUrl = "http://localhost:3000";
    }
  }

  const digits = (process.env.WHATSAPP_PHONE ?? "").replace(/\D/g, "");

  return {
    siteUrl,
    indexing: process.env.ALLOW_INDEXING === "true",
    whatsappPhone: digits.length >= 8 && digits.length <= 15 ? digits : null,
  };
}

export function whatsappHref(phone: string, text: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
