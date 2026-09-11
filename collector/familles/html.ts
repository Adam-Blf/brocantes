/**
 * Famille "html" : les communes qui publient une brocante sans exposer de flux.
 *
 * Douze communes du Val-de-Marne sont dans ce cas au 11/09/2026, et c'est
 * precisement la ou se trouvent les brocantes. Elles tournent sur cinq moteurs
 * differents, WordPress, TYPO3, Drupal, Joomla et un CMS proprietaire : ecrire
 * un parseur par structure de page serait douze fois du code fragile, casse au
 * premier changement de theme.
 *
 * D'ou une lecture qui ne suppose aucune structure. On ne cherche ni une classe
 * CSS ni une balise particuliere : on releve les liens de la page, on garde ceux
 * dont le texte ou l'adresse evoque une brocante, et on va lire la date sur la
 * fiche. Un site peut changer entierement d'apparence sans casser ca, tant qu'il
 * continue de nommer ses evenements en francais.
 *
 * Le prix a payer est une requete par fiche retenue. Le filtre passe donc AVANT
 * d'aller chercher quoi que ce soit : sur une page de vingt-cinq evenements, on
 * en ouvre une ou deux.
 */

import { obtenir } from "../lib/http.ts";
import { classer } from "../lib/classer.ts";
import { extraireDates } from "../lib/dates.ts";
import type { EvenementBrut, ResultatCollecte, Source } from "../lib/types.ts";

/** Au dela, on soupconne un filtre trop large plutot qu'une commune prolifique. */
const MAX_FICHES = 6;

function decoder(s: string): string {
  return s
    // Le contenu des balises script et style n'est pas du texte : sans cette
    // coupe, du JavaScript de partage social atterrissait dans la description
    // d'une fiche, ce qui la rendait illisible et faussait la recherche de date.
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&rsquo;|&#8217;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function texteDuSlug(url: string): string {
  const dernier = url.split("?")[0].replace(/\/+$/, "").split("/").pop() ?? "";
  return decodeURIComponent(dernier)
    .replace(/\.(html?|php)$/i, "")
    .replace(/^\d+[-_]/, "")
    .replace(/[-_]/g, " ");
}

/**
 * Une adresse postale francaise reperee dans le texte d'une fiche.
 * Volontairement stricte : mieux vaut aucune adresse, l'evenement etant alors
 * place au centre de la commune, qu'une adresse fausse qui enverrait quelqu'un
 * a l'autre bout de la ville.
 */
