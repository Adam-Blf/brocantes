export type TypeEvenement =
  | "brocante"
  | "vide_grenier"
  | "braderie"
  | "puces"
  | "bourse"
  | "salon";

export const LIBELLES: Record<TypeEvenement, string> = {
  brocante: "Brocante",
  vide_grenier: "Vide-greniers",
  braderie: "Braderie",
  puces: "Puces",
  bourse: "Bourse",
  salon: "Salon",
};

/** Une ligne rendue par la fonction publique recherche_evenements. */
export interface Evenement {
  id: string;
  slug: string;
  /** Le titre tel que la source l'a publie. Jamais modifie. */
  titre_source: string;
  /** Ce qu'on affiche. Egal au precedent sauf neutralisation ponctuelle. */
  titre_affiche: string;
  type: TypeEvenement;
  debut_le: string;
  fin_le: string;
  adresse_source: string | null;
  code_postal: string | null;
  commune: string;
  code_insee: string | null;
  latitude: number;
  longitude: number;
  nb_exposants: number | null;
  tarif_visiteur_c: number | null;
  organisateur: string | null;
  statut: "brouillon" | "publie" | "annule" | "archive";
  distance_m: number;
  /** Date du dernier passage du collecteur sur la source. */
  releve_le: string | null;
}

export interface Filtres {
  lat: number;
  lng: number;
  rayonKm: number;
  periode: "week-end" | "7j" | "30j" | "tout";
  types: TypeEvenement[];
  /** Le libelle du point de depart, pour l'afficher sans le recalculer. */
  lieu: string;
}

/** Chevilly-Larue. Point de depart par defaut, avant toute geolocalisation. */
export const DEPART: Filtres = {
  lat: 48.7647,
  lng: 2.3494,
  rayonKm: 20,
  periode: "30j",
  types: [],
  lieu: "Chevilly-Larue",
};

/**
 * Bornes de la periode demandee.
 *
 * "Ce week-end" compte a partir de maintenant jusqu'a dimanche soir : le
 * samedi matin, un chineur veut voir la journee en cours, pas seulement le
 * lendemain.
 */
export function bornes(periode: Filtres["periode"]): { debut: Date; fin: Date } {
  const maintenant = new Date();
  const debut = maintenant;

  if (periode === "week-end") {
    const fin = new Date(maintenant);
    // 0 = dimanche. On avance jusqu'au dimanche a venir, inclus.
    const joursAvantDimanche = (7 - fin.getDay()) % 7;
    fin.setDate(fin.getDate() + joursAvantDimanche);
    fin.setHours(23, 59, 59, 999);
    return { debut, fin };
  }

  const jours = periode === "7j" ? 7 : periode === "30j" ? 30 : 365;
  const fin = new Date(maintenant);
  fin.setDate(fin.getDate() + jours);
  return { debut, fin };
}
