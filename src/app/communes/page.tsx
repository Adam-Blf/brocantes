import type { Metadata } from "next";
import Link from "next/link";
import { communesCouvertes } from "@/lib/recherche";
import { Pied } from "@/components/Pied";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Communes couvertes",
  description:
    "La liste des communes dont l'agenda officiel est releve chaque jour.",
  alternates: { canonical: "/communes" },
};

export default async function Communes() {
  const communes = await communesCouvertes();
  const parDepartement = new Map<string, typeof communes>();
  for (const c of communes) {
    const liste = parDepartement.get(c.departement) ?? [];
    liste.push(c);
    parDepartement.set(c.departement, liste);
  }

  return (
    <main className="mx-auto max-w-3xl">
      <header className="px-4 pt-8 pb-4 sm:px-6">
        <nav className="text-[14px]">
          <Link href="/" className="underline hover:text-[var(--tampon)]">
            Toutes les brocantes
          </Link>
        </nav>
        <h1 className="mt-4 font-[family-name:var(--font-titre)] text-[30px] sm:text-[38px]">
          Communes couvertes
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-[var(--encre-pale)]">
          {communes.length} communes dont l&apos;agenda officiel est releve
          chaque jour. Une commune n&apos;apparait ici qu&apos;une fois sa source
          branchee et verifiee : une page sans source serait une page vide.
        </p>
      </header>

      {[...parDepartement.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dept, liste]) => (
          <section key={dept} className="filet px-4 py-5 sm:px-6">
            <h2 className="text-[14px] uppercase tracking-wider text-[var(--tampon)]">
              Departement {dept}
            </h2>
            <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
              {liste.map((c) => (
                <li key={c.code_insee}>
                  <Link
                    href={`/brocantes/${c.slug}`}
                    className="text-[16px] underline decoration-[var(--filet)] underline-offset-4 hover:decoration-[var(--tampon)]"
                  >
                    {c.nom}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

      <Pied />
    </main>
  );
}
