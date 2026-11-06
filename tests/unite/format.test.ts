import { describe, expect, it } from "vitest";
import {
  distance,
  horaires,
  itineraire,
  jourCourt,
  releve,
  surPlusieursJours,
  tarif,
} from "@/lib/format";

describe("horaires", () => {
  it("affiche une plage lisible en heure de Paris", () => {
    // 06:00 UTC en septembre, c'est 8h a Paris.
    expect(horaires("2026-09-20T06:00:00Z", "2026-09-20T16:00:00Z")).toBe(
      "08h00 - 18h00",
    );
  });

  it("ne montre rien quand la journee entiere sert de repli", () => {
    // Un evenement sans horaire lisible couvre minuit a 23h59. Afficher
    // "00h00 - 23h59" donnerait l'apparence d'une information alors que c'est
    // l'absence d'information.
    expect(horaires("2026-09-12T22:00:00Z", "2026-09-13T21:59:00Z")).toBeNull();
  });

  it("tient compte du passage a l'heure d'hiver", () => {
    // Fin novembre, Paris est a UTC+1 : 8h locale vaut 07:00 UTC.
    expect(horaires("2026-11-22T07:00:00Z", "2026-11-22T17:00:00Z")).toBe(
      "08h00 - 18h00",
    );
  });
});

describe("surPlusieursJours", () => {
  it("reconnait un evenement d'un seul jour", () => {
    expect(
      surPlusieursJours("2026-09-20T06:00:00Z", "2026-09-20T16:00:00Z"),
    ).toBe(false);
  });

  it("reconnait un salon qui dure une semaine", () => {
    expect(
      surPlusieursJours("2026-10-08T09:00:00Z", "2026-10-18T18:00:00Z"),
    ).toBe(true);
  });
});

describe("distance", () => {
  it("donne des metres en dessous du kilometre", () => {
    expect(distance(420)).toBe("400 m");
  });

  it("donne une decimale sous dix kilometres", () => {
    expect(distance(1840)).toBe("1,8 km");
  });

  it("arrondit au dela de dix kilometres", () => {
    expect(distance(14400)).toBe("14 km");
  });
});

describe("tarif", () => {
  it("distingue la gratuite d'une absence d'information", () => {
    expect(tarif(0)).toBe("entree libre");
    expect(tarif(null)).toBeNull();
  });

  it("formate en euros a la francaise", () => {
    expect(tarif(250)).toBe("2,50 euros");
  });
});

describe("releve", () => {
  it("le dit quand la date manque, plutot que d'en inventer une", () => {
    expect(releve(null)).toBe("date de releve inconnue");
  });
});

describe("itineraire", () => {
  it("construit un lien geo: que l'application de cartes comprend", () => {
    const l = itineraire(48.7647, 2.3494, "Brocante d'automne");
    expect(l).toContain("geo:48.7647,2.3494");
    expect(l).toContain("Brocante");
  });
});

describe("jourCourt", () => {
  it("ecrit la date en francais", () => {
    expect(jourCourt("2026-09-20T06:00:00Z")).toMatch(/dim/i);
  });
});
