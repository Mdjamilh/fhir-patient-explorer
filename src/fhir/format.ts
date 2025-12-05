import type { Address, CodeableConcept, ContactPoint, HumanName, Identifier, Patient, Period, Quantity } from "fhir/r4";

/** Prefer the "official" name, then "usual", then whatever comes first. */
function pickName(names: HumanName[] | undefined): HumanName | undefined {
  if (!names?.length) return undefined;
  return names.find((n) => n.use === "official") ?? names.find((n) => n.use === "usual") ?? names[0];
}

/**
 * "Given Family". Synthetic data often appends digits to names to make
 * them unique ("Jesus365"), which are stripped for display.
 */
export function formatName(names: HumanName[] | undefined): string {
  const name = pickName(names);
  if (!name) return "Unnamed patient";
  if (name.text?.trim()) return name.text.trim();
  const clean = (s: string) => s.replace(/\d+$/, "");
  const parts = [...(name.given ?? []).map(clean), name.family ? clean(name.family) : undefined].filter(Boolean);
  return parts.length ? parts.join(" ") : "Unnamed patient";
}

/** Family name first, for sorted lists: "Smith, Adolph". */
export function formatNameSortable(names: HumanName[] | undefined): string {
  const name = pickName(names);
  const family = name?.family?.replace(/\d+$/, "");
  const given = name?.given?.map((g) => g.replace(/\d+$/, "")).join(" ");
  if (family && given) return `${family}, ${given}`;
  return formatName(names);
}

export function formatAddress(addresses: Address[] | undefined): string | undefined {
  const a = addresses?.find((x) => x.use === "home") ?? addresses?.[0];
  if (!a) return undefined;
  if (a.text?.trim()) return a.text.trim();
  const cityLine = [a.city, [a.state, a.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [...(a.line ?? []), cityLine, a.country].filter(Boolean).join(", ") || undefined;
}

export function formatTelecom(telecom: ContactPoint[] | undefined, system: ContactPoint["system"]): string | undefined {
  return telecom?.find((t) => t.system === system && t.value)?.value;
}

/** The text a clinician would recognise: `text`, else the first coding's display, else its code. */
export function codeableText(concept: CodeableConcept | undefined, fallback = "Unknown"): string {
  if (!concept) return fallback;
  if (concept.text?.trim()) return concept.text.trim();
  const coding = concept.coding?.find((c) => c.display) ?? concept.coding?.[0];
  return coding?.display ?? coding?.code ?? fallback;
}

/** A stable key for grouping by code: "system|code" of the first coding. */
export function codeKey(concept: CodeableConcept | undefined): string {
  const coding = concept?.coding?.[0];
  return coding ? `${coding.system ?? ""}|${coding.code ?? ""}` : `text|${concept?.text ?? ""}`;
}

const UCUM_DISPLAY: Record<string, string> = { "[lb_av]": "lb", "[in_i]": "in", "/min": "/min", "kg/m2": "kg/m²", Cel: "°C" };

export function formatUnit(q: Quantity | undefined): string {
  const unit = q?.unit ?? q?.code ?? "";
  return UCUM_DISPLAY[unit] ?? unit;
}

/** Rounds to a sensible precision for display without losing small lab values. */
export function formatNumber(value: number): string {
  const digits = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
  return Number(value.toFixed(digits)).toLocaleString("en-US");
}

export function formatQuantity(q: Quantity | undefined): string {
  if (q?.value === undefined) return "—";
  const unit = formatUnit(q);
  return `${q.comparator ?? ""}${formatNumber(q.value)}${unit ? ` ${unit}` : ""}`;
}

/**
 * FHIR dates can be partial ("1953", "1953-01") or full date-times. Show
 * only the precision the data has, and never shift a plain date across
 * time zones.
 */
export function formatDate(value: string | undefined, { withTime = false } = {}): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!month) return String(year);
  if (!day) return new Date(Date.UTC(year!, month - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  if (withTime && value.length > 10) {
    return new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  }
  return new Date(Date.UTC(year!, month - 1, day)).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" });
}

export function formatPeriod(period: Period | undefined): string {
  if (!period?.start && !period?.end) return "—";
  if (!period.end) return `${formatDate(period.start)} – ongoing`;
  if (period.start?.slice(0, 10) === period.end.slice(0, 10)) return formatDate(period.start);
  return `${formatDate(period.start)} – ${formatDate(period.end)}`;
}

/** Age in whole years on `at` (or at death, for deceased patients). */
export function ageInYears(birthDate: string | undefined, at: Date = new Date()): number | undefined {
  if (!birthDate) return undefined;
  const [y, m = 1, d = 1] = birthDate.split("-").map(Number);
  let age = at.getUTCFullYear() - y!;
  const beforeBirthday = at.getUTCMonth() + 1 < m || (at.getUTCMonth() + 1 === m && at.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : undefined;
}

export function patientAge(patient: Patient, now = new Date()): string | undefined {
  const deceasedAt = patient.deceasedDateTime ? new Date(patient.deceasedDateTime) : undefined;
  const age = ageInYears(patient.birthDate, deceasedAt ?? now);
  if (age === undefined) return undefined;
  return deceasedAt || patient.deceasedBoolean ? `${age} (deceased)` : String(age);
}

/** The medical record number if the server marks one (identifier type "MR"). */
export function medicalRecordNumber(identifiers: Identifier[] | undefined): string | undefined {
  return identifiers?.find((i) => i.type?.coding?.some((c) => c.code === "MR"))?.value;
}

export function capitalize(value: string | undefined): string {
  return value ? value[0]!.toUpperCase() + value.slice(1) : "—";
}
