/**
 * EN: local dev only. Loads the central secrets file (~/.secrets/projets.env,
 * or CENTRAL_ENV_FILE) into Deno.env. A variable already set always wins, and
 * a missing file or a missing read permission is a silent no-op, so CI, which
 * passes its secrets as environment variables, is unaffected.
 *
 * FR : developpement local seulement. Charge le fichier de secrets central
 * (~/.secrets/projets.env, ou CENTRAL_ENV_FILE) dans Deno.env. Une variable
 * deja definie l'emporte toujours, et un fichier absent ou une permission de
 * lecture refusee ne fait rien, donc la CI, qui passe ses secrets en variables
 * d'environnement, n'est pas touchee.
 */

// EN: byte order mark some Windows editors put at the start of a file.
// FR : marque d'ordre des octets que certains editeurs Windows posent en tete.
const MARQUE_ORDRE = String.fromCharCode(0xfeff);

// EN: parse KEY=value lines, ignoring comments, blanks and surrounding quotes.
// FR : lit les lignes CLE=valeur, en ignorant commentaires, lignes vides et guillemets.
export function parserEnv(texte: string): Map<string, string> {
  const paires = new Map<string, string>();
  const propre = texte.startsWith(MARQUE_ORDRE) ? texte.slice(1) : texte;
  for (const brute of propre.split(/\r?\n/)) {
    const ligne = brute.trim().replace(/^export\s+/, "");
    if (!ligne || ligne.startsWith("#")) continue;
    const egal = ligne.indexOf("=");
    if (egal <= 0) continue;
    const cle = ligne.slice(0, egal).trim();
    let valeur = ligne.slice(egal + 1).trim();
    const guillemet = valeur[0];
    if ((guillemet === '"' || guillemet === "'") && valeur.length > 1 && valeur.endsWith(guillemet)) {
      valeur = valeur.slice(1, -1);
    }
    paires.set(cle, valeur);
  }
  return paires;
}

// EN: path of the central file, overridable by CENTRAL_ENV_FILE.
// FR : chemin du fichier central, surchargeable par CENTRAL_ENV_FILE.
function cheminCentral(): string | null {
  const surcharge = Deno.env.get("CENTRAL_ENV_FILE");
  if (surcharge) return surcharge;
  const maison = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE");
  return maison ? `${maison}/.secrets/projets.env` : null;
}

export function chargerEnvCentral(): void {
  try {
    const chemin = cheminCentral();
    if (!chemin) return;
    for (const [cle, valeur] of parserEnv(Deno.readTextFileSync(chemin))) {
      if (Deno.env.get(cle) === undefined) Deno.env.set(cle, valeur);
    }
  } catch {
    // EN: file absent or read not allowed: nothing to load.
    // FR : fichier absent ou lecture non autorisee : rien a charger.
  }
}
