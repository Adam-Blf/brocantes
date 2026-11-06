/**
 * Extraction de dates depuis des flux municipaux.
 *
 * Les cinq flux RSS branches encodent leurs dates de cinq facons differentes,
 * constate le 11/09/2026 en sondant les flux reels plutot qu'en supposant un
 * format. D'ou une cascade : on essaie du plus fiable au moins fiable, et on
 * dit lequel a repondu, parce qu'une date tiree d'un pubDate ne vaut pas une
 * date declaree dans un champ dedie.
 */

const MOIS: Record<string, number> = {
  janvier: 0, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5,
  juillet: 6, aout: 7, septembre: 8, octobre: 9, novembre: 10, decembre: 11,
};

/** Retire les accents pour que "février" et "fevrier" tombent sur la meme cle. */
function sansAccent(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export type Fiabilite = "declaree" | "deduite";

export interface Dates {
  debut: Date;
  fin: Date;
  fiabilite: Fiabilite;
  /** Quel extracteur a repondu. Journalise, pour pouvoir enqueter plus tard. */
  origine: string;
}

/** Format compact de Fresnes : "20260916" plus un horaire "1000". */
function depuisCompact(d: string, h?: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(d.trim());
  if (!m) return null;
  const heure = h && /^\d{3,4}$/.test(h) ? h.padStart(4, "0") : "0000";
  return new Date(
    `${m[1]}-${m[2]}-${m[3]}T${heure.slice(0, 2)}:${heure.slice(2)}:00+02:00`,
  );
}

/**
 * Horaires ecrits en francais : "de 8h30 a 17h30", "de 10h00 a 17h00",
 * "8 h 00 min a 18 h 00 min", "08h00 ... 18h00".
 *
 * Sans cela il faut inventer un horaire par defaut, et un horaire invente est
 * une denaturation de l'information au sens de l'article L322-1 du CRPA : une
 * brocante annoncee de 10h a 17h affichee de 8h a 20h envoie quelqu'un devant
 * une place vide. Quand l'horaire est introuvable, on le dit au lieu de le
 * combler.
 */
export function horairesDuTexte(
  texte: string,
): { debut: number; fin: number } | null {
  const t = texte.toLowerCase().replace(/\s*min\b/g, "");
  // Les minutes doivent etre des minutes : bornees a 59, et non suivies d'une
  // lettre. Sans cette derniere garde, "18h 47eme Brocante de Sucy" rendait une
  // fin a 18h47, le numero d'edition ayant ete lu comme un horaire.
  const plage =
    /(?:de\s+)?(\d{1,2})\s?h\s?([0-5]\d)?(?![\dA-Za-zÀ-ÿ])\s*(?:a|à|-|jusqu'a|jusqu'à)\s*(\d{1,2})\s?h\s?([0-5]\d)?(?![\dA-Za-zÀ-ÿ])/
      .exec(t) ??
      // Forme a deux points, "8:00 / 18:00" ou "8:00 - 18:00", utilisee par
      // Le Perreux-sur-Marne. Le separateur est ici une barre oblique aussi,
      // et les minutes sont obligatoires, sans quoi "13 septembre 2026 8"
      // passerait pour un horaire.
      /(\d{1,2}):([0-5]\d)\s*[\/\-–]\s*(\d{1,2}):([0-5]\d)/.exec(t);
  if (!plage) return null;
  const [, h1, m1 = "0", h2, m2 = "0"] = plage;
  const debut = +h1 + +m1 / 60;
  const fin = +h2 + +m2 / 60;
  // Une brocante ne commence pas a 23h et ne dure pas zero minute.
  if (debut >= fin || debut > 23 || fin > 24) return null;
  return { debut, fin };
}

/**
 * Une date ecrite en francais dans du texte : "16 septembre 2026",
 * "1er octobre 2026", "du 16 au 20 septembre 2026".
 * Rend la premiere trouvee, et la derniere si la plage en contient deux.
 */
function depuisTexteFr(
  texte: string,
  texteHoraire = texte,
): { debut: Date; fin: Date } | null {
  const t = sansAccent(texte.toLowerCase());
  const nomsMois = Object.keys(MOIS).join("|");

  // Une heure lue dans un texte francais est une heure de Paris, jamais UTC.
  // Construire la date en UTC decalait tout de deux heures : un vide-grenier
  // annonce a 8h30 s'affichait a 10h30, ce qui est pire qu'une absence de date
  // parce que ca a l'air juste.
  const aParis = (an: string, mois: number, jour: string, heure: number) => {
    const h = Math.floor(heure);
    const m = Math.round((heure - h) * 60);
    return new Date(
      `${an}-${String(mois + 1).padStart(2, "0")}-${jour.padStart(2, "0")}` +
        `T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00` +
        decalageParis(+an, mois),
    );
  };

  // Horaires reellement ecrits dans la page. En leur absence on retient la
  // journee entiere, de minuit a minuit : c'est visiblement approximatif, donc
  // honnete, alors qu'un 8h-20h invente a l'air d'une information.
  // L'horaire se cherche dans TOUT le corps, meme quand la date vient du
  // titre : "Le vide-grenier est de retour le 19 septembre" porte la date sans
  // l'heure, qui est plus bas dans la page.
  const h = horairesDuTexte(texteHoraire);
  const hDebut = h?.debut ?? 0;
  const hFin = h?.fin ?? 23.983;

  // Plage explicite : "du 16 au 20 septembre 2026"
  const plage = new RegExp(
    `du\\s+(\\d{1,2})(?:er)?\\s+(?:(${nomsMois})\\s+)?au\\s+(\\d{1,2})(?:er)?\\s+(${nomsMois})\\s+(\\d{4})`,
  ).exec(t);
  if (plage) {
    const [, j1, m1, j2, m2, an] = plage;
    return {
      debut: aParis(an, MOIS[m1 ?? m2], j1, hDebut),
      fin: aParis(an, MOIS[m2], j2, hFin),
    };
  }

  const simple = new RegExp(
    `(\\d{1,2})(?:er)?\\s+(${nomsMois})\\s+(\\d{4})`,
  ).exec(t);
  if (simple) {
    const [, j, m, an] = simple;
    return {
      debut: aParis(an, MOIS[m], j, hDebut),
      fin: aParis(an, MOIS[m], j, hFin),
    };
  }
  return null;
}

/**
 * Decalage reel de Paris a une date donnee, heure d'ete comprise.
 *
 * Coder la bascule a la main revient a reimplementer une table horaire et a se
 * tromper deux fois par an, precisement en mars et en octobre, c'est a dire en
 * pleine saison des brocantes. Le moteur connait deja la reponse.
 */
function decalageParis(an: number, mois: number): string {
  const reference = new Date(Date.UTC(an, mois, 15, 12));
  const partie = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    timeZoneName: "longOffset",
  })
    .formatToParts(reference)
    .find((p) => p.type === "timeZoneName")?.value;
  return partie?.replace("GMT", "") || "+01:00";
}

