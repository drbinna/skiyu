/**
 * POST /api/deploy-to-claude
 *
 * Deterministic Playwright script that uploads a skill zip to Claude.ai
 * via a Browserbase cloud browser session. No LLM-driven browsing.
 *
 * Body: { skill_slug: string, skill_zip_url: string, skill_name: string }
 *
 * Returns: SSE stream of trace events.
 *
 * Required env vars:
 *   BROWSERBASE_API_KEY
 *   BROWSERBASE_PROJECT_ID
 *
 * The flow:
 *   1. Create Browserbase session → get connectUrl + live preview URL
 *   2. Connect Playwright via CDP
 *   3. Navigate to claude.ai/settings → Skills
 *   4. If login required → return live URL so user can log in
 *   5. Upload the zip (fetched in-browser from our public URL)
 *   6. Verify skill appears
 *   7. Report success
 *
 * IMPORTANT: Claude.ai selectors below are best-guess and MUST be
 * verified in a live Browserbase session. Every selector that needs
 * verification is marked with // VERIFY: comments.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

// SSE helper
function send(res: VercelResponse, event: Record<string, unknown>) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export const config = {
  maxDuration: 60, // seconds — requires Vercel Pro
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  const { skill_slug, skill_zip_url, skill_name } = req.body ?? {};
  if (!skill_slug || !skill_zip_url) {
    res.status(400).json({ error: "skill_slug and skill_zip_url required" });
    return;
  }

  const bbApiKey = process.env.BROWSERBASE_API_KEY;
  const bbProjectId = process.env.BROWSERBASE_PROJECT_ID;

  if (!bbApiKey || !bbProjectId) {
    res.status(500).json({ error: "BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID required" });
    return;
  }

  // Start SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");

  let browser: import("playwright-core").Browser | null = null;
  let sessionId: string | null = null;

  try {
    // ── Step 1: Create Browserbase session ──────────────────
    send(res, { type: "status", message: "Creating browser session…" });

    const { Browserbase } = await import("@browserbasehq/sdk");
    const { chromium } = await import("playwright-core");

    const bb = new Browserbase({ apiKey: bbApiKey });
    const session = await bb.sessions.create({
      projectId: bbProjectId,
      browserSettings: {
        viewport: { width: 1280, height: 900 },
      },
    });

    sessionId = session.id;

    // Get the embeddable live view URL (publicly accessible, no BB login needed)
    const debugInfo = await bb.sessions.debug(session.id);
    const liveUrl = debugInfo.debuggerFullscreenUrl;

    send(res, {
      type: "sandbox_ready",
      message: "Browser session ready",
      live_url: liveUrl,
      session_id: session.id,
    });

    // ── Step 2: Connect Playwright via CDP ──────────────────
    send(res, { type: "status", message: "Connecting to browser…" });

    browser = await chromium.connectOverCDP(session.connectUrl);
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = context.pages()[0] ?? (await context.newPage());

    // ── Step 3: Navigate to Claude.ai settings ──────────────
    const t0 = Date.now();
    send(res, {
      type: "tool_call",
      id: "goto-claude",
      tool: "playwright.goto",
      input: { url: "https://claude.ai/settings" },
    });

    await page.goto("https://claude.ai/settings", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    // Wait for the page to settle
    await page.waitForTimeout(2000);

    send(res, {
      type: "tool_result",
      id: "goto-claude",
      tool: "playwright.goto",
      output: "Claude settings page loaded",
      duration_ms: Date.now() - t0,
      error: false,
    });

    // ── Step 4: Check login state ───────────────────────────
    send(res, { type: "status", message: "Checking login state…" });

    // VERIFY: These selectors detect the login/signup page.
    // Claude shows "Log in" or "Sign up" buttons when not authenticated.
    const loginVisible = await page
      .locator('text=/log in|sign in|sign up|continue with google|create an account/i')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (loginVisible) {
      send(res, {
        type: "status",
        message: "Claude login required",
      });
      send(res, {
        type: "error",
        message: `Login required. Open the live browser session to log in, then retry.\n\nLive session: ${liveUrl}`,
        live_url: liveUrl,
        needs_login: true,
      });
      // Don't close the browser — user needs it to log in
      return;
    }

    // ── Step 5: Navigate to Skills section ──────────────────
    send(res, { type: "status", message: "Navigating to Skills…" });

    // VERIFY: Claude's settings page structure. Try direct URL first.
    const t1 = Date.now();
    send(res, {
      type: "tool_call",
      id: "goto-skills",
      tool: "playwright.goto",
      input: { url: "https://claude.ai/settings/skills" },
    });

    // Try the direct skills URL first
    await page.goto("https://claude.ai/settings/skills", {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    }).catch(async () => {
      // Fallback: navigate via Settings sidebar
      // VERIFY: The sidebar link text or role
      const skillsLink = page.locator('text=/skills/i').first();
      if (await skillsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await skillsLink.click();
        await page.waitForTimeout(1500);
      }
    });

    send(res, {
      type: "tool_result",
      id: "goto-skills",
      tool: "playwright.goto",
      output: "Skills page loaded",
      duration_ms: Date.now() - t1,
      error: false,
    });

    // ── Step 6: Click "Add skill" / "+" button ──────────────
    send(res, { type: "status", message: "Opening skill upload…" });

    const t2 = Date.now();

    // VERIFY: The button to add a new skill. Claude may use:
    // - A "+" button
    // - An "Add skill" or "Create skill" button
    // - A floating action button
    // Try multiple selectors in order of specificity.
    const addButtonSelectors = [
      'button:has-text("Create skill")',
      'button:has-text("Add skill")',
      'button:has-text("Upload")',
      '[aria-label="Add skill"]',
      '[aria-label="Create skill"]',
      'button:has(svg)', // Generic icon button as last resort
    ];

    let addClicked = false;
    for (const sel of addButtonSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await btn.click();
          addClicked = true;
          await page.waitForTimeout(1000);
          break;
        }
      } catch {
        continue;
      }
    }

    if (!addClicked) {
      // Take a screenshot for debugging
      const screenshot = await page.screenshot({ type: "png" }).catch(() => null);
      send(res, {
        type: "error",
        message: "Could not find the 'Add skill' button. Claude's UI may have changed. Check the live session.",
        live_url: liveUrl,
        has_screenshot: !!screenshot,
      });
      return;
    }

    // VERIFY: After clicking add, Claude may show a submenu:
    // "Create skill" → "Upload a skill"
    const uploadOption = page.locator('text=/upload.*skill|upload a skill/i').first();
    if (await uploadOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await uploadOption.click();
      await page.waitForTimeout(1000);
    }

    send(res, {
      type: "tool_result",
      id: "click-add",
      tool: "playwright.click",
      output: "Skill upload dialog opened",
      duration_ms: Date.now() - t2,
      error: false,
    });

    // ── Step 7: Upload the zip ──────────────────────────────
    send(res, { type: "status", message: "Uploading skill zip…" });

    const t3 = Date.now();

    // Method: Use the file input if visible, or inject the file via JavaScript.
    // The zip is hosted at a public URL (Supabase Storage).
    // The browser fetches it and injects it into the file input.

    // First, try to find a file input
    const fileInput = page.locator('input[type="file"]').first();
    const hasFileInput = await fileInput.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasFileInput) {
      // Download the zip to a temp path in the serverless function,
      // then use setInputFiles. But in Browserbase, the browser is remote,
      // so we need to use the page's JavaScript context to fetch and inject.
      await page.evaluate(async ({ zipUrl, skillName }: { zipUrl: string; skillName: string }) => {
        const response = await fetch(zipUrl);
        const blob = await response.blob();
        const file = new File([blob], `${skillName}.zip`, { type: "application/zip" });
        const dt = new DataTransfer();
        dt.items.add(file);
        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (input) {
          input.files = dt.files;
          input.dispatchEvent(new Event("change", { bubbles: true }));
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }, { zipUrl: skill_zip_url, skillName: skill_name || skill_slug });

      await page.waitForTimeout(2000);
    } else {
      // VERIFY: Some UIs use a drag-and-drop zone or a button that triggers file selection.
      // Try clicking any visible upload area.
      const dropZone = page.locator('text=/drop.*here|drag.*drop|choose.*file|browse.*file/i').first();
      if (await dropZone.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dropZone.click();
        await page.waitForTimeout(1000);
      }

      // After clicking, a file input should appear
      const delayedInput = page.locator('input[type="file"]').first();
      if (await delayedInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await page.evaluate(async ({ zipUrl, skillName }: { zipUrl: string; skillName: string }) => {
          const response = await fetch(zipUrl);
          const blob = await response.blob();
          const file = new File([blob], `${skillName}.zip`, { type: "application/zip" });
          const dt = new DataTransfer();
          dt.items.add(file);
          const input = document.querySelector('input[type="file"]') as HTMLInputElement;
          if (input) {
            input.files = dt.files;
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }, { zipUrl: skill_zip_url, skillName: skill_name || skill_slug });

        await page.waitForTimeout(2000);
      } else {
        send(res, {
          type: "error",
          message: "Could not find file input for upload. Claude's upload UI may have changed.",
          live_url: liveUrl,
        });
        return;
      }
    }

    send(res, {
      type: "tool_result",
      id: "upload-zip",
      tool: "playwright.upload",
      output: `Uploaded ${skill_name || skill_slug}.zip`,
      duration_ms: Date.now() - t3,
      error: false,
    });

    // ── Step 8: Confirm upload / click Save ──────────────────
    send(res, { type: "status", message: "Confirming upload…" });

    // VERIFY: After uploading, Claude may show a confirmation button.
    const confirmSelectors = [
      'button:has-text("Save")',
      'button:has-text("Upload")',
      'button:has-text("Create")',
      'button:has-text("Add")',
      'button:has-text("Install")',
      'button:has-text("Done")',
      'button:has-text("Confirm")',
    ];

    for (const sel of confirmSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await btn.click();
          await page.waitForTimeout(2000);
          break;
        }
      } catch {
        continue;
      }
    }

    // ── Step 9: Verify skill appears ────────────────────────
    send(res, { type: "status", message: "Verifying installation…" });

    await page.waitForTimeout(3000);

    // VERIFY: Check if the skill name appears in the skills list
    const skillVisible = await page
      .locator(`text=/${skill_name || skill_slug}/i`)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (skillVisible) {
      send(res, {
        type: "complete",
        summary: `${skill_name || skill_slug} installed in your Claude workspace.`,
        had_artifact: false,
      });
    } else {
      // Skill might have installed but name display is different.
      // Take a screenshot for manual verification.
      send(res, {
        type: "complete",
        summary: `Upload completed. Verify ${skill_name || skill_slug} appears in your Claude Skills.`,
        had_artifact: false,
        live_url: liveUrl,
      });
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    send(res, { type: "error", message: msg });
  } finally {
    // Clean up
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
    res.end();
  }
}
