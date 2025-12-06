import type { Patient } from "fhir/r4";
import { describe, expect, it } from "vitest";

import {
  ageInYears,
  codeableText,
  codeKey,
  formatAddress,
  formatDate,
  formatName,
  formatNameSortable,
  formatPeriod,
  formatQuantity,
  medicalRecordNumber,
  patientAge,
} from "./format";

describe("names", () => {
  it("prefers the official name and strips synthetic digit suffixes", () => {
    const names = [
      { use: "nickname" as const, given: ["Jim"] },
      { use: "official" as const, given: ["Jesus365", "Mario"], family: "Smitham815" },
    ];
    expect(formatName(names)).toBe("Jesus Mario Smitham");
    expect(formatNameSortable(names)).toBe("Smitham, Jesus Mario");
  });

  it("uses text when present and handles missing names", () => {
    expect(formatName([{ text: " Dr. Ann Lee " }])).toBe("Dr. Ann Lee");
    expect(formatName(undefined)).toBe("Unnamed patient");
    expect(formatName([{}])).toBe("Unnamed patient");
  });
});

describe("addresses and codes", () => {
  it("formats the home address", () => {
    expect(
      formatAddress([
        { use: "work", city: "Elsewhere" },
        { use: "home", line: ["12 Main St"], city: "Boston", state: "MA", postalCode: "02118", country: "US" },
      ]),
    ).toBe("12 Main St, Boston, MA 02118, US");
    expect(formatAddress([])).toBeUndefined();
  });

  it("reads codeable concepts", () => {
    expect(codeableText({ text: "Hypertension" })).toBe("Hypertension");
    expect(codeableText({ coding: [{ code: "x" }, { code: "38341003", display: "Hypertensive disorder" }] })).toBe("Hypertensive disorder");
    expect(codeableText({ coding: [{ code: "123" }] })).toBe("123");
    expect(codeableText(undefined, "None")).toBe("None");
    expect(codeKey({ coding: [{ system: "http://loinc.org", code: "2339-0" }] })).toBe("http://loinc.org|2339-0");
  });

  it("formats quantities with friendly units", () => {
    expect(formatQuantity({ value: 98.456, unit: "mg/dL" })).toBe("98.5 mg/dL");
    expect(formatQuantity({ value: 1.234, code: "kg/m2" })).toBe("1.23 kg/m²");
    expect(formatQuantity({ value: 1234.5, unit: "mL" })).toBe("1,235 mL");
    expect(formatQuantity({ value: 5, comparator: "<" })).toBe("<5");
    expect(formatQuantity(undefined)).toBe("—");
  });
});

describe("dates", () => {
  it("keeps the precision the data has and never shifts plain dates", () => {
    expect(formatDate("1953")).toBe("1953");
    expect(formatDate("1953-01")).toBe("Jan 1953");
    expect(formatDate("1953-01-10")).toBe("Jan 10, 1953");
    expect(formatDate("2020-03-01T00:30:00+14:00")).toBe("Mar 1, 2020");
    expect(formatDate(undefined)).toBe("—");
  });

  it("formats periods", () => {
    expect(formatPeriod({ start: "2020-01-01T10:00:00Z", end: "2020-01-01T11:00:00Z" })).toBe("Jan 1, 2020");
    expect(formatPeriod({ start: "2020-01-01", end: "2020-02-01" })).toBe("Jan 1, 2020 – Feb 1, 2020");
    expect(formatPeriod({ start: "2020-01-01" })).toBe("Jan 1, 2020 – ongoing");
    expect(formatPeriod(undefined)).toBe("—");
  });

  it("computes age, including around birthdays and for deceased patients", () => {
    const at = new Date("2026-01-10T12:00:00Z");
    expect(ageInYears("1953-01-10", at)).toBe(73);
    expect(ageInYears("1953-01-11", at)).toBe(72);
    expect(ageInYears("1953", at)).toBe(73);
    expect(ageInYears("2030-01-01", at)).toBeUndefined();

    const deceased: Patient = { resourceType: "Patient", birthDate: "1940-05-01", deceasedDateTime: "2000-06-01" };
    expect(patientAge(deceased, at)).toBe("60 (deceased)");
  });
});

describe("identifiers", () => {
  it("finds the medical record number", () => {
    expect(
      medicalRecordNumber([
        { system: "ssn", value: "999-1" },
        { type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0203", code: "MR" }] }, value: "MRN-42" },
      ]),
    ).toBe("MRN-42");
    expect(medicalRecordNumber(undefined)).toBeUndefined();
  });
});
