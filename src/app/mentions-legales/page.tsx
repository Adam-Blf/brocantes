import type { Metadata } from "next";
import Link from "next/link";
import { Pied } from "@/components/Pied";

export const metadata: Metadata = {
  title: "Mentions legales",
  robots: { index: false, follow: true },
  alternates: { canonical: "/mentions-legales" },
};

/**
 * Version de travail. Cette page doit passer par un professionnel du droit
 * avant toute mise en ligne publique, conformement a la regle du projet. Elle
 * n'affiche que le strict minimum exige : pas de SIRET, pas d'adresse de
 * domicile, pas de code APE, rien qui ne soit obligatoire pour un service
 * gratuit edite par un particulier.
 */
export default function MentionsLegales() {
  return (
    <main className="mx-auto max-w-3xl">
      <header className="px-4 pt-8 pb-4 sm:px-6">
        <nav className="text-[14px]">
          <Link href="/" className="underline hover:text-[var(--tampon)]">
            Toutes les brocantes
          </Link>
        </nav>
        <h1 className="mt-4 font-[family-name:var(--font-titre)] text-[30px] sm:text-[38px]">
          Mentions legales
        </h1>
      </header>

      <div className="space-y-8 px-4 py-4 text-[16px] leading-relaxed sm:px-6">
        <p className="border border-[var(--tampon)] bg-[var(--tampon-pale)] p-4 text-[15px] text-[var(--tampon)]">
          Version de travail. Ce service n&apos;est pas encore ouvert au public
          et cette page doit etre validee par un professionnel du droit avant
          sa mise en ligne.
        </p>

        <section>
          <h2 className="font-[family-name:var(--font-titre)] text-[22px]">
            Editeur
          </h2>
          <p className="mt-2">
            Service edite a titre personnel et non commercial. Contact par
            courriel, adresse indiquee a la mise en ligne.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-titre)] text-[22px]">
            Origine des informations
          </h2>
          <p className="mt-2">
            Les annonces sont reprises des agendas publies par les communes du
            Val-de-Marne et du jeu de donnees ouvert « Que faire a Paris ? » de
            la Ville de Paris, diffuse sous licence ODbL.
          </p>
          <p className="mt-2">
            Cette reutilisation s&apos;appuie sur les articles L321-1 et
            suivants du code des relations entre le public et l&apos;
            administration. Conformement a l&apos;article L322-1, les
            informations ne sont ni alterees ni denaturees, et chaque fiche
            indique sa source ainsi que la date de son dernier releve.
          </p>
          <p className="mt-2">
            Une commune qui souhaite une rectification ou un retrait peut le
            demander par courriel ; la demande est traitee sous 72 heures.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-titre)] text-[22px]">
            Donnees personnelles
          </h2>
          <p className="mt-2">
            <strong>Votre position</strong> n&apos;est demandee que si vous
            cliquez sur « Me localiser ». Elle sert uniquement a calculer les
            distances affichees, reste dans votre navigateur, et n&apos;est ni
            enregistree ni transmise.
          </p>
          <p className="mt-2">
            <strong>Aucun compte</strong> n&apos;est necessaire. Le service ne
            depose aucun cookie de mesure d&apos;audience ni de publicite.
          </p>
          <p className="mt-2">
            <strong>Si vous declarez un evenement</strong>, votre nom et votre
            courriel sont conserves douze mois apres la date de
            l&apos;evenement, le temps de verifier l&apos;annonce et de vous
            recontacter si besoin. Ils ne sont jamais publies. Vous pouvez en
            demander l&apos;acces, la rectification ou la suppression a tout
            moment.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-titre)] text-[22px]">
            Fond de carte
          </h2>
          <p className="mt-2">
            Institut national de l&apos;information geographique et forestiere,
            Geoplateforme, licence etalab 2.0.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-titre)] text-[22px]">
            Limites
          </h2>
          <p className="mt-2">
            Les horaires et adresses sont ceux publies par les organisateurs.
            Un evenement peut etre annule ou deplace sans que cette page en soit
            informee. Verifiez toujours sur la source citee avant de vous
            deplacer.
          </p>
        </section>
      </div>

      <Pied />
    </main>
  );
}
