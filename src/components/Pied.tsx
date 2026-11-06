import Link from "next/link";

/**
 * Le pied porte la mention de source exigee par l'article L322-1 du code des
 * relations entre le public et l'administration. Elle est aussi repetee sur
 * chaque fiche, ou elle designe la commune precise.
 */
export function Pied() {
  return (
    <footer className="filet mt-8 px-4 py-8 text-[13px] leading-relaxed text-[var(--encre-pale)] sm:px-6">
      <p>
        Les annonces proviennent des agendas publies par les communes du
        Val-de-Marne et du jeu de donnees ouvert de la Ville de Paris, sous
        licence ODbL. Chaque fiche cite sa source et la date de son dernier
        releve. Les informations sont reprises sans modification : en cas
        d&apos;ecart, la page officielle de la commune fait foi.
      </p>
      <p className="mt-3">
        Fond de carte IGN, Geoplateforme, licence etalab 2.0.
      </p>
      <nav className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        <Link href="/communes" className="underline hover:text-[var(--tampon)]">
          Communes couvertes
        </Link>
        <Link href="/mentions-legales" className="underline hover:text-[var(--tampon)]">
          Mentions legales
        </Link>
      </nav>
    </footer>
  );
}
