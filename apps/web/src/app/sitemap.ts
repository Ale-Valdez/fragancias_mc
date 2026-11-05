import type { MetadataRoute } from "next";
import { listProductSlugs } from "@/lib/catalog-api";
import { siteConfig } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await siteConfig();
  const pages: MetadataRoute.Sitemap = [
    { url: site.siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${site.siteUrl}/catalogo`, changeFrequency: "weekly", priority: 0.8 },
  ];

  try {
    const slugs = await listProductSlugs();
    for (const slug of slugs) {
      pages.push({ url: `${site.siteUrl}/catalogo/${slug}`, changeFrequency: "weekly", priority: 0.6 });
    }
  } catch {
    return pages;
  }

  return pages;
}
