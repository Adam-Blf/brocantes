"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import type { Evenement } from "@/lib/types";
import { Annonce } from "./Annonce";

// MapLibre touche au DOM et pese lourd : il ne doit pas entrer dans le rendu
// serveur, ni retarder l'affichage de la liste, qui est la vue par defaut.
const Carte = dynamic(() => import("./Carte").then((m) => m.Carte), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-[var(--encre-pale)]">
      Chargement de la carte...
    </div>
  ),
});

export function Resultats({
  evenements,
  centre,
  lieu,
}: {
  evenements: Evenement[];
  centre: { lat: number; lng: number };
  lieu: string;
}) {
  const [vue, setVue] = useState<"liste" | "carte">("liste");
  const [actif, setActif] = useState<string | null>(null);
  const choisir = useCallback((slug: string | null) => setActif(slug), []);

  if (evenements.length === 0) {
    return (
      <section id="resultats" className="filet px-4 py-16 text-center sm:px-6">
        <p className="font-[family-name:var(--font-titre)] text-[22px]">
          Rien d&apos;annonce autour de {lieu} pour cette periode.
        </p>
        <p className="mx-auto mt-3 max-w-md text-[15px] text-[var(--encre-pale)]">
          Elargissez le rayon ou la periode. Les brocantes se declarent souvent
          quelques semaines a l&apos;avance seulement, et la saison va de mars a
          novembre.
        </p>
      </section>
    );
  }

  return (
    <section id="resultats">
      {/* Bascule liste et carte, sur petit ecran uniquement : au dela, les deux
          tiennent cote a cote et la bascule n'aurait aucun sens. */}
      <div className="filet flex gap-1 px-4 py-3 sm:px-6 lg:hidden">
        {(["liste", "carte"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={vue === v}
            onClick={() => setVue(v)}
            className={`flex-1 border px-3 text-[15px] capitalize ${
              vue === v
                ? "border-[var(--tampon)] bg-[var(--tampon)] text-[var(--papier)]"
                : "border-[var(--filet)]"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="lg:flex lg:items-start">
        <ul
          className={`lg:w-1/2 lg:border-r lg:border-[var(--filet)] ${
            vue === "carte" ? "hidden lg:block" : ""
          }`}
        >
          {evenements.map((e) => (
            <Annonce
              key={e.slug}
              e={e}
              actif={actif === e.slug}
              onSurvol={choisir}
            />
          ))}
        </ul>

        <div
          className={`h-[60vh] lg:sticky lg:top-0 lg:h-[calc(100vh-1px)] lg:w-1/2 ${
            vue === "liste" ? "hidden lg:block" : ""
          }`}
        >
          <Carte
            evenements={evenements}
            centre={centre}
            actif={actif}
            onChoisir={choisir}
          />
        </div>
      </div>
    </section>
  );
}
