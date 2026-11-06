import { expect, test } from "@playwright/test";

/**
 * Parcours 1 : ce que quelqu'un fait reellement le samedi matin. Il ouvre le
 * site, voit ce qu'il y a autour de lui, et ouvre une annonce pour savoir ou
 * aller.
 */
test("trouver une brocante autour de soi et ouvrir sa fiche", async ({
  page,
}) => {
  await page.goto("/");

  // L'entete annonce un nombre, pas une page vide qui laisserait croire a une
  // panne. Un ecran qui s'ouvre vide se lit comme "il n'y a rien".
  const entete = page.locator("main > header");
  await expect(entete.getByRole("heading", { level: 1 })).toHaveText(
    "Brocantes",
  );
  await expect(entete).toContainText(/annonces? - a moins de 20 km/);

  const annonces = page.locator("#resultats li");
  const combien = await annonces.count();
  expect(combien).toBeGreaterThan(0);

  // Chaque annonce porte une commune et une distance : sans elles, la liste ne
  // repond pas a la question posee.
  const premiere = annonces.first();
  await expect(premiere).toContainText(/a \d/);

  await premiere.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/evenement\//);

  // La fiche doit repondre a "quand" et "ou", et citer sa source : c'est
  // l'obligation de l'article L322-1 du CRPA.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Date", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Itineraire" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Source", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/releve le \d{2}\/\d{2}\/\d{4}/)).toBeVisible();

  // Le lien de source pointe vers la page officielle de la commune, pas vers
  // la page d'accueil de son site.
  const source = page
    .locator("a[rel='noreferrer']")
    .filter({ hasNotText: "Voir sur une carte" })
    .first();
  await expect(source).toHaveAttribute("href", /^https?:\/\/.+\/.+/);
});

/**
 * Parcours 2 : restreindre la recherche. Les filtres vivent dans l'URL, donc
 * une recherche se partage par copie du lien et le retour arriere fonctionne.
 */
test("restreindre le rayon change les resultats et l'URL", async ({ page }) => {
  await page.goto("/");
  const depart = await page.locator("#resultats li").count();

  await page.getByRole("button", { name: "5 km" }).click();
  await expect(page).toHaveURL(/rayon=5/);
  await expect(page.locator("main > header")).toContainText("a moins de 5 km");

  const reduit = await page.locator("#resultats li").count();
  expect(reduit).toBeLessThanOrEqual(depart);

  // Le retour arriere ramene la recherche precedente, parce que l'etat est
  // dans l'URL et nulle part ailleurs.
  await page.goBack();
  await expect(page.locator("main > header")).toContainText("a moins de 20 km");
});

test("la recherche par commune accepte un nom ecrit simplement", async ({
  page,
}) => {
  await page.goto("/");
  // Personne ne tape "L'Hay-les-Roses" avec son apostrophe et son y trema.
  await page.getByLabel("Autour de").fill("l hay");
  const suggestion = page.getByRole("button", { name: /L'Ha/ }).first();
  await expect(suggestion).toBeVisible({ timeout: 10000 });
  await suggestion.click();
  await expect(page).toHaveURL(/lieu=/);
  await expect(page.locator("main > header")).toContainText(/Ha/);
});

test("une page de commune porte le balisage Event", async ({ page }) => {
  await page.goto("/brocantes/chevilly-larue");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Chevilly-Larue",
  );

  const balisage = await page
    .locator('script[type="application/ld+json"]')
    .first()
    .textContent();
  expect(balisage).toBeTruthy();
  const json = JSON.parse(balisage!) as {
    "@type": string;
    itemListElement: Array<{ item: { "@type": string; startDate: string } }>;
  };
  expect(json["@type"]).toBe("ItemList");
  expect(json.itemListElement.length).toBeGreaterThan(0);
  expect(json.itemListElement[0]!.item["@type"]).toBe("Event");
  expect(json.itemListElement[0]!.item.startDate).toMatch(/^\d{4}-\d{2}-\d{2}/);
});
