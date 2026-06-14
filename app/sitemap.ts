import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.rizzpdf.com";
  // Refreshed at build/deploy time so crawlers see a current lastModified signal
  // instead of a hardcoded date that drifts months into the past.
  const today = new Date().toISOString().split("T")[0];

  return [
    // Core
    { url: base,                              lastModified: today, changeFrequency: "weekly",  priority: 1   },
    { url: `${base}/pricing`,                 lastModified: today, changeFrequency: "monthly", priority: 0.8 },

    // Tools
    { url: `${base}/tools`,                   lastModified: today, changeFrequency: "weekly",  priority: 0.9 },
    { url: `${base}/tools/merge`,             lastModified: today, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/tools/split`,             lastModified: today, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/tools/compress`,          lastModified: today, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/tools/unlock`,            lastModified: today, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/tools/protect`,           lastModified: today, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/tools/sign`,              lastModified: today, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/tools/rotate`,            lastModified: today, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/tools/delete-pages`,      lastModified: today, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/tools/organize`,          lastModified: today, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/tools/watermark`,         lastModified: today, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/tools/page-numbers`,      lastModified: today, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/tools/jpg-to-pdf`,        lastModified: today, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/tools/pdf-to-jpg`,        lastModified: today, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/tools/pdf-to-png`,        lastModified: today, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/tools/pdf-to-word`,       lastModified: today, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/tools/repair`,            lastModified: today, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/tools/batch`,             lastModified: today, changeFrequency: "monthly", priority: 0.7 },

    // Blog
    { url: `${base}/blog`,                                                    lastModified: today, changeFrequency: "weekly",  priority: 0.8 },
    { url: `${base}/blog/merge-pdf-files-online-free`,                        lastModified: today, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog/compress-pdf-without-losing-quality`,                lastModified: today, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog/split-pdf-online-free`,                              lastModified: today, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog/jpg-to-pdf-online-free`,                             lastModified: today, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog/sign-pdf-online-free`,                               lastModified: today, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog/how-to-remove-pdf-password`,                         lastModified: today, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog/unlock-pdf-online-free`,                             lastModified: today, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog/best-pdf-password-remover`,                          lastModified: today, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog/how-to-unlock-pdf-without-password`,                 lastModified: today, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog/remove-pdf-restrictions-online`,                     lastModified: today, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog/convert-pdf-to-word-online-free`,                    lastModified: today, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog/pdf-to-word-without-losing-formatting`,              lastModified: today, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog/how-to-edit-pdf-in-word`,                            lastModified: today, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog/how-to-delete-pages-from-pdf-without-acrobat`,       lastModified: today, changeFrequency: "monthly", priority: 0.9 },
  ];
}
