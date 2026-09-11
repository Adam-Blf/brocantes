/**
 * Famille "opendata-paris" : le jeu "Que faire a Paris ?" de la Ville de Paris.
 *
 * Licence ODbL, mise a jour quotidienne, API Opendatasoft stable. C'est la
 * seule source ouverte d'Ile-de-France qui porte reellement des brocantes,
 * mesure le 11/09/2026 : neuf evenements futurs tagges Brocante, dont trois
 * vide-greniers au sens strict.
 *
 * L'ODbL impose l'attribution et, si l'on republie une base DERIVEE, le partage
 * a l'identique. La fiche affiche donc la source, et la base complete est
 * publiee sous licence ouverte compatible.
 */

import { obtenir } from "../lib/http.ts";
import { classer } from "../lib/classer.ts";
import type { EvenementBrut, ResultatCollecte, Source } from "../lib/types.ts";

interface EnrParis {
  id?: string;
  title?: string;
  date_start?: string;
  date_end?: string;
  address_name?: string;
  address_street?: string;
  address_zipcode?: string;
  address_city?: string;
  lead_text?: string;
  url?: string;
  qfap_tags?: string[] | string;
}

function composerAdresse(e: EnrParis): string | undefined {
  const m = [e.address_name, e.address_street, e.address_zipcode, e.address_city]
    .filter(Boolean);
  return m.length ? m.join(", ") : undefined;
}

export async function collecter(source: Source): Promise<ResultatCollecte> {
  const evenements: EvenementBrut[] = [];
  let vues = 0;

  try {
    const url = new URL(source.url);
    const aujourdhui = new Date().toISOString().slice(0, 10);
    // Le filtre porte sur date_end : un vide-grenier de trois jours commence
    // dans le passe et se deroule encore, il doit rester visible.
    url.searchParams.set(
      "where",
      `qfap_tags like 'Brocante' and date_end >= date'${aujourdhui}'`,
    );
    url.searchParams.set("limit", "100");
    url.searchParams.set(
      "select",
      "title,date_start,date_end,address_name,address_street,address_zipcode," +
        "address_city,lead_text,url",
    );

    const r = await obtenir(url.toString());
    if (r.statut !== 200) {
      return {
        source,
        evenements,
        vues,
        erreur: `HTTP ${r.statut} : ${r.texte.slice(0, 200)}`,
      };
    }

    const charge = JSON.parse(r.texte) as { results?: EnrParis[] };
    for (const e of charge.results ?? []) {
      vues++;
      const titre = (e.title ?? "").trim();
      if (!titre || !e.date_start) continue;

      // Le tag "Brocante" de la Ville de Paris est large : il ramene aussi des
      // salons d'antiquaires et des friperies evenementielles. Le classifieur
      // tranche, et ce qu'il refuse reste dehors.
      if (!classer(titre, e.lead_text ?? "").type) continue;

      const debut = new Date(e.date_start);
      const fin = new Date(e.date_end ?? e.date_start);
      if (isNaN(debut.getTime())) continue;

      evenements.push({
        idExterne: e.url ?? titre,
        titreSource: titre,
        adresseSource: composerAdresse(e),
        debutLe: debut,
        finLe: isNaN(fin.getTime()) ? debut : fin,
        urlSource: e.url ?? "https://quefaire.paris.fr/",
        description: e.lead_text?.slice(0, 2000),
        codePostal: e.address_zipcode ?? undefined,
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
