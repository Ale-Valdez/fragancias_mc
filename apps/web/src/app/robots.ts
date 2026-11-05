import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await siteConfig();
  if (!site.indexing) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/print"] },
    sitemap: `${site.siteUrl}/sitemap.xml`,
  };
}
