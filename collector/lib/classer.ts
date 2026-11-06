/**
 * Reconnait une brocante dans un agenda municipal generaliste.
 *
 * Un agenda de mairie melange conseils de quartier, concerts et vaccinations.
 * Ce module decide ce qui reste. Il se trompe dans les deux sens, et les deux
 * erreurs n'ont pas le meme cout : un faux positif se voit tout de suite sur la
 * fiche et se corrige, un faux negatif est invisible. Le filtre penche donc du
 * cote large, et la moderation tranche ensuite.
 */

import type { TypeEvenement } from "./types.ts";

/**
 * L'ordre compte : on teste du plus specifique au plus general. "bourse aux
 * jouets" doit gagner avant que "bourse" ne capture une bourse aux plantes, et
 * "braderie de livres" avant "braderie".
 */
const REGLES: Array<{ motif: RegExp; type: TypeEvenement }> = [
  { motif: /vide[\s-]*greniers?|vide[\s-]*grenier/i, type: "vide_grenier" },
  { motif: /march[ée]\s+aux\s+puces|\bpuces\b/i, type: "puces" },
  { motif: /bourse\s+(aux|de|d')\s*\w+/i, type: "bourse" },
  { motif: /braderie/i, type: "braderie" },
  { motif: /salon\s+(des\s+)?(antiquaires|brocanteurs|collectionneurs)/i, type: "salon" },
  { motif: /brocante|bric[\s-]*[àa][\s-]*brac|foire\s+[àa]\s+tout/i, type: "brocante" },
  { motif: /vide[\s-]*dressing|vide[\s-]*armoires?/i, type: "vide_grenier" },
];

/**
 * Ecarte ce qui porte un mot declencheur sans etre l'evenement cherche.
 *
 * Deux cas rencontres reellement lors de l'audit du 11/09/2026 : une page
 * "Organisation de vide-greniers" qui est une rubrique administrative de
 * demande d'autorisation, et "Brocante : inscrivez-vous", qui annonce
 * l'ouverture des inscriptions et porte la date de l'inscription, pas celle de
 * la brocante. Les publier, ce serait envoyer quelqu'un devant une mairie
 * fermee un dimanche matin.
 */
const EXCLUSIONS: RegExp[] = [
  /organisation\s+d[eu]\s+vide/i,
  /r[ée]glementation/i,
  /d[ée]clarer\s+(un|votre)\s+vide/i,
  /demande\s+d'?autorisation/i,
  /inscriptions?\s*:/i,
  /inscrivez[\s-]*vous/i,
  /appel\s+[àa]\s+(candidature|exposant)/i,
];

export interface Classement {
  type: TypeEvenement | null;
  motifEcarte?: string;
}

export function classer(titre: string, description = ""): Classement {
  const texte = `${titre} ${description}`;

  for (const ex of EXCLUSIONS) {
    if (ex.test(titre)) {
      return { type: null, motifEcarte: `exclusion ${ex.source}` };
    }
  }

  // Le titre prime sur la description : une fete de l'ete dont le texte
  // mentionne "brocante, maneges, concerts" est une fete, pas une brocante.
  for (const r of REGLES) {
    if (r.motif.test(titre)) return { type: r.type };
  }

  // Rattrapage sur la description, mais seulement pour les termes qui ne
  // peuvent pas designer autre chose.
  if (/\bvide[\s-]*greniers?\b|\bbrocante\b/i.test(texte)) {
    return { type: /vide[\s-]*grenier/i.test(texte) ? "vide_grenier" : "brocante" };
  }

  return { type: null, motifEcarte: "aucun motif brocante" };
}
