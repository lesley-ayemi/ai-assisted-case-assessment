import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

// Eval case 04: a buyer rejecting cracked worktops. Documents are uploaded from the eval set.
const CASE_DIR = path.resolve(__dirname, "../../evals/cases/04-defective-worktops");
const spec = JSON.parse(readFileSync(path.join(CASE_DIR, "case.json"), "utf8"));

test("solicitor takes a case from intake to approved PDF report", async ({ page }) => {
  // Intake
  await page.goto("/");
  await page.getByRole("link", { name: "Open the demo" }).first().click();
  await expect(page).toHaveURL(/\/cases$/);
  await page.getByRole("main").getByRole("link", { name: "New case" }).first().click();
  await page.getByLabel("Title").fill(spec.title);
  await page.getByLabel("Client").fill(spec.client_name);
  await page.getByLabel("Counterparty").fill(spec.counterparty);
  await page.getByLabel("Date of alleged breach").fill(spec.breach_date);
  await page.getByLabel("What happened?").fill(spec.description);
  await page.getByRole("button", { name: "Create case" }).click();

  await expect(page).toHaveURL(/\/cases\/\d+$/);
  await expect(page.getByRole("heading", { name: spec.title })).toBeVisible();
  await expect(page.getByText("None uploaded yet.")).toBeVisible();

  // Upload the documents one at a time, waiting for each to be listed
  const fileInput = page.locator('input[type="file"]');
  for (const name of spec.documents as string[]) {
    await fileInput.setInputFiles(path.join(CASE_DIR, name));
    await expect(page.getByRole("listitem").filter({ hasText: name })).toBeVisible();
  }

  // Assessment
  await page.getByRole("button", { name: "Run assessment" }).click();
  await expect(page.getByRole("heading", { name: "Evidence readiness" })).toBeVisible();
  await expect(page.getByText(/^\d{1,3}\/100$/)).toBeVisible();
  await expect(page.getByText("Draft: not yet reviewed")).toBeVisible();

  const facts = page.getByRole("list", { name: "Extracted facts" }).getByRole("listitem");
  await expect(facts.first()).toBeVisible();
  expect(await facts.count()).toBeGreaterThanOrEqual(6);
  await expect(page.getByText("quote not found in source")).toHaveCount(0);

  // Retrieved legislation is cited and verified against the statute text
  await expect(page.getByRole("link", { name: "Sale of Goods Act 1979, s.14" }).first()).toBeVisible();
  await expect(page.getByText("verified against statute text").first()).toBeVisible();

  // Limitation Act s.5 is applied by rule, not retrieved
  await page.getByText(/Provisions considered/).click();
  await expect(page.getByText("applied by the limitation check")).toBeVisible();

  // PDF report downloads with a descriptive filename
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Download PDF report" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^assessment-\d+-cracked-quartz-worktops\.pdf$/);
  const pdf = readFileSync(await download.path());
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");

  // Solicitor review closes the loop
  await page.getByPlaceholder("Review note (optional)").fill("Causation needs client instructions.");
  await page.getByRole("button", { name: "Approve with amendments" }).click();
  await expect(page.getByText("“Causation needs client instructions.”")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve with amendments" })).toHaveCount(0);

  // The case list reflects the review
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Cases" }).click();
  const row = page.getByRole("row").filter({ hasText: spec.title });
  await expect(row).toContainText("Reviewed");
});

test("unsupported uploads are rejected with a clear message", async ({ page, request }) => {
  const res = await request.post("http://localhost:8010/cases", {
    data: {
      title: "Upload check", client_name: "A Ltd", counterparty: "B Ltd",
      description: "Test case for upload validation.", breach_date: null,
    },
  });
  const { id } = await res.json();

  await page.goto(`/cases/${id}`);
  await page.locator('input[type="file"]').setInputFiles({
    name: "photo.png", mimeType: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  });
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toBeVisible();
  await expect(page.getByText("None uploaded yet.")).toBeVisible();
});

test("legislation search finds the Late Payment Act for an unpaid invoice", async ({ page }) => {
  await page.goto("/legislation");
  await page.getByRole("button", { name: "customer has not paid our invoice" }).click();
  await expect(
    page.getByText(/Late Payment of Commercial Debts \(Interest\) Act 1998/).first(),
  ).toBeVisible();
});
