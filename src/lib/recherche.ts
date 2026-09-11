import { bornes, type Evenement, type Filtres } from "./types";

/**
 * Acces a la base.
 *
 * Pas de bibliotheque cliente : deux appels POST sur /rest/v1/rpc suffisent, et
 * une dependance de moins est une surface d'attaque de moins sur une page qui
 * ne fait que lire.
 *
 * La cle publiable circule cote navigateur par construction. Ce n'est pas un
 * secret : c'est la politique RLS qui protege la base, et tests/rls.ts verifie
 * exactement ce que cette cle peut atteindre.
 */

function config(): { url: string; cle: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !cle) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY sont requis.",
    );
  }
  return { url, cle };
}

async function rpc<T>(
  nom: string,
  corps: Record<string, unknown>,
  revalidate: number,
): Promise<T> {
  const { url, cle } = config();
  const r = await fetch(`${url}/rest/v1/rpc/${nom}`, {
    method: "POST",
    headers: {
      apikey: cle,
      Authorization: `Bearer ${cle}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(corps),
    next: { revalidate },
  });
  if (!r.ok) throw new Error(`${nom} : HTTP ${r.status}`);
  return (await r.json()) as T;
}

export function chercher(f: Filtres): Promise<Evenement[]> {
  const { debut, fin } = bornes(f.periode);
  return rpc<Evenement[]>(
    "recherche_evenements",
    {
      p_lat: f.lat,
      p_lng: f.lng,
      p_rayon_km: f.rayonKm,
      p_debut: debut.toISOString(),
      p_fin: fin.toISOString(),
      p_types: f.types.length > 0 ? f.types : null,
      p_limite: 200,
    },
    // La collecte passe une fois par jour : reinterroger a chaque visite ne
    // rendrait rien de plus frais et couterait une requete pour rien.
    900,
  );
}

export interface Commune {
  code_insee: string;
  nom: string;
  slug: string;
  departement: string;
  latitude: number;
  longitude: number;
  couverte: boolean;
}

export function chercherCommune(saisie: string): Promise<Commune[]> {
  const q = saisie.trim();
  if (q.length < 2) return Promise.resolve([]);
  // Le referentiel ne change pas d'un jour a l'autre.
  return rpc<Commune[]>("chercher_commune", { p_saisie: q }, 86400);
}

/** Toutes les communes couvertes, pour les pages de ville et le plan du site. */
export async function communesCouvertes(): Promise<Commune[]> {
  const { url, cle } = config();
  const r = await fetch(
    `${url}/rest/v1/communes?couverte=is.true&select=code_insee,nom,slug,departement&order=nom`,
    {
      headers: { apikey: cle, Authorization: `Bearer ${cle}` },
      next: { revalidate: 86400 },
    },
  );
  if (!r.ok) throw new Error(`communes : HTTP ${r.status}`);
  return (await r.json()) as Commune[];
}

export interface Provenance {
  nom: string;
  url: string;
  vu_le: string;
  licence: string;
}

export interface Fiche extends Evenement {
  description: string | null;
  commune_slug: string | null;
  tarif_exposant_c: number | null;
  restauration: boolean | null;
  acces_pmr: boolean | null;
  sources: Provenance[];
}

/** Un evenement par son slug, avec ses provenances. */
export async function fiche(slug: string): Promise<Fiche | null> {
  const lignes = await rpc<Fiche[]>("fiche_evenement", { p_slug: slug }, 900);
  return lignes[0] ?? null;
}

/** Les evenements a venir d'une commune, pour sa page de ville. */
export function agendaCommune(slugCommune: string): Promise<Evenement[]> {
  return rpc<Evenement[]>("agenda_commune", { p_slug: slugCommune }, 3600);
}

/** Une commune par son slug. */
export async function commune(slug: string): Promise<Commune | null> {
  const { url, cle } = config();
  const r = await fetch(
    `${url}/rest/v1/communes?slug=eq.${encodeURIComponent(slug)}` +
      `&select=code_insee,nom,slug,departement,couverte&limit=1`,
    {
      headers: { apikey: cle, Authorization: `Bearer ${cle}` },
      next: { revalidate: 86400 },
    },
  );
  if (!r.ok) return null;
  const lignes = (await r.json()) as Commune[];
  return lignes[0] ?? null;
}
