import type { MetadataRoute } from "next";

const BASE = "https://ai-clinic-receptionist-gold.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
