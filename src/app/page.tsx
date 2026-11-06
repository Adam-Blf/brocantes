import { chercher } from "@/lib/recherche";
import { DEPART, type Filtres as TFiltres } from "@/lib/types";
import { Filtres } from "@/components/Filtres";
import { Resultats } from "@/components/Resultats";
import { Entete } from "@/components/Entete";
import { Pied } from "@/components/Pied";

export const revalidate = 900;

type Params = Promise<Record<string, string | string[] | undefined>>;

function unSeul(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Les filtres vivent dans l'URL, pas dans un etat de composant. Une recherche
 * se partage alors par simple copie du lien, le retour arriere fonctionne, et
 * le rendu reste serveur donc indexable.
 *
 * Toute valeur recue est bornee ici : une URL est ecrite par n'importe qui.
 */
function lire(p: Record<string, string | string[] | undefined>): TFiltres {
  const nombre = (v: string | undefined, defaut: number, min: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : defaut;
  };

  const periode = unSeul(p.periode);
  return {
    lat: nombre(unSeul(p.lat), DEPART.lat, 41, 52),
    lng: nombre(unSeul(p.lng), DEPART.lng, -6, 10),
    rayonKm: nombre(unSeul(p.rayon), DEPART.rayonKm, 1, 100),
    periode:
      periode === "week-end" || periode === "7j" || periode === "30j" || periode === "tout"
        ? periode
        : DEPART.periode,
    types: [],
    lieu: (unSeul(p.lieu) ?? DEPART.lieu).slice(0, 60),
  };
}

export default async function Accueil({
  searchParams,
}: {
  searchParams: Params;
}) {
  const f = lire(await searchParams);
  const evenements = await chercher(f);

  return (
    <main className="mx-auto max-w-6xl">
      <Entete nombre={evenements.length} lieu={f.lieu} rayonKm={f.rayonKm} />
      <Filtres lieu={f.lieu} rayonKm={f.rayonKm} periode={f.periode} />
      <Resultats
        evenements={evenements}
        centre={{ lat: f.lat, lng: f.lng }}
        lieu={f.lieu}
      />
      <Pied />
    </main>
  );
}
