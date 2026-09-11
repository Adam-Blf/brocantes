/**
 * Famille "rss" : flux RSS d'agenda municipal.
 *
 * Les cinq communes branchees encodent leurs dates de cinq facons distinctes,
 * ce qui est la raison d'etre de la cascade de lib/dates.ts. Ce module ne
 * s'occupe que de decouper le XML et de passer chaque piste a l'extracteur.
 *
 * Pas de bibliotheque XML : un flux RSS est assez regulier pour etre decoupe a
 * la main, et un collecteur qui tape des sites tiers a interet a embarquer le
 * moins de code etranger possible.
 */

import { obtenir } from "../lib/http.ts";
import { classer } from "../lib/classer.ts";
import { extraireDates } from "../lib/dates.ts";
import type { EvenementBrut, ResultatCollecte, Source } from "../lib/types.ts";

function decoder(s: string): string {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function balise(bloc: string, nom: string): string | undefined {
  const m = new RegExp(`<${nom}[^>]*>(.*?)</${nom}>`, "s").exec(bloc);
  return m ? decoder(m[1]) : undefined;
}

/**
 * Retire d'un texte destine au lecteur ce qui appartient au moteur du site.
 *
 * Deux cas rencontres le 11/09/2026 : Fresnes glisse un objet JSON de
 * configuration en tete de description, et Joomla prefixe la sienne par la date
 * et l'heure. Ces morceaux ne sont pas une information publique reutilisee,
 * c'est de la tuyauterie, et les afficher donnerait une fiche illisible.
 */
function nettoyerTexte(t: string): string {
  return t
    .replace(/\{\{.*?\}\}/gs, " ")
    .replace(/^\s*\d{2}\/\d{2}\/\d{4}(\s+\d{1,2}[:h]\d{2})?\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Suffixe de rubrique accole par le moteur du site, du type " (Sorties)".
 * Il part du titre AFFICHE seulement : le titre de la source reste intact,
 * comme l'exige l'article L322-1 du CRPA.
 */
function titreSansRubrique(titre: string): string | undefined {
  const net = titre.replace(/\s*\((?:sorties|agenda|[ée]v[ée]nements?)\)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return net && net !== titre ? net : undefined;
}

export async function collecter(
  source: Source,
  connu?: { etag?: string; modifieLe?: string },
): Promise<ResultatCollecte> {
  const evenements: EvenementBrut[] = [];
  let vues = 0;

  try {
    const r = await obtenir(source.url, connu);
    if (r.inchange) return { source, evenements, vues, inchange: true };
    if (r.statut !== 200) {
      return { source, evenements, vues, erreur: `HTTP ${r.statut}` };
    }

    const items = r.texte.match(/<item[^>]*>.*?<\/item>/gs) ?? [];
    for (const item of items) {
      vues++;
      const titre = balise(item, "title");
      const lien = balise(item, "link") ?? balise(item, "guid");
      if (!titre || !lien) continue;

      const description = balise(item, "description");
      const contenu = balise(item, "content:encoded");
      const texte = `${description ?? ""} ${contenu ?? ""}`.replace(
        /<[^>]+>/g,
        " ",
      );

      if (!classer(titre, texte).type) continue;

      const dates = extraireDates({
        evStart: balise(item, "ev:startdate"),
        evEnd: balise(item, "ev:enddate"),
        description,
        contenu,
        titre,
        pubDate: balise(item, "pubDate"),
      });
      // Sans date, un evenement n'est pas une information utilisable : il
      // n'apparaitrait dans aucun filtre de periode et ne servirait a personne.
      if (!dates) continue;

      evenements.push({
        idExterne: balise(item, "guid") ?? lien,
        titreSource: titre,
        titreAffiche: titreSansRubrique(titre),
        debutLe: dates.debut,
        finLe: dates.fin,
        urlSource: lien,
        description: nettoyerTexte(texte).slice(0, 2000) || undefined,
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
