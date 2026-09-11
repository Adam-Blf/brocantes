/** Types partages par tous les collecteurs. */

export type TypeEvenement =
  | "brocante"
  | "vide_grenier"
  | "braderie"
  | "puces"
  | "bourse"
  | "salon";

/**
 * Un evenement tel qu'une source le publie, avant toute normalisation.
 *
 * Les champs en `_source` portent la chaine exacte publiee par la commune.
 * L'article L322-1 du CRPA interdit d'alterer une information publique
 * reutilisee : on garde donc l'original, et toute normalisation (geocodage,
 * mise en forme) va dans des champs separes.
 */
export interface EvenementBrut {
  /** Identifiant chez la source. Sert de cle de deduplication par source. */
  idExterne: string;
  /** Le titre exactement tel que la source l'ecrit. Jamais modifie. */
  titreSource: string;
  /**
   * Ce que le site montre, quand il differe du titre de la source : suffixe de
   * categorie ajoute par un moteur de site, balisage technique. Absent si le
   * titre de la source se suffit a lui-meme.
   */
  titreAffiche?: string;
  /** L'adresse exactement telle que la source l'ecrit, si elle en donne une. */
  adresseSource?: string;
  debutLe: Date;
  finLe: Date;
  /** Lien profond vers la fiche officielle, jamais vers la page d'accueil. */
  urlSource: string;
  description?: string;
  organisateur?: string;
  codePostal?: string;
}

/** Une source branchee, telle que `collector/sources.json` la decrit. */
export interface Source {
  slug: string;
  nom: string;
  famille: "tribe" | "rss" | "opendata-paris" | "ics-wp";
  url: string;
  codeInsee: string;
  commune: string;
  licence: string;
  licenceUrl?: string;
  licenceVerifieeLe: string;
  actif: boolean;
}

export interface ResultatCollecte {
  source: Source;
  evenements: EvenementBrut[];
  /** Nombre d'entrees vues avant filtrage sur le type brocante. */
  vues: number;
  erreur?: string;
  /** Vrai si la source a repondu 304, donc rien n'a change depuis la veille. */
  inchange?: boolean;
}
