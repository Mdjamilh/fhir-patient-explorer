import type { Observation } from "fhir/r4";
import { describe, expect, it } from "vitest";

import { flagFor, latestCoded, latestVitals, socialHistory, toSeries, trend } from "./observations";

const LOINC = "http://loinc.org";
const lab = (code: string, display: string, value: number, date: string, extra: Partial<Observation> = {}): Observation => ({
  resourceType: "Observation",
  id: `${code}-${date}`,
  status: "final",
  category: [{ coding: [{ code: "laboratory" }] }],
  code: { coding: [{ system: LOINC, code, display }] },
  effectiveDateTime: date,
  valueQuantity: { value, unit: "mg/dL" },
  ...extra,
});

describe("toSeries", () => {
  it("groups by code, sorts points by date and puts the most recent series first", () => {
    const series = toSeries([
      lab("2339-0", "Glucose", 110, "2024-03-01"),
      lab("2339-0", "Glucose", 90, "2023-01-01"),
      lab("2093-3", "Cholesterol", 180, "2024-06-01"),
    ]);
    expect(series.map((s) => s.name)).toEqual(["Cholesterol", "Glucose"]);
    expect(series[1]!.points.map((p) => p.value)).toEqual([90, 110]);
    expect(series[1]!.latest.value).toBe(110);
    expect(series[1]!.category).toBe("laboratory");
  });

  it("splits panels such as blood pressure into one series per component", () => {
    const bp: Observation = {
      resourceType: "Observation",
      status: "final",
      category: [{ coding: [{ code: "vital-signs" }] }],
      code: { coding: [{ system: LOINC, code: "85354-9", display: "Blood pressure panel" }] },
      effectiveDateTime: "2024-01-01",
      component: [
        { code: { coding: [{ system: LOINC, code: "8480-6", display: "Systolic blood pressure" }] }, valueQuantity: { value: 128, unit: "mm[Hg]" } },
        { code: { coding: [{ system: LOINC, code: "8462-4", display: "Diastolic blood pressure" }] }, valueQuantity: { value: 82, unit: "mm[Hg]" } },
      ],
    };
    expect(toSeries([bp]).map((s) => [s.name, s.latest.value, s.category])).toEqual([
      ["Diastolic blood pressure", 82, "vital-signs"],
      ["Systolic blood pressure", 128, "vital-signs"],
    ]);
  });

  it("skips entered-in-error, undated and non-numeric observations", () => {
    expect(
      toSeries([
        lab("1", "A", 1, "2024-01-01", { status: "entered-in-error" }),
        lab("2", "B", 1, "2024-01-01", { effectiveDateTime: undefined }),
        lab("3", "C", 1, "2024-01-01", { valueQuantity: undefined, valueString: "positive" }),
      ]),
    ).toEqual([]);
  });

  it("flags values with the reference range", () => {
    const [series] = toSeries([
      lab("2339-0", "Glucose", 130, "2024-03-01", { referenceRange: [{ low: { value: 70 }, high: { value: 99 } }] }),
      lab("2339-0", "Glucose", 60, "2024-01-01"),
    ]);
    expect(series!.range).toEqual({ low: 70, high: 99 });
    // The older reading has no range of its own, so it uses the test's range.
    expect(series!.points.map((p) => p.flag)).toEqual(["low", "high"]);

    // Same answer whichever order the server returns them in.
    const reversed = toSeries([
      lab("2339-0", "Glucose", 60, "2024-01-01"),
      lab("2339-0", "Glucose", 130, "2024-03-01", { referenceRange: [{ low: { value: 70 }, high: { value: 99 } }] }),
    ]);
    expect(reversed[0]!.points.map((p) => p.flag)).toEqual(["low", "high"]);
  });
});

describe("flagFor", () => {
  it("prefers the server's interpretation over the range", () => {
    const interp = (code: string) => [{ coding: [{ code }] }];
    expect(flagFor(50, interp("HH"), { low: 0, high: 100 })).toBe("critical");
    expect(flagFor(50, interp("L"), undefined)).toBe("low");
    expect(flagFor(50, interp("N"), { high: 10 })).toBe("normal");
    expect(flagFor(5, undefined, { low: 10 })).toBe("low");
    expect(flagFor(15, undefined, { high: 10 })).toBe("high");
    expect(flagFor(10, undefined, { low: 10, high: 10 })).toBe("normal");
    expect(flagFor(10, undefined, undefined)).toBeUndefined();
  });
});

describe("trend", () => {
  it("reports direction with a 2% tolerance", () => {
    const series = (a: number, b: number) => toSeries([lab("x", "X", a, "2024-01-01"), lab("x", "X", b, "2024-02-01")])[0]!;
    expect(trend(series(100, 110))).toEqual({ direction: "up", delta: 10 });
    expect(trend(series(100, 90))?.direction).toBe("down");
    expect(trend(series(100, 101.5))?.direction).toBe("flat");
    expect(trend(toSeries([lab("x", "X", 1, "2024-01-01")])[0]!)).toBeUndefined();
  });
});

describe("latestCoded", () => {
  it("keeps the newest coded value per code", () => {
    const smoking = (value: string, date: string): Observation => ({
      resourceType: "Observation",
      status: "final",
      code: { coding: [{ system: LOINC, code: "72166-2", display: "Tobacco smoking status" }] },
      effectiveDateTime: date,
      valueCodeableConcept: { text: value },
    });
    expect(latestCoded([smoking("Former smoker", "2024-01-01"), smoking("Never smoker", "2020-01-01")])).toEqual([
      { name: "Tobacco smoking status", value: "Former smoker", date: "2024-01-01" },
    ]);
  });
});

describe("latestVitals", () => {
  it("combines blood pressure and picks common vitals by LOINC code", () => {
    const vital = (code: string, display: string, value: number, unit: string, extra: Partial<Observation> = {}) =>
      lab(code, display, value, "2024-05-01", { valueQuantity: { value, unit }, ...extra });
    const tiles = latestVitals(
      toSeries([
        vital("8480-6", "Systolic", 142, "mm[Hg]", { interpretation: [{ coding: [{ code: "H" }] }] }),
        vital("8462-4", "Diastolic", 88.4, "mm[Hg]"),
        vital("8867-4", "Heart rate", 72, "/min"),
        vital("39156-5", "BMI", 27.41, "kg/m2"),
        vital("2339-0", "Glucose", 99, "mg/dL"),
      ]),
    );
    expect(tiles.map((t) => [t.label, t.value, t.flag])).toEqual([
      ["Blood pressure", "142/88", "high"],
      ["Heart rate", "72", undefined],
      ["BMI", "27.41", undefined],
    ]);
  });
});

describe("socialHistory", () => {
  it("finds smoking status even when it is filed as a survey", () => {
    const smoking: Observation = {
      resourceType: "Observation",
      status: "final",
      category: [{ coding: [{ code: "survey" }] }],
      code: { coding: [{ system: LOINC, code: "72166-2", display: "Tobacco smoking status" }] },
      effectiveDateTime: "2024-01-01",
      valueCodeableConcept: { text: "Never smoker" },
    };
    const otherSurvey: Observation = { ...smoking, code: { coding: [{ system: LOINC, code: "99999-9", display: "Other" }] } };
    expect(socialHistory([smoking, otherSurvey]).map((o) => o.value)).toEqual(["Never smoker"]);
  });
});
