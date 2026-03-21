import { MetadataRoute } from "next";

const base = "https://www.rizzpdf.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`,     lastModified: new Date(), changeFrequency: "monthly", priority: 1.0 },
    { url: `${base}/tools`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/blog`,  lastModified: new Date(), changeFrequency: "weekly",  priority: 0.8 },
  ];

  const toolSlugs = [
    "merge", "split", "compress", "rotate",
    "pdf-to-jpg", "pdf-to-png", "jpg-to-pdf",
    "watermark", "sign", "organize",
    "page-numbers", "delete-pages", "repair",
  ];

  const toolPages: MetadataRoute.Sitemap = toolSlugs.map((slug) => ({
    url: `${base}/tools/${slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.85,
  }));

  const blogSlugs = [
    "remove-pdf-restrictions-online",
    "unlock-pdf-online-free",
    "how-to-remove-pdf-password",
    "how-to-unlock-pdf-without-password",
    "best-pdf-password-remover",
  ];

  const blogPages: MetadataRoute.Sitemap = blogSlugs.map((slug) => ({
    url: `${base}/blog/${slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [...staticPages, ...toolPages, ...blogPages];
}
