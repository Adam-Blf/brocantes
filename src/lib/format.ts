/** Mise en forme, en heure de Paris et en francais, partout. */

const PARIS = "Europe/Paris";

const JOUR = new Intl.DateTimeFormat("fr-FR", {
  timeZone: PARIS,
  weekday: "long",
  day: "numeric",
  month: "long",
});

const JOUR_COURT = new Intl.DateTimeFormat("fr-FR", {
  timeZone: PARIS,
  weekday: "short",
  day: "numeric",
  month: "short",
});

const HEURE = new Intl.DateTimeFormat("fr-FR", {
  timeZone: PARIS,
  hour: "2-digit",
  minute: "2-digit",
});

export function jour(iso: string): string {
  return JOUR.format(new Date(iso));
}

export function jourCourt(iso: string): string {
  return JOUR_COURT.format(new Date(iso)).replace(".", "");
}

/**
 * Plage horaire, ou rien.
 *
 * Un evenement dont le collecteur n'a pas trouve d'horaire couvre la journee
 * entiere, de minuit a 23h59. On n'affiche alors AUCUN horaire plutot que
 * "00h00 - 23h59", qui aurait l'air d'une information alors que c'est
 * l'absence d'information.
 */
export function horaires(debutIso: string, finIso: string): string | null {
  const d = new Date(debutIso);
  const f = new Date(finIso);
  const hd = HEURE.format(d);
  const hf = HEURE.format(f);
  if (hd === "00:00" && (hf === "23:59" || hf === "00:00")) return null;
  return `${hd.replace(":", "h")} - ${hf.replace(":", "h")}`;
}

/** Vrai si l'evenement dure plus d'une journee. */
export function surPlusieursJours(debutIso: string, finIso: string): boolean {
  const j = new Intl.DateTimeFormat("fr-FR", { timeZone: PARIS });
  return j.format(new Date(debutIso)) !== j.format(new Date(finIso));
}

/**
 * Distance lisible. Sous le kilometre on donne des centaines de metres, parce
 * que "0,4 km" se lit moins bien que "400 m" quand on decide d'y aller a pied.
 */
export function distance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres / 50) * 50} m`;
  const km = metres / 1000;
  return `${km.toFixed(km < 10 ? 1 : 0).replace(".", ",")} km`;
}

export function tarif(centimes: number | null): string | null {
  if (centimes === null) return null;
  if (centimes === 0) return "entree libre";
  return `${(centimes / 100).toFixed(2).replace(".", ",")} euros`;
}

/** Date du dernier relevé, pour la mention de source exigee par L322-1. */
export function releve(iso: string | null): string {
  if (!iso) return "date de releve inconnue";
  return `releve le ${new Intl.DateTimeFormat("fr-FR", { timeZone: PARIS }).format(new Date(iso))}`;
}

/**
 * Lien d'itineraire qui ouvre l'application de cartes du telephone.
 * Le schema geo: est compris par Android ; iOS et les navigateurs de bureau
 * retombent sur OpenStreetMap, jamais sur un service qui piste.
 */
export function itineraire(lat: number, lng: number, libelle: string): string {
  const q = encodeURIComponent(libelle);
  return `geo:${lat},${lng}?q=${lat},${lng}(${q})`;
}

export function itineraireSecours(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}`;
}
