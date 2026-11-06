import { defineConfig, devices } from "@playwright/test";

/**
 * Deux parcours seulement, les deux qui comptent : trouver une brocante autour
 * de soi, et ouvrir sa fiche pour savoir ou aller. Le telephone d'abord,
 * puisque c'est ainsi qu'on consulte le samedi matin.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
  },
  projects: [
    { name: "telephone", use: { ...devices["Pixel 7"] } },
    { name: "bureau", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
