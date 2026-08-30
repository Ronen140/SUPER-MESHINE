import { chromium } from "playwright";

const SCRATCHPAD = "/tmp/claude-0/-home-user-SUPER-MESHINE/162147e1-1576-57ff-a249-8b10298ea94b/scratchpad";
const BASE = "http://localhost:3000";

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: [
    "--disable-features=PasswordLeakDetection,AutofillServerCommunication,PasswordManagerOnboarding,PasswordChangeDetection",
    "--disable-save-password-bubble",
  ],
});

const consoleMessages = [];

async function newPage() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
  page.on("console", (msg) => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
  page.on("pageerror", (err) => consoleMessages.push(`[pageerror] ${err.message}`));
  return page;
}

// ---- 1. Preview page, initial: 3 switcher states + empty form ----
{
  const page = await newPage();
  await page.goto(`${BASE}/dev-preview-f3-f4`, { waitUntil: "networkidle" });
  const htmlDir = await page.getAttribute("html", "dir");
  console.log("PREVIEW PAGE: html dir=", htmlDir);
  await page.screenshot({ path: `${SCRATCHPAD}/f3f4-switcher-states.png`, fullPage: true });
  await page.close();
}

// ---- 2. Open the 2-business dropdown and screenshot it open ----
{
  const page = await newPage();
  await page.goto(`${BASE}/dev-preview-f3-f4`, { waitUntil: "networkidle" });
  const trigger = page.getByRole("button", { name: "בחירת עסק פעיל" });
  await trigger.click();
  await page.waitForSelector('[role="menu"]');
  console.log("SWITCHER DROPDOWN items:", await page.locator('[role="menuitem"]').allTextContents());
  await page.screenshot({ path: `${SCRATCHPAD}/f3f4-switcher-dropdown-open.png`, fullPage: true });
  await page.close();
}

// ---- 3. Business form: empty submit -> validation errors ----
{
  const page = await newPage();
  await page.goto(`${BASE}/dev-preview-f3-f4`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "יצירת עסק" }).click();
  await page.waitForSelector('[role="alert"]');
  console.log(
    "BUSINESS FORM EMPTY SUBMIT alerts:",
    await page.locator('[role="alert"]').allTextContents(),
  );
  await page.screenshot({ path: `${SCRATCHPAD}/f3f4-business-form-validation.png`, fullPage: true });
  await page.close();
}

// ---- 4. Business form: filled + entity_type selection + address section ----
{
  const page = await newPage();
  await page.goto(`${BASE}/dev-preview-f3-f4`, { waitUntil: "networkidle" });
  await page.getByLabel("שם חוקי של העסק").pressSequentially('רונן דורמן בע"מ');
  await page.getByRole("radio", { name: /עוסק מורשה/ }).check();
  await page.getByLabel("מספר עוסק / ח.פ").pressSequentially("123456789");
  await page.getByLabel("רחוב ומספר (אופציונלי)").pressSequentially("הרצל 1");
  await page.getByLabel("עיר (אופציונלי)").pressSequentially("תל אביב");
  await page.screenshot({ path: `${SCRATCHPAD}/f3f4-business-form-filled.png`, fullPage: true });

  // No live Supabase — submitting hits the real /api/businesses route, which will
  // fail reaching the fake project URL. Confirms the error path renders in Hebrew
  // instead of failing silently (same class of check as prior F1/F2 rounds).
  await page.getByRole("button", { name: "יצירת עסק" }).click();
  await page.waitForSelector('[role="alert"]', { timeout: 15000 });
  console.log(
    "BUSINESS FORM SUBMIT (no live Supabase) alerts:",
    await page.locator('[role="alert"]').allTextContents(),
  );
  await page.screenshot({ path: `${SCRATCHPAD}/f3f4-business-form-submit-error.png`, fullPage: true });
  await page.close();
}

console.log("\n--- CONSOLE / PAGE ERRORS COLLECTED ---");
console.log(consoleMessages.length ? consoleMessages.join("\n") : "(none)");

await browser.close();
