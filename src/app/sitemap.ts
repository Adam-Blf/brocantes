import type { MetadataRoute } from "next";
import { communesCouvertes } from "@/lib/recherche";

/**
 * Le plan du site ne liste que les communes COUVERTES. Y mettre les 1 266
 * communes franciliennes reviendrait a soumettre 1 238 pages vides a
 * l'indexation, ce qui dilue le site au lieu de le servir.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_URL ?? "https://brocantes.beloucif.com";
  const communes = await communesCouvertes();

  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/communes`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/mentions-legales`, changeFrequency: "yearly", priority: 0.1 },
    ...communes.map((c) => ({
      url: `${base}/brocantes/${c.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
