import Link from "next/link";

/**
 * Le bandeau de tete d'un journal : le titre, un filet, et la ligne de date qui
 * dit ce qu'on regarde. Le nombre de resultats y figure parce que c'est la
 * premiere chose qu'on veut savoir.
 */
export function Entete({
  nombre,
  lieu,
  rayonKm,
}: {
  nombre: number;
  lieu: string;
  rayonKm: number;
}) {
  return (
    <header className="px-4 pt-8 pb-4 sm:px-6">
      <div className="flex items-baseline justify-between gap-4">
        <Link href="/" className="inline-block">
          <h1 className="font-[family-name:var(--font-titre)] text-[30px] leading-none tracking-tight sm:text-[38px]">
            Brocantes
          </h1>
        </Link>
        <p className="text-right text-[13px] uppercase tracking-wider text-[var(--encre-pale)]">
          Val-de-Marne
          <br />
          et Paris
        </p>
      </div>

      <div className="mt-4 border-t-2 border-b border-[var(--encre)] py-2">
        <p className="text-[14px] uppercase tracking-wider">
          {nombre === 0
            ? "Aucune annonce"
            : `${nombre} annonce${nombre > 1 ? "s" : ""}`}
          <span className="text-[var(--encre-pale)]">
            {` - a moins de ${rayonKm} km de ${lieu}`}
          </span>
        </p>
      </div>
    </header>
  );
}
