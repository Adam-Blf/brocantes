import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fiche } from "@/lib/recherche";
import { LIBELLES } from "@/lib/types";
import {
  horaires,
  itineraire,
  itineraireSecours,
  jour,
  releve,
  surPlusieursJours,
  tarif,
} from "@/lib/format";
import { Pied } from "@/components/Pied";

export const revalidate = 900;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const f = await fiche((await params).slug);
  if (!f) return { title: "Annonce introuvable" };
  return {
    title: `${f.titre_affiche} - ${f.commune}`,
    description: `${LIBELLES[f.type]} a ${f.commune}, le ${jour(f.debut_le)}.`,
  };
}

export default async function Fiche({ params }: Props) {
  const f = await fiche((await params).slug);
  if (!f) notFound();

  const h = horaires(f.debut_le, f.fin_le);
  const plusieurs = surPlusieursJours(f.debut_le, f.fin_le);
  const prix = tarif(f.tarif_visiteur_c);
  const prixExposant = tarif(f.tarif_exposant_c);
  const lieu = f.adresse_source ?? f.commune;

  // Balisage schema.org. Le lieu n'est declare qu'avec ce que la source a
  // publie : inventer une adresse precise a partir du centre d'une commune
  // serait une denaturation.
  const balisage = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: f.titre_affiche,
    startDate: f.debut_le,
    endDate: f.fin_le,
    eventStatus:
      f.statut === "annule"
        ? "https://schema.org/EventCancelled"
        : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: lieu,
      address: {
        "@type": "PostalAddress",
        streetAddress: f.adresse_source ?? undefined,
        postalCode: f.code_postal ?? undefined,
        addressLocality: f.commune,
        addressCountry: "FR",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: f.latitude,
        longitude: f.longitude,
      },
    },
    ...(f.organisateur
      ? { organizer: { "@type": "Organization", name: f.organisateur } }
      : {}),
    ...(f.sources[0] ? { sameAs: f.sources[0].url } : {}),
  };

  return (
    <main className="mx-auto max-w-3xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(balisage) }}
      />

      <nav className="px-4 pt-8 text-[14px] sm:px-6">
        <Link href="/" className="underline hover:text-[var(--tampon)]">
          Toutes les brocantes
        </Link>
        {f.commune_slug ? (
          <>
            {" - "}
            <Link
              href={`/brocantes/${f.commune_slug}`}
              className="underline hover:text-[var(--tampon)]"
            >
              {f.commune}
            </Link>
          </>
        ) : null}
      </nav>

      <article className="px-4 py-6 sm:px-6">
        <p className="text-[14px] uppercase tracking-wider text-[var(--tampon)]">
          {LIBELLES[f.type]}
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-titre)] text-[30px] leading-tight sm:text-[38px]">
          {f.titre_affiche}
        </h1>

        {f.statut === "annule" ? (
          <p className="mt-4 inline-block bg-[var(--tampon-pale)] px-3 py-2 text-[15px] font-semibold uppercase tracking-wider text-[var(--tampon)]">
            Cet evenement est annonce comme annule
          </p>
        ) : null}

        <dl className="filet mt-6 divide-y divide-[var(--filet)]">
          <Ligne terme="Date">
            {jour(f.debut_le)}
            {plusieurs ? ` au ${jour(f.fin_le)}` : ""}
          </Ligne>
          <Ligne terme="Horaires">{h ?? "non renseignes"}</Ligne>
          <Ligne terme="Adresse">{f.adresse_source ?? "non renseignee"}</Ligne>
          <Ligne terme="Commune">{f.commune}</Ligne>
          <Ligne terme="Exposants">
            {f.nb_exposants ? String(f.nb_exposants) : "non renseigne"}
          </Ligne>
          <Ligne terme="Entree">{prix ?? "non renseignee"}</Ligne>
          <Ligne terme="Tarif exposant">{prixExposant ?? "non renseigne"}</Ligne>
          <Ligne terme="Organisateur">{f.organisateur ?? "non renseigne"}</Ligne>
        </dl>

        <p className="mt-6 flex flex-wrap gap-3">
          <a
            href={itineraire(f.latitude, f.longitude, f.titre_affiche)}
            className="inline-flex items-center border border-[var(--tampon)] bg-[var(--tampon)] px-5 py-3 text-[16px] text-[var(--papier)]"
          >
            Itineraire
          </a>
          <a
            href={itineraireSecours(f.latitude, f.longitude)}
            rel="noreferrer"
            className="inline-flex items-center border border-[var(--filet)] px-5 py-3 text-[16px] hover:border-[var(--tampon)]"
          >
            Voir sur une carte
          </a>
        </p>

        {f.description ? (
          <div className="filet mt-8 pt-6">
            <p className="whitespace-pre-line text-[16px] leading-relaxed">
              {f.description}
            </p>
          </div>
        ) : null}

        {/* Mention de source, obligatoire au titre de l'article L322-1 du code
            des relations entre le public et l'administration. */}
        <div className="filet mt-8 pt-6 text-[14px] text-[var(--encre-pale)]">
          <h2 className="text-[14px] uppercase tracking-wider text-[var(--encre)]">
            Source
          </h2>
          <ul className="mt-2 space-y-2">
            {f.sources.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  rel="noreferrer"
                  className="underline hover:text-[var(--tampon)]"
                >
                  {s.nom}
                </a>
                {` - ${releve(s.vu_le)} - ${s.licence}`}
              </li>
            ))}
            {f.sources.length === 0 ? <li>source non enregistree</li> : null}
          </ul>
          <p className="mt-3">
            Information reprise sans modification. En cas d&apos;ecart, la page
            officielle fait foi.
          </p>
        </div>
      </article>

      <Pied />
    </main>
  );
}

function Ligne({
  terme,
  children,
}: {
  terme: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 py-3">
      <dt className="w-36 shrink-0 text-[14px] uppercase tracking-wider text-[var(--encre-pale)]">
        {terme}
      </dt>
      <dd className="text-[16px]">{children}</dd>
    </div>
  );
}
