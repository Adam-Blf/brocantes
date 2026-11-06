import Link from "next/link";
import type { Evenement } from "@/lib/types";
import { LIBELLES } from "@/lib/types";
import {
  distance,
  horaires,
  jourCourt,
  surPlusieursJours,
  tarif,
} from "@/lib/format";

/**
 * Une annonce, dans le registre d'une petite annonce de journal : le titre,
 * puis une ligne d'informations separees par des points mediants remplaces par
 * des tirets, et rien d'autre. Ni carte, ni ombre, ni coin arrondi.
 */
export function Annonce({
  e,
  actif,
  onSurvol,
}: {
  e: Evenement;
  actif?: boolean;
  onSurvol?: (slug: string | null) => void;
}) {
  const h = horaires(e.debut_le, e.fin_le);
  const plusieurs = surPlusieursJours(e.debut_le, e.fin_le);
  const prix = tarif(e.tarif_visiteur_c);

  return (
    <li
      className={`filet px-4 py-4 transition-colors sm:px-6 ${
        actif ? "bg-[var(--papier-creux)]" : ""
      }`}
      onMouseEnter={() => onSurvol?.(e.slug)}
      onMouseLeave={() => onSurvol?.(null)}
    >
      <Link href={`/evenement/${e.slug}`} className="block group">
        <p className="text-[13px] uppercase tracking-wider text-[var(--tampon)]">
          {jourCourt(e.debut_le)}
          {plusieurs ? ` au ${jourCourt(e.fin_le)}` : ""}
          {h ? <span className="text-[var(--encre-pale)]">{` - ${h}`}</span> : null}
        </p>

        <h3 className="mt-1 text-[19px] leading-snug group-hover:underline">
          {e.titre_affiche}
        </h3>

        <p className="mt-1 text-[14px] text-[var(--encre-pale)]">
          <span className="uppercase tracking-wide text-[var(--encre)]">
            {e.commune}
          </span>
          {" - a "}
          {distance(e.distance_m)}
          {" - "}
          {LIBELLES[e.type]}
          {e.nb_exposants ? ` - ${e.nb_exposants} exposants` : ""}
          {prix ? ` - ${prix}` : ""}
        </p>

        {e.statut === "annule" ? (
          <p className="mt-2 inline-block bg-[var(--tampon-pale)] px-2 py-1 text-[13px] font-semibold uppercase tracking-wider text-[var(--tampon)]">
            Annule
          </p>
        ) : null}
      </Link>
    </li>
  );
}