function chercherAdresse(texte: string): string | undefined {
  // Une adresse s'arrete au premier signe qui n'en fait plus partie. Sans cette
  // coupe on recupere "place Charles Digeon et dans le Val de Gaulle ! En
  // savoir", soit l'adresse plus la phrase suivante plus le libelle d'un lien,
  // ce qui fait echouer le geocodage au lieu de l'aider.
  const couper = (a: string) =>
    a
      .split(/[!?\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}]/u)[0]
      .replace(/\s(?:en savoir|localisation|voir le plan|itin[ée]raire)\b.*/i, "")
      .replace(/\s{2,}/g, " ")
      .trim();

  const m =
    /\b(\d{1,3}(?:\s?(?:bis|ter))?)\s+((?:rue|avenue|boulevard|place|allee|all[ée]e|chemin|route|quai|esplanade|square|impasse|cours)\s+[^.,;|]{3,60})/i
      .exec(texte);
  if (m) return couper(`${m[1]} ${m[2]}`) || undefined;

  const sansNumero =
    /\b((?:place|esplanade|parc|square|mail)\s+(?:de\s+la\s+|de\s+|du\s+|des\s+|d')?[A-ZÉÈÀ][^.,;|]{3,50})/
      .exec(texte);
  return sansNumero?.[1] ? couper(sansNumero[1]) || undefined : undefined;
}

/**
 * Retire d'une description le fil d'ariane et les boutons de partage.
 *
 * Sur une page de mairie, le texte utile est entoure de "Accueil Actualites
 * Agenda", "Imprimer cette page", "Partager Facebook LinkedIn Twitter". Ce
 * n'est pas l'information publique reutilisee, c'est le mobilier du site, et
 * l'afficher donnerait une fiche illisible.
 */
function sansNavigation(texte: string, titre: string): string {
  // Le fil d'ariane precede toujours le titre, et le titre est souvent repete
  // deux ou trois fois avant le corps. Couper a sa DERNIERE occurrence enleve
  // "Accueil Actualites Agenda" et les repetitions d'un seul geste, sans avoir
  // a deviner la structure du site.
  const bas = texte.toLowerCase();
  const dernier = bas.lastIndexOf(titre.toLowerCase());
  if (dernier > 0 && dernier < texte.length / 2) {
    texte = texte.slice(dernier + titre.length);
  }

  let t = texte
    .replace(/(imprimer cette page|exporter la page[^.]*|envoyer [àa] un ami|partager)/gi, " ")
    .replace(/(facebook|linkedin|twitter|whatsapp|instagram)/gi, " ")
    .replace(/(dans cette page|sommaire|accueil|ajouter au calendrier)/gi, " ")
    .replace(/mis [àa] jour le [^.]{0,40}/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  // Le titre est souvent repete deux ou trois fois avant le corps.
  while (t.toLowerCase().startsWith(titre.toLowerCase())) {
    t = t.slice(titre.length).replace(/^[\s:.,-]+/, "");
  }
  return t;
}

export async function collecter(source: Source): Promise<ResultatCollecte> {
  const evenements: EvenementBrut[] = [];
  let vues = 0;

  try {
    const liste = await obtenir(source.url);
    if (liste.statut !== 200) {
      return { source, evenements, vues, erreur: `HTTP ${liste.statut} sur la liste` };
    }

    const origine = new URL(source.url).origin;
    const candidates = new Map<string, string>(); // url -> texte d'ancrage

    for (const m of liste.texte.matchAll(/<a\b[^>]*href="([^"#]+)"[^>]*>(.*?)<\/a>/gis)) {
      const brut = m[1];
      if (/^(mailto:|tel:|javascript:)/i.test(brut)) continue;

      let url: string;
      try {
        url = new URL(brut, origine).toString();
      } catch {
        continue;
      }
      // On ne sort pas du domaine de la mairie : un lien vers un agregateur
      // tiers nous ferait reutiliser sa base, pas celle de la commune.
      if (new URL(url).origin !== origine) continue;

      const ancre = decoder(m[2]);
      if (!candidates.has(url)) candidates.set(url, ancre);
      else if (ancre.length > (candidates.get(url)?.length ?? 0)) {
        candidates.set(url, ancre);
      }
    }
    vues = candidates.size;

    const retenues: string[] = [];
    for (const [url, ancre] of candidates) {
      // Le texte du lien OU le titre porte par l'adresse suffisent : certains
      // moteurs rendent un lien vide autour d'une image.
      if (classer(ancre).type || classer(texteDuSlug(url)).type) {
        retenues.push(url);
      }
      if (retenues.length >= MAX_FICHES) break;
    }

    for (const url of retenues) {
      const fiche = await obtenir(url);
      if (fiche.statut !== 200) continue;

      const titre =
        decoder(/<h1[^>]*>(.*?)<\/h1>/is.exec(fiche.texte)?.[1] ?? "") ||
        candidates.get(url) ||
        texteDuSlug(url);
      if (!titre) continue;

      // On lit le corps seulement, pas la navigation ni le pied de page, qui
      // portent souvent des dates sans rapport avec l'evenement.
      const corps =
        /<main\b[^>]*>(.*?)<\/main>/is.exec(fiche.texte)?.[1] ??
          /<article\b[^>]*>(.*?)<\/article>/is.exec(fiche.texte)?.[1] ??
          fiche.texte;
      const texte = decoder(corps);

      // Le titre de la fiche fait foi : une page d'agenda peut lister une
      // brocante dans un encadre "a voir aussi" sans en etre une.
      if (!classer(titre, texte.slice(0, 400)).type) continue;

      const dates = extraireDates({ titre, contenu: texte });
      if (!dates) continue;

      // Une date deduite d'une date de publication n'est pas une date
      // d'evenement. Ici, sans flux, elle n'existe pas : on refuse plutot que
      // d'annoncer un horaire invente.
      if (dates.fiabilite !== "declaree") continue;

      evenements.push({
        idExterne: url,
        titreSource: titre,
        adresseSource: chercherAdresse(texte),
        debutLe: dates.debut,
        finLe: dates.fin,
        urlSource: url,
        description: sansNavigation(texte, titre).slice(0, 600) || undefined,
      });
    }

    return { source, evenements, vues };
  } catch (e) {
    return {
      source,
      evenements,
      vues,
      erreur: e instanceof Error ? e.message : String(e),
    };
  }
}
