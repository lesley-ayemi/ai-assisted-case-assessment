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
  await expect(page.getByRole("heading", { name: "Limitation period" })).toBeVisible();
  await expect(page.getByText(/left to issue a claim|ago$/)).toBeVisible();

  // Upload the documents one at a time, waiting for each to be listed
  const fileInput = page.locator('input[type="file"]');
  for (const name of spec.documents as string[]) {
    await fileInput.setInputFiles(path.join(CASE_DIR, name));
    await expect(page.getByRole("list", { name: "Documents" }).getByText(name)).toBeVisible();
  }

  // Assessment
  await page.getByRole("button", { name: "Run assessment" }).click();
  await expect(page.getByRole("heading", { name: "Evidence readiness" })).toBeVisible();
  await expect(page.getByText(/^\d{1,3}\/100$/)).toBeVisible();

  // The points per element add up to the score shown
  const score = Number((await page.getByText(/^\d{1,3}\/100$/).textContent())!.split("/")[0]);
  const rows = page.getByRole("table").getByRole("row");
  await expect(rows).toHaveCount(7); // header and six elements
  const earned = await rows.evaluateAll((trs) =>
    trs.slice(1).map((tr) => Number(tr.querySelectorAll("td")[2].textContent!.split("/")[0])),
  );
  expect(Math.abs(earned.reduce((a, b) => a + b, 0) - score)).toBeLessThanOrEqual(0.5); // score is rounded
  await expect(page.getByText("Draft: not yet reviewed")).toBeVisible();

  const facts = page.getByRole("list", { name: "Extracted facts" }).getByRole("listitem");
  await expect(facts.first()).toBeVisible();
  expect(await facts.count()).toBe(4); // the rest are behind "Show more"
  await page.getByRole("button", { name: /^Show \d+ more facts?/ }).click();
  expect(await facts.count()).toBeGreaterThanOrEqual(6);
  await page.getByRole("button", { name: "Show fewer" }).click();
  expect(await facts.count()).toBe(4);
  await expect(page.getByText("quote not found in source")).toHaveCount(0);

  // The client's account highlights the passages facts quote from it
  const account = page.locator("section", { has: page.getByRole("heading", { name: "Client's account" }) });
  await expect(account.locator("mark").first()).toBeVisible();

  // Each document can be opened, with the passages facts quote highlighted
  const firstDoc = (spec.documents as string[])[0];
  await page.getByRole("button", { name: `View ${firstDoc}` }).click();
  const viewer = page.getByRole("dialog", { name: firstDoc });
  await expect(viewer).toBeVisible();
  await expect(viewer.locator("mark").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();

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
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByText("Choose a decision first.")).toBeVisible();
  await page.locator("label").filter({ hasText: "Broadly right" }).click(); // the option card
  await expect(page.getByRole("radio", { name: /Approve with amendments/ })).toBeChecked();
  await page.getByRole("button", { name: "Approve with amendments" }).click();
  await expect(page.getByText("Add a note saying what needs correcting.")).toBeVisible();
  await page.getByLabel("Review note").fill("Causation needs client instructions.");
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
  await expect(page.getByText("Breach date unknown")).toBeVisible();
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

test("breach date accepts UK dates, rejects impossible ones and flags limitation", async ({ page }) => {
  await page.goto("/cases/new");
  const date = page.getByLabel("Date of alleged breach");

  await date.fill("31/02/2025");
  await expect(page.getByText("Enter a date like 12/09/2025")).toBeVisible();
  await page.getByLabel("Title").fill("Date check");
  await page.getByLabel("Client", { exact: true }).fill("A Ltd");
  await page.getByLabel("Counterparty").fill("B Ltd");
  await page.getByLabel("What happened?").fill("Testing the date field.");
  await page.getByRole("button", { name: "Create case" }).click();
  await expect(page).toHaveURL(/\/cases\/new$/); // invalid date blocks submission

  await date.fill("1/3/2019");
  await date.blur();
  await expect(date).toHaveValue("01/03/2019");
  await expect(page.getByText("Limitation period ended on 1 March 2025")).toBeVisible();

  await page.getByRole("button", { name: "Choose date from calendar" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(date).toHaveValue("");
});

test("several documents upload at once, and a bad one doesn't stop the rest", async ({ page, request }) => {
  const res = await request.post("http://localhost:8010/cases", {
    data: {
      title: "Batch upload", client_name: "A Ltd", counterparty: "B Ltd",
      description: "Test case for batch upload.", breach_date: null,
    },
  });
  const { id } = await res.json();

  await page.goto(`/cases/${id}`);
  await page.getByLabel("Upload documents").setInputFiles([
    ...(spec.documents as string[]).map((name) => ({
      name, mimeType: "text/plain", buffer: readFileSync(path.join(CASE_DIR, name)),
    })),
    { name: "photo.png", mimeType: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
  ]);

  const docs = page.getByRole("list", { name: "Documents" });
  for (const name of spec.documents as string[]) await expect(docs.getByText(name)).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "isn't supported" })).toBeVisible();
  await page.getByRole("button", { name: "Dismiss photo.png" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "isn't supported" })).toHaveCount(0);
});

test("questions for the solicitor can be ticked off and stay ticked", async ({ page, request }) => {
  const res = await request.post("http://localhost:8010/cases", {
    data: {
      title: "Questions check", client_name: "A Ltd", counterparty: "B Ltd",
      description: "They did not pay for the work we did.", breach_date: null,
    },
  });
  const { id } = await res.json();
  await request.post(`http://localhost:8010/cases/${id}/assessments`);

  await page.goto(`/cases/${id}`);
  const list = page.getByRole("list", { name: "Questions for the solicitor" });
  const total = await list.getByRole("listitem").count();
  expect(total).toBeGreaterThan(1);
  await expect(page.getByText(`${total} open`)).toBeVisible();

  await list.getByRole("listitem").first().click();
  await expect(list.getByRole("checkbox").first()).toBeChecked();
  await expect(page.getByText(`${total - 1} open`)).toBeVisible();

  await page.reload();
  await expect(page.getByRole("list", { name: "Questions for the solicitor" }).getByRole("checkbox").first()).toBeChecked();
});
