/**
 * Charge en base une sortie de collecte.
 *
 * Separe de collecte.ts a dessein : la collecte n'a besoin d'aucun droit
 * d'ecriture, donc elle se rejoue sans secret. Seul ce script porte la cle de
 * service, et il ne sort jamais de la tache planifiee.
 *
 * Tout arrive en `brouillon`. Rien n'est publie automatiquement : un evenement
 * dont la date a ete deduite d'un pubDate plutot que declaree peut envoyer
 * quelqu'un devant une salle fermee, et ce risque ne se prend pas en silence.
 *
 *   deno run --allow-net=<hote> --allow-env --allow-read collector/charger.ts <fichier.json>
 */

const URL_BASE = Deno.env.get("SUPABASE_URL");
const CLE = Deno.env.get("SUPABASE_SERVICE_KEY");

if (!URL_BASE || !CLE) {
  console.error("SUPABASE_URL et SUPABASE_SERVICE_KEY sont requis.");
  Deno.exit(2);
}

const fichier = Deno.args[0];
if (!fichier) {
  console.error("Usage : charger.ts <fichier de collecte>");
  Deno.exit(2);
}

const entetes = {
  apikey: CLE,
  Authorization: `Bearer ${CLE}`,
  "Content-Type": "application/json",
};

interface EvtPlat {
  sourceSlug: string;
  codeInsee: string;
  commune: string;
  idExterne: string;
  titreSource: string;
  titreAffiche: string;
  adresseSource: string | null;
  codePostal: string | null;
  debutLe: string;
  finLe: string;
  urlSource: string;
  organisateur: string | null;
  description: string | null;
}

function slugifier(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/** L'ordre compte : du plus specifique au plus general. */
function typer(titre: string): string {
  const regles: Array<[RegExp, string]> = [
    [/vide[\s-]*greniers?/i, "vide_grenier"],
    [/march[ée]\s+aux\s+puces|\bpuces\b/i, "puces"],
    [/bourse\s+(aux|de|d')/i, "bourse"],
    [/braderie/i, "braderie"],
    [/salon\s+(des\s+)?(antiquaires|brocanteurs|collectionneurs)/i, "salon"],
  ];
  for (const [motif, t] of regles) if (motif.test(titre)) return t;
  return "brocante";
}

async function appeler(chemin: string, corps: unknown, prefer: string) {
  const r = await fetch(`${URL_BASE}/rest/v1/${chemin}`, {
    method: "POST",
    headers: { ...entetes, Prefer: prefer },
    body: JSON.stringify(corps),
  });
  if (!r.ok) throw new Error(`${chemin} : HTTP ${r.status} ${await r.text()}`);
  return r;
}

const journal = JSON.parse(await Deno.readTextFile(fichier)) as {
  evenements: EvtPlat[];
};
console.log(`\n${journal.evenements.length} evenement(s) a charger\n`);

// Un meme slug peut sortir deux fois d'une passe si deux sources decrivent le
// meme evenement. On numerote plutot que d'ecraser : la deduplication se fait
// plus tard, sur la geographie et la date, pas sur un hasard de titre.
const vus = new Set<string>();
const lignes = journal.evenements.map((e) => {
  let slug = slugifier(`${e.commune}-${e.titreSource}`);
  let n = 2;
  const base = slug;
  while (vus.has(slug)) slug = `${base}-${n++}`;
  vus.add(slug);
  return {
    slug,
    titre_source: e.titreSource,
    titre_affiche: e.titreAffiche || e.titreSource,
    type: typer(e.titreSource),
    description: e.description,
    debut_le: e.debutLe,
    fin_le: e.finLe,
    adresse_source: e.adresseSource,
    code_postal: e.codePostal,
    commune: e.commune,
    code_insee: e.codeInsee,
    organisateur: e.organisateur,
    statut: "brouillon",
    _source: e.sourceSlug,
    _id_externe: e.idExterne,
    _url: e.urlSource,
  };
});

const aEcrire = lignes.map(({ _source, _id_externe, _url, ...reste }) => reste);
await appeler(
  "evenements?on_conflict=slug",
  aEcrire,
  "resolution=merge-duplicates,return=minimal",
);
console.log(`  ${aEcrire.length} evenement(s) ecrit(s) en brouillon`);

// Provenances. Elles sont indispensables : un evenement sans lien vers sa
// fiche officielle ne peut pas citer sa source, ce que l'article L322-1 du CRPA
// impose, et ne sera donc jamais publiable.
const parSlug = new Map<string, string>();
const parSource = new Map<string, string>();
for (const table of ["evenements", "sources"] as const) {
  const r = await fetch(
    `${URL_BASE}/rest/v1/${table}?select=id,slug`,
    { headers: entetes },
  );
  for (const l of (await r.json()) as Array<{ id: string; slug: string }>) {
    (table === "evenements" ? parSlug : parSource).set(l.slug, l.id);
  }
}

const liens = lignes
  .filter((l) => parSlug.has(l.slug) && parSource.has(l._source))
  .map((l) => ({
    evenement_id: parSlug.get(l.slug),
    source_id: parSource.get(l._source),
    id_externe: l._id_externe,
    url_source: l._url,
    vu_le: new Date().toISOString(),
  }));

if (liens.length > 0) {
  await appeler(
    "evenement_sources?on_conflict=source_id,id_externe",
    liens,
    "resolution=merge-duplicates,return=minimal",
  );
}
console.log(`  ${liens.length} provenance(s) enregistree(s)`);
console.log(
  `\nTout est en brouillon. La publication passe par la moderation.\n`,
);
