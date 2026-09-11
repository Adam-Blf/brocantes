import { afterEach, describe, expect, it, vi } from "vitest";
import { bornes } from "@/lib/types";

afterEach(() => vi.useRealTimers());

describe("bornes", () => {
  it("le samedi, ce week-end inclut la journee en cours", () => {
    // Un chineur qui ouvre le site le samedi matin veut voir sa journee, pas
    // seulement le lendemain.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T07:00:00+02:00")); // un samedi
    const { debut, fin } = bornes("week-end");
    expect(debut.getTime()).toBeLessThanOrEqual(
      new Date("2026-09-12T07:00:00+02:00").getTime(),
    );
    // La borne haute tombe le dimanche 13 au soir.
    expect(fin.toISOString().slice(0, 10)).toBe("2026-09-13");
  });

  it("en semaine, ce week-end va jusqu'au dimanche suivant", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T12:00:00+02:00")); // un mercredi
    const { fin } = bornes("week-end");
    expect(fin.toISOString().slice(0, 10)).toBe("2026-09-13");
  });

  it("le dimanche, la borne reste le jour meme", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-13T09:00:00+02:00")); // un dimanche
    const { fin } = bornes("week-end");
    expect(fin.toISOString().slice(0, 10)).toBe("2026-09-13");
  });

  it("sept jours couvre bien sept jours", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-11T12:00:00+02:00"));
    const { debut, fin } = bornes("7j");
    const jours = (fin.getTime() - debut.getTime()) / 86400000;
    expect(Math.round(jours)).toBe(7);
  });
});
