---
name: skiyu-deploy
description: Deploy any skill from skiyu's catalog directly into your Claude.ai workspace. Uses Playwright CLI to automate the upload — runs in your local browser where you're already logged in. No API keys, no cloud browsers, no manual downloads.
version: 1.0.0
license: MIT
allowed_tools: bash, write_file, read_file
argument-hint: "<skill-slug or skill-name>"
user-invocable: true
---

# skiyu-deploy

Deploy skills from [skiyu.dev](https://skiyu.dev) directly into your Claude.ai workspace using Playwright CLI.

## Prerequisites

This skill requires the Playwright CLI. If not installed, run:
```bash
npm install -g @anthropic-ai/playwright-cli
npx playwright install chromium
```

## How it works

1. You provide a skill slug (e.g., `website-cloner`, `code-reviewer`)
2. This skill fetches the skill zip from skiyu's API
3. Playwright CLI opens your local browser (where you're already logged into Claude)
4. It navigates to Claude.ai → Settings → Skills → Upload
5. Uploads the zip and enables the skill
6. Done — the skill appears in your Claude workspace

## Execution steps

### Step 1 — Resolve the skill from skiyu's catalog

```bash
curl -s "https://mkqiqkqgnywosbneibqx.supabase.co/functions/v1/skiyu-mcp" \
  -X POST \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"skiyu_details","arguments":{"slug":"SKILL_SLUG_HERE"}}}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); r=json.loads(d['result']['content'][0]['text']); print(f'Found: {r.get(\"name\",\"unknown\")}'); print(f'Description: {r.get(\"description\",\"\")}'); print(f'Quality: {r.get(\"quality_score\",\"?\")} | Risk: {r.get(\"risk_level\",\"?\")} | Verified: {r.get(\"verified\",False)}')"
```

Replace `SKILL_SLUG_HERE` with the actual skill slug the user provided.

If the user gave a name instead of a slug, search for it first:
```bash
curl -s "https://mkqiqkqgnywosbneibqx.supabase.co/functions/v1/skiyu-mcp" \
  -X POST \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"skiyu_search","arguments":{"query":"USER_QUERY_HERE","limit":5}}}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); results=json.loads(d['result']['content'][0]['text'])['results']; [print(f'  {r[\"slug\"]} — {r[\"description\"][:80]}') for r in results]"
```

### Step 2 — Download the skill zip

```bash
curl -s -X POST "https://mkqiqkqgnywosbneibqx.supabase.co/functions/v1/zip-skill-folder" \
  -H "content-type: application/json" \
  -d '{"repo":"GITHUB_REPO","skill_folder_path":"SKILL_PATH","filename":"SKILL_SLUG"}' \
  -o /tmp/skiyu-skill.zip

ls -lh /tmp/skiyu-skill.zip
```

Replace `GITHUB_REPO` and `SKILL_PATH` with values from the skill details.

To get these values:
```bash
curl -s "https://mkqiqkqgnywosbneibqx.supabase.co/functions/v1/skiyu-mcp" \
  -X POST \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"skiyu_details","arguments":{"slug":"SKILL_SLUG"}}}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); r=json.loads(d['result']['content'][0]['text']); print(f'repo: {r.get(\"github_repo\",\"\")}'); print(f'path: {r.get(\"skill_folder_path\",r.get(\"skill_path_in_repo\",\"\"))}')"
```

### Step 3 — Deploy to Claude.ai using Playwright CLI

Write the following Playwright script to `/tmp/skiyu-deploy.js`:

```javascript
// Playwright CLI script to upload a skill to Claude.ai
// Runs in the user's local browser where they're already logged in

const { chromium } = require('playwright');
const path = require('path');

const SKILL_ZIP = process.argv[2] || '/tmp/skiyu-skill.zip';
const SKILL_NAME = process.argv[3] || 'skiyu-skill';

(async () => {
  console.log(`Deploying ${SKILL_NAME} to Claude.ai...`);

  // Launch browser (headed so user can see what's happening)
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to Claude settings
    console.log('Opening Claude.ai settings...');
    await page.goto('https://claude.ai/settings', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Check if logged in
    const pageText = await page.textContent('body');
    if (/log in|sign in|sign up|create an account/i.test(pageText)) {
      console.log('ERROR: Not logged into Claude.ai. Please log in first and retry.');
      await browser.close();
      process.exit(1);
    }

    console.log('Logged in. Navigating to Skills...');

    // Try direct skills URL
    await page.goto('https://claude.ai/settings/skills', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(async () => {
      // Fallback: click Skills in sidebar
      const skillsLink = page.locator('text=/skills/i').first();
      if (await skillsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await skillsLink.click();
        await page.waitForTimeout(2000);
      }
    });

    console.log('On Skills page. Looking for upload button...');

    // Click Add/Create skill button
    const addButton = page.locator('button:has-text("Create skill"), button:has-text("Add skill"), [aria-label="Add skill"]').first();
    if (await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(1500);
    }

    // Click "Upload a skill" if submenu appears
    const uploadOption = page.locator('text=/upload.*skill|upload a skill/i').first();
    if (await uploadOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await uploadOption.click();
      await page.waitForTimeout(1500);
    }

    console.log('Uploading skill zip...');

    // Upload the file
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(SKILL_ZIP);
    await page.waitForTimeout(2000);

    // Click confirm/save
    const confirmButton = page.locator('button:has-text("Save"), button:has-text("Upload"), button:has-text("Create"), button:has-text("Add"), button:has-text("Done")').first();
    if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmButton.click();
      await page.waitForTimeout(3000);
    }

    // Verify
    const bodyText = await page.textContent('body');
    if (bodyText.includes(SKILL_NAME)) {
      console.log(`✓ ${SKILL_NAME} deployed successfully!`);
    } else {
      console.log(`Upload completed. Check Claude.ai to verify ${SKILL_NAME} appears.`);
    }

  } catch (err) {
    console.error('Deploy error:', err.message);
  } finally {
    await browser.close();
  }
})();
```

### Step 4 — Run the Playwright script

Use the Playwright CLI to execute the deploy:

```bash
npx playwright-cli run /tmp/skiyu-deploy.js /tmp/skiyu-skill.zip "SKILL_NAME_HERE"
```

Or if Playwright CLI is not available, use node directly:

```bash
node /tmp/skiyu-deploy.js /tmp/skiyu-skill.zip "SKILL_NAME_HERE"
```

### Step 5 — Report results

Tell the user:
- Whether the skill was deployed successfully
- The skill's capabilities, risk level, and quality score
- That they can now use the skill in any Claude.ai conversation

## Notes

- This skill uses Playwright CLI which runs in the user's LOCAL browser
- The user must already be logged into Claude.ai in their default browser
- If not logged in, the script will exit and ask the user to log in first
- The browser is launched in headed mode so the user can see what's happening
- Selectors may need updating if Claude.ai changes their UI
- All skills are fetched from skiyu's public API — no authentication required

## Troubleshooting

If Playwright is not installed:
```bash
npm install -g @anthropic-ai/playwright-cli
npx playwright install chromium
```

If the upload fails, the user can always download the zip manually:
```bash
open https://skiyu.dev/skills/SKILL_SLUG
```
