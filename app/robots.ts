import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/dashboard/",
          "/api/",
          "/sign-in/",
          "/sign-up/",
          "/success/",
        ],
      },
    ],
    sitemap: "https://www.rizzpdf.com/sitemap.xml",
    host: "https://www.rizzpdf.com",
  };
}
