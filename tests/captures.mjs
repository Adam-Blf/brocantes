/**
 * Prend les captures qui servent de preuve visuelle : liste et carte, en
 * 390 px de large, dans les deux themes.
 *
 * Separe des tests parce que ce n'est pas une verification mais une trace. Un
 * test echoue ou passe ; une capture se regarde.
 *
 *   node tests/captures.mjs [url] [dossier]
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const BASE = process.argv[2] ?? "http://localhost:3000";
const DOSSIER = process.argv[3] ?? "captures";

const PAGES = [
  { nom: "liste", chemin: "/", apres: null },
  { nom: "carte", chemin: "/", apres: "carte" },
  { nom: "commune", chemin: "/brocantes/chevilly-larue", apres: null },
];

await mkdir(DOSSIER, { recursive: true });
const navigateur = await chromium.launch();

for (const theme of ["light", "dark"]) {
  const contexte = await navigateur.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: theme,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
  });

  for (const p of PAGES) {
    const page = await contexte.newPage();
    // networkidle n'arrive jamais : MapLibre garde des connexions ouvertes
    // pour ses tuiles. On attend donc ce qui doit reellement etre visible.
    await page.goto(`${BASE}${p.chemin}`, { waitUntil: "domcontentloaded" });
    await page.locator("main > header h1").waitFor({ state: "visible" });

    if (p.apres === "carte") {
      await page.getByRole("button", { name: "carte" }).click();
      // La carte charge ses tuiles : sans cette attente, la capture montre un
      // cadre vide, ce qui ne prouverait rien.
      await page.waitForTimeout(3500);
    }

    const fichier = `${DOSSIER}/${p.nom}-390-${theme}.png`;
    await page.screenshot({
      path: fichier,
      fullPage: p.apres !== "carte",
    });
    console.log(`  ${fichier}`);
    await page.close();
  }
  await contexte.close();
}

await navigateur.close();
console.log("\ncaptures prises");
