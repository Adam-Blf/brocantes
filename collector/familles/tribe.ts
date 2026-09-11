/**
 * Famille "tribe" : WordPress equipe du plugin The Events Calendar.
 *
 * C'est la source la plus propre rencontree sur les 47 communes auditees :
 * dates structurees, lieu avec adresse et code postal, lien profond, et une
 * pagination declaree. Quand une commune expose cette API, on ne parse aucun
 * HTML.
 *
 * Trois communes du Val-de-Marne en disposent au 11/09/2026 : Valenton,
 * La Queue-en-Brie, Noiseau.
 */

import { obtenir } from "../lib/http.ts";
import { classer } from "../lib/classer.ts";
import type { EvenementBrut, ResultatCollecte, Source } from "../lib/types.ts";

interface EvtTribe {
  id: number;
  title: string;
  description?: string;
  excerpt?: string;
  start_date: string;
  end_date: string;
  url: string;
  venue?: { venue?: string; address?: string; city?: string; zip?: string };
  organizer?: Array<{ organizer?: string }>;
}

/** WordPress echappe les entites HTML dans les titres, il faut les rendre. */
function decoder(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function composerAdresse(v?: EvtTribe["venue"]): string | undefined {
  if (!v) return undefined;
  const morceaux = [v.venue, v.address, v.zip, v.city].filter(Boolean);
  return morceaux.length ? morceaux.join(", ") : undefined;
}

export async function collecter(source: Source): Promise<ResultatCollecte> {
  const evenements: EvenementBrut[] = [];
  let vues = 0;

  try {
    // On borne a trois pages. Un agenda municipal en compte rarement plus, et
    // une pagination qui ne se termine pas ne doit pas tourner indefiniment
    // contre le serveur d'une mairie.
    for (let page = 1; page <= 3; page++) {
      const url = new URL(source.url);
      url.searchParams.set("per_page", "50");
      url.searchParams.set("page", String(page));

      const r = await obtenir(url.toString());
      if (r.statut === 400 || r.statut === 404) break; // fin de pagination
      if (r.statut !== 200) {
        return { source, evenements, vues, erreur: `HTTP ${r.statut}` };
      }

      const charge = JSON.parse(r.texte) as {
        events?: EvtTribe[];
        total_pages?: number;
      };
      const lot = charge.events ?? [];
      if (lot.length === 0) break;

      for (const e of lot) {
        vues++;
        const titre = decoder(e.title ?? "");
        const texte = decoder(e.description ?? e.excerpt ?? "").replace(
          /<[^>]+>/g,
          " ",
        );
        if (!classer(titre, texte).type) continue;

        const debut = new Date(e.start_date.replace(" ", "T"));
        const fin = new Date((e.end_date ?? e.start_date).replace(" ", "T"));
        if (isNaN(debut.getTime())) continue;

        evenements.push({
          idExterne: String(e.id),
          titreSource: titre,
          adresseSource: composerAdresse(e.venue),
          debutLe: debut,
          finLe: isNaN(fin.getTime()) ? debut : fin,
          urlSource: e.url,
          description: texte.slice(0, 2000) || undefined,
          organisateur: e.organizer?.[0]?.organizer,
          codePostal: e.venue?.zip,
        });
      }

      if (charge.total_pages && page >= charge.total_pages) break;
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
