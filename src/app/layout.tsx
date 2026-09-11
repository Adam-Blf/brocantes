import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_URL ?? "https://brocantes.beloucif.com",
  ),
  title: {
    default: "Brocantes et vide-greniers du Val-de-Marne",
    template: "%s - Brocantes du Val-de-Marne",
  },
  description:
    "Les brocantes et vide-greniers autour de chez vous, en Val-de-Marne et a Paris. Sources officielles des mairies, mises a jour chaque jour.",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Brocantes du Val-de-Marne",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#16140f" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>
        <a
          href="#resultats"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-[var(--papier)] focus:px-4 focus:py-2 focus:underline"
        >
          Aller aux resultats
        </a>
        {children}
      </body>
    </html>
  );
}
