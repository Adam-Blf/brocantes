import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { agendaCommune, commune, communesCouvertes } from "@/lib/recherche";
import { LIBELLES } from "@/lib/types";
import { horaires, jourCourt, releve, tarif } from "@/lib/format";
import { Pied } from "@/components/Pied";

// Une passe de collecte par jour : revalider plus souvent ne rendrait rien de
// plus frais.
export const revalidate = 3600;
export const dynamicParams = true;

/**
 * Une page n'existe que pour une commune COUVERTE, c'est a dire dont une source
 * est reellement branchee. Generer les 1 266 communes franciliennes
 * produirait 1 238 pages vides : mauvais pour le referencement, et malhonnete
 * pour qui arrive dessus depuis un moteur de recherche.
 */
export async function generateStaticParams() {
  const communes = await communesCouvertes();
  return communes.map((c) => ({ commune: c.slug }));
}

type Props = { params: Promise<{ commune: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await commune((await params).commune);
  if (!c) return { title: "Commune introuvable" };
  return {
    title: `Brocantes et vide-greniers a ${c.nom}`,
    description:
      `Toutes les brocantes et vide-greniers annonces a ${c.nom} ` +
      `(${c.departement}), d'apres l'agenda officiel de la commune.`,
    alternates: { canonical: `/brocantes/${c.slug}` },
  };
}

export default async function PageCommune({ params }: Props) {
  const slug = (await params).commune;
  const c = await commune(slug);
  if (!c || !c.couverte) notFound();

  const evenements = await agendaCommune(slug);

  const balisage = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Brocantes et vide-greniers a ${c.nom}`,
    numberOfItems: evenements.length,
    itemListElement: evenements.map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Event",
        name: e.titre_affiche,
        startDate: e.debut_le,
        endDate: e.fin_le,
        url: `/evenement/${e.slug}`,
        eventStatus:
          e.statut === "annule"
            ? "https://schema.org/EventCancelled"
            : "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        location: {
          "@type": "Place",
          name: e.adresse_source ?? e.commune,
          address: {
            "@type": "PostalAddress",
            addressLocality: e.commune,
            addressCountry: "FR",
          },
          geo: {
            "@type": "GeoCoordinates",
            latitude: e.latitude,
            longitude: e.longitude,
          },
        },
      },
    })),
  };

  return (
    <main className="mx-auto max-w-3xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(balisage) }}
      />

      <header className="px-4 pt-8 pb-4 sm:px-6">
        <nav className="text-[14px]">
          <Link href="/" className="underline hover:text-[var(--tampon)]">
            Toutes les brocantes
          </Link>
        </nav>
        <h1 className="mt-4 font-[family-name:var(--font-titre)] text-[30px] leading-tight sm:text-[38px]">
          Brocantes et vide-greniers a {c.nom}
        </h1>
        <div className="mt-4 border-t-2 border-b border-[var(--encre)] py-2">
          <p className="text-[14px] uppercase tracking-wider">
            {evenements.length === 0
              ? "Aucune annonce en ce moment"
              : `${evenements.length} annonce${evenements.length > 1 ? "s" : ""} a venir`}
            <span className="text-[var(--encre-pale)]">
              {` - ${c.nom} (${c.departement})`}
            </span>
          </p>
        </div>
      </header>

      {evenements.length === 0 ? (
        <section className="px-4 py-10 sm:px-6">
          <p className="text-[16px] leading-relaxed">
            L&apos;agenda de {c.nom} est bien suivi, il n&apos;annonce
            simplement aucune brocante pour l&apos;instant. La saison va de mars
            a novembre, avec un creux en juillet et en aout.
          </p>
          <p className="mt-4">
            <Link
              href={`/?lieu=${encodeURIComponent(c.nom)}`}
              className="underline hover:text-[var(--tampon)]"
            >
              Voir ce qu&apos;il y a dans les communes voisines
            </Link>
          </p>
        </section>
      ) : (
        <ul>
          {evenements.map((e) => {
            const h = horaires(e.debut_le, e.fin_le);
            return (
              <li key={e.slug} className="filet px-4 py-4 sm:px-6">
                <Link href={`/evenement/${e.slug}`} className="group block">
                  <p className="text-[13px] uppercase tracking-wider text-[var(--tampon)]">
                    {jourCourt(e.debut_le)}
                    {h ? (
                      <span className="text-[var(--encre-pale)]">{` - ${h}`}</span>
                    ) : null}
                  </p>
                  <h2 className="mt-1 text-[19px] leading-snug group-hover:underline">
                    {e.titre_affiche}
                  </h2>
                  <p className="mt-1 text-[14px] text-[var(--encre-pale)]">
                    {LIBELLES[e.type]}
                    {e.adresse_source ? ` - ${e.adresse_source}` : ""}
                    {tarif(e.tarif_visiteur_c)
                      ? ` - ${tarif(e.tarif_visiteur_c)}`
                      : ""}
                  </p>
                  <p className="mt-1 text-[13px] text-[var(--encre-pale)]">
                    {releve(e.releve_le)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <section className="filet mt-8 px-4 py-6 text-[15px] leading-relaxed sm:px-6">
        <h2 className="font-[family-name:var(--font-titre)] text-[20px]">
          D&apos;ou viennent ces annonces
        </h2>
        <p className="mt-2 text-[var(--encre-pale)]">
          Elles sont reprises de l&apos;agenda officiel publie par la commune de{" "}
          {c.nom}, releve chaque jour. Chaque fiche indique sa source et la date
          de son dernier releve. Les informations ne sont ni modifiees ni
          completees : en cas d&apos;ecart, la page de la mairie fait foi.
        </p>
        {evenements.length > 0 ? (
          <p className="mt-3 text-[var(--encre-pale)]">
            Vous organisez une brocante a {c.nom} qui ne figure pas ici ?
            Signalez-la, elle sera verifiee puis publiee.
          </p>
        ) : null}
      </section>

      <Pied />
    </main>
  );
}
