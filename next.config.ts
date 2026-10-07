import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { NextConfig } from "next";

// EN: local dev only. Load the central secrets file when it exists. Variables
// already set win, and on Vercel the file is absent so this is a no-op.
// FR : developpement local seulement. Charge le fichier de secrets central s'il
// existe. Les variables deja definies l'emportent, et sur Vercel le fichier est
// absent, donc rien ne se passe.
const centralEnvFile =
  process.env.CENTRAL_ENV_FILE ?? join(homedir(), ".secrets", "projets.env");
if (existsSync(centralEnvFile)) process.loadEnvFile(centralEnvFile);

const config: NextConfig = {
  reactStrictMode: true,

  // Aucun CDN a l'execution : les polices sont dans public/polices, les tuiles
  // viennent de l'IGN. La politique de securite le rend verifiable plutot que
  // promis, et casse bruyamment si quelqu'un ajoute un script distant.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // MapLibre compile ses styles dans un worker issu d'un blob.
              "script-src 'self' 'unsafe-inline' blob:",
              "worker-src 'self' blob:",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self'",
              "img-src 'self' data: blob: https://data.geopf.fr",
              // La base et le fond de carte, rien d'autre.
              "connect-src 'self' https://*.supabase.co https://data.geopf.fr",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // La geolocalisation est demandee par le site lui-meme, sur clic.
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
    ];
  },
};

export default config;
