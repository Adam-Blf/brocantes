"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { chercherCommune, type Commune } from "@/lib/recherche";

const RAYONS = [5, 10, 20, 50] as const;
const PERIODES = [
  { cle: "week-end", libelle: "Ce week-end" },
  { cle: "7j", libelle: "7 jours" },
  { cle: "30j", libelle: "30 jours" },
  { cle: "tout", libelle: "Tout" },
] as const;

export function Filtres({
  lieu,
  rayonKm,
  periode,
}: {
  lieu: string;
  rayonKm: number;
  periode: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [enCours, demarrer] = useTransition();
  const [saisie, setSaisie] = useState("");
  const [suggestions, setSuggestions] = useState<Commune[]>([]);
  const [erreurGeo, setErreurGeo] = useState<string | null>(null);

  function poser(modifs: Record<string, string>) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(modifs)) p.set(k, v);
    demarrer(() => router.push(`/?${p.toString()}`, { scroll: false }));
  }

  async function suggerer(v: string) {
    setSaisie(v);
    setSuggestions(v.trim().length >= 2 ? await chercherCommune(v) : []);
  }

  /**
   * Geolocalisation sur clic uniquement, jamais au chargement. La position est
   * une donnee personnelle : elle sert a construire une URL et n'est jamais
   * envoyee ailleurs ni conservee.
   */
  function localiser() {
    setErreurGeo(null);
    if (!("geolocation" in navigator)) {
      setErreurGeo("Votre navigateur ne sait pas vous localiser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        poser({
          lat: pos.coords.latitude.toFixed(5),
          lng: pos.coords.longitude.toFixed(5),
          lieu: "ma position",
        }),
      () =>
        setErreurGeo(
          "Position refusee ou indisponible. Saisissez une commune ou un code postal.",
        ),
      { timeout: 8000, maximumAge: 300000 },
    );
  }

  return (
    <div className="filet px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="relative min-w-[15rem] flex-1">
          <label
            htmlFor="commune"
            className="block text-[13px] uppercase tracking-wider text-[var(--encre-pale)]"
          >
            Autour de
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="commune"
              type="search"
              value={saisie}
              onChange={(e) => void suggerer(e.target.value)}
              placeholder={lieu}
              autoComplete="postal-code"
              className="w-full border-b border-[var(--filet)] bg-transparent px-1 py-2 text-[16px] outline-none focus:border-[var(--tampon)]"
            />
            <button
              type="button"
              onClick={localiser}
              className="shrink-0 border border-[var(--filet)] px-3 text-[14px] hover:border-[var(--tampon)] hover:text-[var(--tampon)]"
            >
              Me localiser
            </button>
          </div>

          {suggestions.length > 0 ? (
            <ul className="absolute z-20 mt-1 w-full border border-[var(--filet)] bg-[var(--papier)] shadow-none">
              {suggestions.map((c) => (
                <li key={c.code_insee}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-[15px] hover:bg-[var(--papier-creux)]"
                    onClick={() => {
                      setSaisie("");
                      setSuggestions([]);
                      poser({
                        lat: c.latitude.toFixed(5),
                        lng: c.longitude.toFixed(5),
                        lieu: c.nom,
                      });
                    }}
                  >
                    <span>
                      {c.nom}{" "}
                      <span className="text-[var(--encre-pale)]">
                        ({c.departement})
                      </span>
                    </span>
                    {!c.couverte ? (
                      <span className="text-[12px] uppercase tracking-wider text-[var(--encre-pale)]">
                        hors couverture
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <fieldset className="border-0 p-0">
          <legend className="text-[13px] uppercase tracking-wider text-[var(--encre-pale)]">
            Rayon
          </legend>
          <div className="mt-1 flex gap-1">
            {RAYONS.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={r === rayonKm}
                onClick={() => poser({ rayon: String(r) })}
                className={`border px-3 text-[14px] ${
                  r === rayonKm
                    ? "border-[var(--tampon)] bg-[var(--tampon)] text-[var(--papier)]"
                    : "border-[var(--filet)] hover:border-[var(--tampon)]"
                }`}
              >
                {r} km
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="border-0 p-0">
          <legend className="text-[13px] uppercase tracking-wider text-[var(--encre-pale)]">
            Quand
          </legend>
          <div className="mt-1 flex flex-wrap gap-1">
            {PERIODES.map((p) => (
              <button
                key={p.cle}
                type="button"
                aria-pressed={p.cle === periode}
                onClick={() => poser({ periode: p.cle })}
                className={`border px-3 text-[14px] ${
                  p.cle === periode
                    ? "border-[var(--tampon)] bg-[var(--tampon)] text-[var(--papier)]"
                    : "border-[var(--filet)] hover:border-[var(--tampon)]"
                }`}
              >
                {p.libelle}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {erreurGeo ? (
        <p role="status" className="mt-3 text-[14px] text-[var(--tampon)]">
          {erreurGeo}
        </p>
      ) : null}
      {enCours ? (
        <p role="status" className="mt-3 text-[14px] text-[var(--encre-pale)]">
          Recherche en cours...
        </p>
      ) : null}
    </div>
  );
}