export interface SourcesDate {
  evStart?: string;
  evEnd?: string;
  description?: string;
  contenu?: string;
  titre?: string;
  pubDate?: string;
}

export function extraireDates(s: SourcesDate): Dates | null {
  // 1. Namespace RSS Event, le plus explicite. Bonneuil-sur-Marne.
  if (s.evStart) {
    const d = new Date(s.evStart);
    if (!isNaN(d.getTime())) {
      const f = s.evEnd ? new Date(s.evEnd) : d;
      return {
        debut: d,
        fin: isNaN(f.getTime()) ? d : f,
        fiabilite: "declaree",
        origine: "ev:startdate",
      };
    }
  }

  // 2. JSON glisse dans la description. Fresnes.
  const brut = `${s.description ?? ""}`;
  const json = /\{\{(.*?)\}\}/s.exec(brut);
  if (json) {
    try {
      const o = JSON.parse(`{${json[1]}}`) as Record<string, string>;
      const d = depuisCompact(o.EvtDatDebut ?? "", o.EvtHeuDebut);
      if (d) {
        const f = depuisCompact(o.EvtDatFin ?? o.EvtDatDebut ?? "", o.EvtHeuFin);
        return {
          debut: d,
          fin: f ?? d,
          fiabilite: "declaree",
          origine: "json dans description",
        };
      }
    } catch { /* description qui ressemble a du JSON sans en etre */ }
  }

  // 3. Format numerique francais en tete de description, "12/09/2026 08:30".
  //    C'est ainsi que Joomla prefixe ses items, et c'est la date de
  //    l'evenement, pas celle de l'article. Elle prime sur tout ce qui suit :
  //    sans elle, la cascade tombait sur le pubDate, qui porte la meme date
  //    mais declaree en UTC alors que l'heure ecrite est celle de Paris. Un
  //    vide-grenier de 8h30 s'affichait a 10h30, ce qui est pire qu'une absence
  //    de donnee parce que ca a l'air juste.
  if (s.description) {
    const m = /(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2})[:h](\d{2}))?/.exec(
      s.description.slice(0, 40),
    );
    if (m) {
      const [, j, mo, an, h = "08", mi = "00"] = m;
      const d = new Date(
        `${an}-${mo}-${j}T${h.padStart(2, "0")}:${mi}:00` +
          decalageParis(+an, +mo - 1),
      );
      if (!isNaN(d.getTime())) {
        return {
          debut: d,
          fin: d,
          fiabilite: "declaree",
          origine: "date numerique en tete de description",
        };
      }
    }
  }

  // 4. Date ecrite en francais, dans le titre puis dans le corps.
  // La DATE se cherche d'abord dans le titre, qui porte moins de bruit : une
  // page de mairie affiche volontiers "mis a jour le 24 aout" a cote de
  // l'evenement, et une date parasite passe pour une vraie. L'HORAIRE, lui, se
  // cherche toujours dans le corps entier.
  const corpsEntier = `${s.contenu ?? ""} ${s.description ?? ""}`.replace(
    /<[^>]+>/g,
    " ",
  );
  for (const [champ, texte] of [
    ["titre", s.titre],
    ["contenu", s.contenu],
    ["description", s.description],
  ] as const) {
    if (!texte) continue;
    const trouve = depuisTexteFr(texte.replace(/<[^>]+>/g, " "), corpsEntier);
    if (trouve) {
      return { ...trouve, fiabilite: "declaree", origine: `texte francais, ${champ}` };
    }
  }

  // 5. pubDate en dernier recours. Certaines communes y mettent la date de
  //    l'evenement, d'autres la date de publication de l'article : on ne peut
  //    pas distinguer les deux, donc la date est marquee deduite et l'evenement
  //    passera par la moderation plutot que d'etre publie tel quel.
  if (s.pubDate) {
    const d = new Date(s.pubDate);
    if (!isNaN(d.getTime())) {
      return { debut: d, fin: d, fiabilite: "deduite", origine: "pubDate" };
    }
  }

  return null;
}
