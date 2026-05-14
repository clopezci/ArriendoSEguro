import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/content/blog/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/dashboard/", "/firma/"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
