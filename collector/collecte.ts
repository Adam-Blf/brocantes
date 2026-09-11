/**
 * Orchestrateur de collecte.
 *
 * Une passe par jour, jamais plus. Il lit collector/sources.json, appelle la
 * famille de collecteur correspondante, et ecrit le resultat dans un fichier
 * JSON horodate. Il ne touche jamais la base : charger.ts s'en occupe ensuite.
 * Cette separation n'est pas de la coquetterie, elle rend la collecte rejouable
 * sans droit d'ecriture, donc testable sans secret.
 *
 * Il ecrit au fil de l'eau, source par source. Un traitement long qui n'ecrit
 * qu'a sa derniere ligne transforme le moindre incident en perte totale.
 *
 *   deno run --allow-net=<domaines> --allow-read --allow-write collector/collecte.ts
 */

import { collecter as collecterTribe } from "./familles/tribe.ts";
import { collecter as collecterRss } from "./familles/rss.ts";
import { collecter as collecterParis } from "./familles/paris.ts";
import { collecter as collecterIcsWp } from "./familles/ics-wp.ts";
import type { ResultatCollecte, Source } from "./lib/types.ts";

const FICHIER_SOURCES = new URL("./sources.json", import.meta.url);
const DOSSIER_SORTIE = new URL("./sortie/", import.meta.url);

const COLLECTEURS = {
  tribe: collecterTribe,
  rss: collecterRss,
  "opendata-paris": collecterParis,
  "ics-wp": collecterIcsWp,
} as const;

interface Journal {
  lanceLe: string;
  sources: Array<{
    slug: string;
    commune: string;
    famille: string;
    vues: number;
    retenus: number;
    inchange?: boolean;
    erreur?: string;
  }>;
  evenements: Array<Record<string, unknown>>;
}

function aplatir(r: ResultatCollecte) {
  return r.evenements.map((e) => ({
    sourceSlug: r.source.slug,
    codeInsee: r.source.codeInsee,
    commune: r.source.commune,
    idExterne: e.idExterne,
    titreSource: e.titreSource,
    titreAffiche: e.titreAffiche ?? e.titreSource,
    adresseSource: e.adresseSource ?? null,
    codePostal: e.codePostal ?? null,
    debutLe: e.debutLe.toISOString(),
    finLe: e.finLe.toISOString(),
    urlSource: e.urlSource,
    organisateur: e.organisateur ?? null,
    description: e.description ?? null,
  }));
}

async function principal() {
  const config = JSON.parse(await Deno.readTextFile(FICHIER_SOURCES)) as {
    sources: Source[];
  };

  // --source=slug rejoue une seule source. Sans cela, corriger une source en
  // erreur oblige a refaire une passe complete, donc a solliciter vingt sites
  // qui n'avaient rien demande.
  const filtre = Deno.args
    .find((a) => a.startsWith("--source="))
    ?.slice("--source=".length);
  const actives = config.sources.filter(
    (s) => s.actif && (!filtre || s.slug === filtre),
  );
  if (filtre && actives.length === 0) {
    console.error(`Aucune source active nommee "${filtre}".`);
    Deno.exit(2);
  }

  await Deno.mkdir(DOSSIER_SORTIE, { recursive: true });
  const horodate = new Date().toISOString().replace(/[:.]/g, "-");
  // Un rejeu partiel porte le nom de sa source. Sans cela il devient le
  // fichier le plus recent du dossier et usurpe le rang de derniere passe
  // complete : tout ce qui lit "la derniere collecte" y trouverait une source
  // unique au lieu des vingt et une.
  const nom = filtre
    ? `partielle-${filtre}-${horodate}.json`
    : `collecte-${horodate}.json`;
  const chemin = new URL(`./${nom}`, DOSSIER_SORTIE);

  const journal: Journal = {
    lanceLe: new Date().toISOString(),
    sources: [],
    evenements: [],
  };

  console.log(`\nCollecte, ${actives.length} source(s) active(s)\n`);

  for (const source of actives) {
    const collecteur = COLLECTEURS[source.famille];
    if (!collecteur) {
      console.log(`  ?      ${source.commune} : famille ${source.famille} inconnue`);
      journal.sources.push({
        slug: source.slug,
        commune: source.commune,
        famille: source.famille,
        vues: 0,
        retenus: 0,
        erreur: `famille inconnue : ${source.famille}`,
      });
      continue;
    }

    const r = await collecteur(source);
    journal.sources.push({
      slug: source.slug,
      commune: source.commune,
      famille: source.famille,
      vues: r.vues,
      retenus: r.evenements.length,
      inchange: r.inchange,
      erreur: r.erreur,
    });
    journal.evenements.push(...aplatir(r));

    const etat = r.erreur
      ? `ECHEC  ${r.erreur}`
      : r.inchange
      ? "inchange depuis la derniere passe"
      : `${r.evenements.length} retenu(s) sur ${r.vues} vu(s)`;
    console.log(`  ${r.erreur ? "!" : " "}  ${source.commune.padEnd(22)} ${etat}`);

    // Ecriture au fil de l'eau : si la passe s'interrompt, ce qui a ete
    // collecte jusque la est deja sur le disque.
    await Deno.writeTextFile(chemin, JSON.stringify(journal, null, 2));
  }

  const enErreur = journal.sources.filter((s) => s.erreur);
  console.log(
    `\n${journal.evenements.length} evenement(s) retenu(s), ` +
      `${enErreur.length} source(s) en erreur`,
  );
  console.log(`sortie : ${chemin.pathname}\n`);

  // Une source en erreur n'arrete pas la passe, mais elle doit se voir : le
  // code de sortie sert au journal de la tache planifiee.
  if (enErreur.length > 0) Deno.exit(3);
}

if (import.meta.main) await principal();
