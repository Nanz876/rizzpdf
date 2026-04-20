import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.rizzpdf.com";

  return [
    // Core
    { url: base,                              lastModified: "2025-01-01", changeFrequency: "weekly",  priority: 1   },
    { url: `${base}/pricing`,                 lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.8 },

    // Tools
    { url: `${base}/tools`,                   lastModified: "2025-01-01", changeFrequency: "weekly",  priority: 0.9 },
    { url: `${base}/tools/merge`,             lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/tools/split`,             lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/tools/compress`,          lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/tools/unlock`,            lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/tools/protect`,           lastModified: "2025-04-01", changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/tools/sign`,              lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/tools/rotate`,            lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/tools/delete-pages`,      lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/tools/organize`,          lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/tools/watermark`,         lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/tools/page-numbers`,      lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/tools/jpg-to-pdf`,        lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/tools/pdf-to-jpg`,        lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/tools/pdf-to-png`,        lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/tools/pdf-to-word`,       lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/tools/repair`,            lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/tools/batch`,             lastModified: "2025-04-01", changeFrequency: "monthly", priority: 0.7 },

    // Blog
    { url: `${base}/blog`,                                                    lastModified: "2025-04-01", changeFrequency: "weekly",  priority: 0.8 },
    { url: `${base}/blog/merge-pdf-files-online-free`,                        lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog/compress-pdf-without-losing-quality`,                lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog/split-pdf-online-free`,                              lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog/jpg-to-pdf-online-free`,                             lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog/sign-pdf-online-free`,                               lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog/how-to-remove-pdf-password`,                         lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog/unlock-pdf-online-free`,                             lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog/best-pdf-password-remover`,                          lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog/how-to-unlock-pdf-without-password`,                 lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog/remove-pdf-restrictions-online`,                     lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog/convert-pdf-to-word-online-free`,                    lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog/pdf-to-word-without-losing-formatting`,              lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog/how-to-edit-pdf-in-word`,                            lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog/how-to-delete-pages-from-pdf-without-acrobat`,       lastModified: "2025-01-01", changeFrequency: "monthly", priority: 0.9 },
  ];
}
