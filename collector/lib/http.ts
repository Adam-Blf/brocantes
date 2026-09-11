/**
 * Acces reseau du collecteur, avec la politesse cablee dedans.
 *
 * Trois regles y sont appliquees par construction plutot que laissees a la
 * vigilance de chaque collecteur :
 *
 * 1. Une seule requete a la fois par domaine, espacee. Un site de mairie tourne
 *    souvent sur un hebergement mutualise, et une rafale y ressemble a une
 *    attaque. Au dela, on entre dans le champ de l'article 323-2 du code penal,
 *    entrave au fonctionnement d'un systeme de traitement automatise.
 * 2. Un user-agent qui dit qui appelle et comment se plaindre. Un robot anonyme
 *    se fait bloquer, et il le merite.
 * 3. ETag et If-Modified-Since. Une mairie qui repond 304 ne nous a rien coute,
 *    et c'est la facon la moins chere de passer tous les jours sans gener.
 */

export const AGENT =
  "BrocantesVDM/0.1 (+https://brocantes.beloucif.com/robot)";

/** Delai minimal entre deux requetes vers un meme domaine, en millisecondes. */
const DELAI_PAR_DOMAINE = 3000;

const dernierAppel = new Map<string, number>();
const fileParDomaine = new Map<string, Promise<unknown>>();

function attendre(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Serialise les appels vers un meme domaine et les espace.
 * Deux domaines differents restent paralleles : la politesse est due au serveur
 * en face, pas au reseau en general.
 */
function enFile<T>(domaine: string, travail: () => Promise<T>): Promise<T> {
  const precedent = fileParDomaine.get(domaine) ?? Promise.resolve();
  const suivant = precedent.then(async () => {
    const depuis = Date.now() - (dernierAppel.get(domaine) ?? 0);
    if (depuis < DELAI_PAR_DOMAINE) await attendre(DELAI_PAR_DOMAINE - depuis);
    dernierAppel.set(domaine, Date.now());
    return await travail();
  });
  fileParDomaine.set(domaine, suivant.catch(() => {}));
  return suivant;
}

export interface ReponseCache {
  statut: number;
  texte: string;
  etag?: string;
  modifieLe?: string;
  /** 304 : la source n'a pas change depuis le dernier passage. */
  inchange: boolean;
}

/**
 * Un GET poli. `etag` et `modifieLe` viennent du passage precedent, conserves
 * par l'appelant ; les redonner evite de retelecharger ce qui n'a pas bouge.
 */
export async function obtenir(
  url: string,
  connu?: { etag?: string; modifieLe?: string },
): Promise<ReponseCache> {
  const domaine = new URL(url).hostname;
  return enFile(domaine, async () => {
    const entetes: Record<string, string> = {
      "User-Agent": AGENT,
      "Accept-Language": "fr",
    };
    if (connu?.etag) entetes["If-None-Match"] = connu.etag;
    if (connu?.modifieLe) entetes["If-Modified-Since"] = connu.modifieLe;

    const ctrl = new AbortController();
    const minuteur = setTimeout(() => ctrl.abort(), 30_000);
    try {
      const r = await fetch(url, { headers: entetes, signal: ctrl.signal });
      if (r.status === 304) {
        await r.body?.cancel();
        return { statut: 304, texte: "", inchange: true };
      }
      return {
        statut: r.status,
        texte: await r.text(),
        etag: r.headers.get("etag") ?? undefined,
        modifieLe: r.headers.get("last-modified") ?? undefined,
        inchange: false,
      };
    } finally {
      clearTimeout(minuteur);
    }
  });
}
