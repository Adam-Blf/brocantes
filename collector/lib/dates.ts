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
 * Une date ecrite en francais dans du texte : "16 septembre 2026",
 * "1er octobre 2026", "du 16 au 20 septembre 2026".
 * Rend la premiere trouvee, et la derniere si la plage en contient deux.
 */
function depuisTexteFr(texte: string): { debut: Date; fin: Date } | null {
  const t = sansAccent(texte.toLowerCase());
  const nomsMois = Object.keys(MOIS).join("|");

  // Une heure lue dans un texte francais est une heure de Paris, jamais UTC.
  // Construire la date en UTC decalait tout de deux heures : un vide-grenier
  // annonce a 8h30 s'affichait a 10h30, ce qui est pire qu'une absence de date
  // parce que ca a l'air juste.
  const aParis = (an: string, mois: number, jour: string, heure: number) =>
    new Date(
      `${an}-${String(mois + 1).padStart(2, "0")}-${jour.padStart(2, "0")}` +
        `T${String(heure).padStart(2, "0")}:00:00${decalageParis(+an, mois)}`,
    );

  // Plage explicite : "du 16 au 20 septembre 2026"
  const plage = new RegExp(
    `du\\s+(\\d{1,2})(?:er)?\\s+(?:(${nomsMois})\\s+)?au\\s+(\\d{1,2})(?:er)?\\s+(${nomsMois})\\s+(\\d{4})`,
  ).exec(t);
  if (plage) {
    const [, j1, m1, j2, m2, an] = plage;
    return {
      debut: aParis(an, MOIS[m1 ?? m2], j1, 8),
      fin: aParis(an, MOIS[m2], j2, 20),
    };
  }

  const simple = new RegExp(
    `(\\d{1,2})(?:er)?\\s+(${nomsMois})\\s+(\\d{4})`,
  ).exec(t);
  if (simple) {
    const [, j, m, an] = simple;
    return { debut: aParis(an, MOIS[m], j, 8), fin: aParis(an, MOIS[m], j, 20) };
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
  for (const [champ, texte] of [
    ["titre", s.titre],
    ["contenu", s.contenu],
    ["description", s.description],
  ] as const) {
    if (!texte) continue;
    const trouve = depuisTexteFr(texte.replace(/<[^>]+>/g, " "));
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
