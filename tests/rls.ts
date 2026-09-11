/**
 * Garde RLS - verifie ce que la cle publique peut reellement atteindre.
 *
 * Cette cle est destinee au navigateur : elle est publique par construction, et
 * la seule chose qui protege la base est la politique RLS. Ce script interroge
 * donc l'API exactement comme le ferait un visiteur curieux, et echoue si une
 * table qui doit rester fermee repond quoi que ce soit.
 *
 * Deux cas de controle vivent en base sous le prefixe zzz-controle. Sans eux,
 * un test "la table brouillon ne renvoie rien" passerait au vert sur une table
 * vide, ce qui ne prouve rien du tout.
 *
 *   deno run --allow-net=<hote> --allow-env tests/rls.ts
 */

const URL_BASE = Deno.env.get("SUPABASE_URL");
const CLE = Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

if (!URL_BASE || !CLE) {
  console.error("SUPABASE_URL et SUPABASE_PUBLISHABLE_KEY sont requis.");
  Deno.exit(2);
}

const entetes = { apikey: CLE, Authorization: `Bearer ${CLE}` };

type Resultat = { nom: string; ok: boolean; detail: string };
const resultats: Resultat[] = [];

function noter(nom: string, ok: boolean, detail: string) {
  resultats.push({ nom, ok, detail });
  console.log(`${ok ? "  vert " : "  ROUGE"}  ${nom}\n         ${detail}`);
}

async function lire(chemin: string) {
  const r = await fetch(`${URL_BASE}/rest/v1/${chemin}`, { headers: entetes });
  const texte = await r.text();
  let corps: unknown = texte;
  try {
    corps = JSON.parse(texte);
  } catch { /* une erreur PostgREST peut ne pas etre du JSON */ }
  return { statut: r.status, corps };
}

function nbLignes(corps: unknown): number {
  return Array.isArray(corps) ? corps.length : -1;
}

console.log("\nGarde RLS, vue depuis la cle publique\n");

// 1. Le chemin nominal doit fonctionner. Un test de fermeture n'a de valeur que
//    si l'on prouve d'abord que la lecture legitime, elle, passe. On s'appuie
//    sur les evenements REELS : un temoin publie, lui, apparaitrait sur la page
//    publique de sa commune, ce qui est un artefact de test visible par les
//    visiteurs.
{
  const { statut, corps } = await lire(
    "evenements?statut=eq.publie&select=slug&limit=5",
  );
  noter(
    "les evenements publies sont lisibles",
    statut === 200 && nbLignes(corps) > 0,
    `HTTP ${statut}, ${nbLignes(corps)} ligne(s), attendu au moins 1`,
  );
}

// 2. Le brouillon existe en base et ne doit pas sortir.
{
  const { statut, corps } = await lire(
    "evenements?slug=eq.zzz-controle-brouillon&select=slug,statut",
  );
  noter(
    "un brouillon ne fuite pas",
    statut === 200 && nbLignes(corps) === 0,
    `HTTP ${statut}, ${nbLignes(corps)} ligne(s), attendu 0`,
  );
}

// 3 et 4. Deux tables qui portent des donnees personnelles. Elles ne sont pas
//    vides : une reponse a zero ligne prouve donc la fermeture, pas l'absence.
for (const table of ["contributions", "alertes"]) {
  const { statut, corps } = await lire(`${table}?select=id`);
  noter(
    `la table ${table} est fermee en lecture`,
    nbLignes(corps) === 0 || statut === 401 || statut === 403,
    `HTTP ${statut}, ${nbLignes(corps)} ligne(s), attendu 0 ou un refus`,
  );
}

// 5. Ecriture anonyme refusee. Sans politique d'insertion, PostgREST rend 401.
{
  const r = await fetch(`${URL_BASE}/rest/v1/contributions`, {
    method: "POST",
    headers: { ...entetes, "Content-Type": "application/json" },
    body: JSON.stringify({
      titre: "zzz-controle-intrusion",
      type: "brocante",
      debut_le: new Date().toISOString(),
      fin_le: new Date().toISOString(),
      commune: "Chevilly-Larue",
      organisateur: "intrus",
      contact_courriel: "intrus@example.invalid",
    }),
  });
  noter(
    "une ecriture anonyme est refusee",
    r.status === 401 || r.status === 403 || r.status === 404,
    `HTTP ${r.status}, attendu un refus`,
  );
}

// 6. La fonction publiee ne doit pas etre une porte derobee sur les brouillons.
//    La fenetre de dates est elargie a dessein : le temoin est date en 2099
//    pour ne jamais apparaitre dans une recherche reelle, il faut donc aller
//    le chercher explicitement.
{
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/recherche_evenements`, {
    method: "POST",
    headers: { ...entetes, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_lat: 48.7647,
      p_lng: 2.3494,
      p_rayon_km: 5,
      p_debut: "2098-01-01T00:00:00Z",
      p_fin: "2100-01-01T00:00:00Z",
    }),
  });
  const corps = await r.json();
  const slugs: string[] = Array.isArray(corps)
    ? corps.map((e: { slug: string }) => e.slug)
    : [];
  noter(
    "la recherche ne renvoie pas les brouillons",
    r.status === 200 && !slugs.includes("zzz-controle-brouillon"),
    `HTTP ${r.status}, ${slugs.length} resultat(s), brouillon present : ${
      slugs.includes("zzz-controle-brouillon")
    }`,
  );
}

// 7. Un rayon delirant ne doit pas devenir un moyen de tout aspirer d'un coup.
{
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/recherche_evenements`, {
    method: "POST",
    headers: { ...entetes, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_lat: 48.7647,
      p_lng: 2.3494,
      p_rayon_km: 99999,
      p_limite: 99999,
    }),
  });
  const corps = await r.json();
  noter(
    "le rayon et la limite sont bornes",
    r.status === 200 && Array.isArray(corps) && corps.length <= 200,
    `HTTP ${r.status}, ${nbLignes(corps)} resultat(s), plafond 200`,
  );
}

const echecs = resultats.filter((r) => !r.ok);
console.log(
  `\n${resultats.length - echecs.length} vert(s), ${echecs.length} rouge(s)\n`,
);
if (echecs.length > 0) {
  console.error("Gardes en echec :");
  for (const e of echecs) console.error(`  - ${e.nom} : ${e.detail}`);
  Deno.exit(1);
}
