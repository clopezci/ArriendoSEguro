import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/content/blog/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /interno = landing comercial interna (duplica el propósito de la home);
      // /panel = módulos legacy. Se excluyen del rastreo para evitar contenido
      // duplicado / "doorway", señalado por AdSense.
      disallow: ["/admin", "/api/", "/dashboard/", "/firma/", "/interno/", "/panel/"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
