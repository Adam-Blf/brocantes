/**
 * Famille "ics-wp" : WordPress sans flux global, mais avec un export
 * iCalendar par fiche.
 *
 * Cas de Chevilly-Larue. La page agenda liste les fiches, chaque fiche expose
 * `?get_ics=1&post_id=N`. C'est trois requetes la ou un flux en demanderait
 * une, donc le filtre s'applique AVANT d'aller chercher la fiche : on ne
 * telecharge que ce qui ressemble deja a une brocante, pas les vingt-quatre
 * entrees de l'agenda.
 *
 * Argument qui compte : un bouton d'export iCalendar existe pour que
 * l'evenement entre dans l'agenda de quelqu'un. Le consommer par programme est
 * l'usage normal du format, pas son detournement.
 */

import { obtenir } from "../lib/http.ts";
import { classer } from "../lib/classer.ts";
import { extraireDates } from "../lib/dates.ts";
import type { EvenementBrut, ResultatCollecte, Source } from "../lib/types.ts";

/** L'URL d'une fiche porte son titre en clair, ce qui suffit a pre-filtrer. */
function slugEnTexte(url: string): string {
  const dernier = url.replace(/\/+$/, "").split("/").pop() ?? "";
  return decodeURIComponent(dernier).replace(/-/g, " ");
}

/** Deplie un champ iCalendar : les lignes longues sont coupees et indentees. */
function deplier(ics: string): string {
  return ics.replace(/\r?\n[ \t]/g, "");
}

function champIcs(ics: string, nom: string): string | undefined {
  const m = new RegExp(`^${nom}(?:;[^:\\n]*)?:(.*)$`, "m").exec(ics);
  return m?.[1]?.trim().replace(/\\,/g, ",").replace(/\\n/g, " ");
}

/** DTSTART accepte 20261004 comme 20261004T080000Z. */
function dateIcs(v?: string): Date | null {
  if (!v) return null;
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(v.trim());
  if (!m) return null;
  const [, a, mo, j, h = "08", mi = "00", s = "00", z] = m;
  const iso = `${a}-${mo}-${j}T${h}:${mi}:${s}${z ? "Z" : "+02:00"}`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export async function collecter(source: Source): Promise<ResultatCollecte> {
  const evenements: EvenementBrut[] = [];
  let vues = 0;

  try {
    const liste = await obtenir(source.url);
    if (liste.statut !== 200) {
      return { source, evenements, vues, erreur: `HTTP ${liste.statut} sur la liste` };
    }

    const base = new URL(source.url).origin;
    const fiches = [
      ...new Set(
        [...liste.texte.matchAll(/href="([^"]*\/agenda\/[^"#?]+\/)"/g)]
          .map((m) => (m[1].startsWith("http") ? m[1] : base + m[1])),
      ),
    ];
    vues = fiches.length;

    // Filtrage sur le titre porte par l'URL, avant toute requete supplementaire.
    const candidates = fiches.filter((u) => classer(slugEnTexte(u)).type);

    for (const url of candidates) {
      const fiche = await obtenir(url);
      if (fiche.statut !== 200) continue;

      const titre =
        /<h1[^>]*>(.*?)<\/h1>/s.exec(fiche.texte)?.[1]
          ?.replace(/<[^>]+>/g, "")
          .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
          .replace(/&amp;/g, "&")
          .replace(/&rsquo;/g, "'")
          .trim() ?? slugEnTexte(url);

      // La classe body porte l'identifiant, forme plus stable que le lien ICS
      // lui-meme qui peut etre construit en JavaScript.
      const id = /postid-(\d+)/.exec(fiche.texte)?.[1];

      let debut: Date | null = null;
      let fin: Date | null = null;
      let lieu: string | undefined;

      if (id) {
        const ics = await obtenir(`${url}?get_ics=1&post_id=${id}`);
        if (ics.statut === 200 && ics.texte.includes("BEGIN:VEVENT")) {
          const corps = deplier(ics.texte);
          debut = dateIcs(champIcs(corps, "DTSTART"));
          fin = dateIcs(champIcs(corps, "DTEND"));
          lieu = champIcs(corps, "LOCATION") || undefined;
        }
      }

      // Repli sur la date ecrite en francais dans la page, quand l'export
      // iCalendar ne repond pas. Mieux vaut une date lue dans le texte de la
      // mairie que pas d'evenement du tout.
      if (!debut) {
        const texte = fiche.texte.replace(/<[^>]+>/g, " ");
        const d = extraireDates({ titre, contenu: texte });
        if (d) {
          debut = d.debut;
          fin = d.fin;
        }
      }
      if (!debut) continue;

      evenements.push({
        idExterne: id ?? url,
        titreSource: titre,
        adresseSource: lieu,
        debutLe: debut,
        finLe: fin ?? debut,
        urlSource: url,
      });
    }

    return { source, evenements, vues };
  } catch (e) {
    return {
      source,
      evenements,
      vues,
      erreur: e instanceof Error ? e.message : String(e),
    };
  }
}
