import { readFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { mockFhirServer, PATIENT_ID, SERVER } from "./fhir-server";

test.beforeEach(async ({ page }) => {
  await mockFhirServer(page);
});

test("search for a patient and open their record", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/r4\.smarthealthit\.org/)).toBeVisible();

  await page.getByLabel("Name").fill("smith");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\?name=smith$/);

  await page.getByRole("link", { name: "Smitham, Jesus" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Jesus Smitham" })).toBeVisible();
  await expect(page).toHaveTitle("Jesus Smitham · FHIR Patient Explorer");

  const conditions = page.getByRole("region", { name: /Active conditions/ });
  await expect(conditions.getByText("Hypertension")).toBeVisible();
  await expect(page.getByRole("region", { name: /Current medications/ }).getByText("Hydrochlorothiazide 25 MG")).toBeVisible();
  await expect(page.getByText("Blood pressure")).toBeVisible();

  await page.getByRole("link", { name: "← Back to search" }).click();
  await expect(page).toHaveURL(/\?name=smith$/);
  await expect(page.getByLabel("Name")).toHaveValue("smith");
});

test("lab trends with a chart and a readings table", async ({ page }) => {
  await page.goto(`/patients/${PATIENT_ID}/labs`);
  const tests = page.getByRole("list", { name: "Tests" });
  await tests.getByRole("button", { name: /^Glucose/ }).click();

  const panel = page.getByRole("region", { name: "Glucose" });
  await expect(panel.getByRole("img", { name: /Chart of Glucose/ })).toBeVisible();
  await expect(panel.locator(".recharts-line-dot, circle").first()).toBeVisible();
  expect(await panel.getByRole("row").count()).toBeGreaterThan(2);

  // The selected test is part of the URL, so it survives a reload.
  await page.reload();
  await expect(page.getByRole("region", { name: "Glucose" })).toBeVisible();

  await page.getByRole("button", { name: "Vital signs" }).click();
  await expect(tests.getByRole("button", { name: /^Glucose/ })).toHaveCount(0);
  await page.getByLabel("Filter tests by name").fill("weight");
  await expect(tests.getByRole("listitem")).toHaveCount(1);
});

test("every tab of the record renders", async ({ page }) => {
  await page.goto(`/patients/${PATIENT_ID}`);
  const tabs: [string, RegExp | string][] = [
    ["Conditions", "Hypertension"],
    ["Medications", "Hydrochlorothiazide 25 MG"],
    ["Visits", /Encounter for check up/],
    ["Immunizations", /Influenza/],
  ];
  for (const [tab, text] of tabs) {
    await page.getByRole("navigation", { name: "Patient record" }).getByRole("link", { name: tab }).click();
    await expect(page.getByText(text).first()).toBeVisible();
  }
});

test("download the record as a FHIR Bundle", async ({ page }) => {
  await page.goto(`/patients/${PATIENT_ID}/data`);
  const button = page.getByRole("button", { name: /Download FHIR Bundle/ });
  await expect(button).toBeEnabled();
  const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
  expect(download.suggestedFilename()).toBe("jesus-smitham-bundle.json");

  const bundle = JSON.parse(readFileSync(await download.path(), "utf8"));
  expect(bundle.resourceType).toBe("Bundle");
  expect(bundle.type).toBe("collection");
  expect(bundle.entry[0].fullUrl).toBe(`${SERVER}/Patient/${PATIENT_ID}`);
  expect(bundle.entry.length).toBeGreaterThan(100);
});

test("unreachable servers explain what to check", async ({ page }) => {
  await page.route("https://offline.test/**", (route) => route.abort());
  await page.goto("/server");
  await page.getByLabel("FHIR base URL").fill("https://offline.test/fhir");
  await page.getByRole("button", { name: "Connect" }).click();
  await expect(page.getByRole("alert")).toContainText("allows browser (CORS) requests");
  await expect(page.getByText(/r4\.smarthealthit\.org/).first()).toBeVisible();
});

for (const [name, path] of [
  ["search", "/"],
  ["summary", `/patients/${PATIENT_ID}`],
  ["labs", `/patients/${PATIENT_ID}/labs`],
  ["server", "/server"],
]) {
  test(`${name} page has no detectable accessibility violations`, async ({ page }) => {
    await page.goto(path!);
    await expect(page.getByRole("status")).toHaveCount(0); // wait for loading skeletons to finish
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
}
