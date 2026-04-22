#!/usr/bin/env node
/**
 * /skiyu — Seed skills from known directory repos
 *
 * Walks the GitHub API for each configured source repo, extracts every
 * SKILL.md file it can find, parses the YAML frontmatter, and upserts
 * the result into Supabase.
 *
 * Usage:
 *   node scripts/seed-from-registries.mjs --dry-run       # preview what would ingest
 *   node scripts/seed-from-registries.mjs --source=all    # ingest everything
 *   node scripts/seed-from-registries.mjs --source=anthropics-skills   # single source
 *   node scripts/seed-from-registries.mjs --limit=100     # cap ingest for testing
 *
 * Requires:
 *   GITHUB_TOKEN env var (5K req/hr) — create at github.com/settings/tokens (public_repo scope)
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY env vars
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const GH_TOKEN = process.env.GITHUB_TOKEN;
const SB_URL = process.env.SUPABASE_URL || "https://mkqiqkqgnywosbneibqx.supabase.co";
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!GH_TOKEN) {
  console.error("✗ Missing GITHUB_TOKEN env var. Create one at https://github.com/settings/tokens (public_repo scope only).");
  process.exit(1);
}
if (!SB_KEY) {
  console.error("✗ Missing SUPABASE_SERVICE_KEY env var. Get it from https://supabase.com/dashboard/project/mkqiqkqgnywosbneibqx/settings/api");
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);

const DRY_RUN = args["dry-run"] === true;
const LIMIT = args.limit ? parseInt(args.limit) : Infinity;
const SOURCE_FILTER = args.source || "all";

const supabase = createClient(SB_URL, SB_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Configured sources ────────────────────────────────────────────
// Each source is a public GitHub repo containing SKILL.md files in
// subfolders. Counts below are empirical (verified April 2026):
//   jeremylongshore: 4,632 · mukul975: 754 · alirezarezvani: 540
//   anthropics: 18 · wondelai: 42
// Total: ~5,986 real skills from these 5 sources alone.
//
// NOTE: VoltAgent/awesome-agent-skills is a README-only awesome list
// that points to external repos — it needs a separate README-parsing
// scraper. Not included here.

const SOURCES = [
  {
    slug: "anthropics-skills",
    owner: "anthropics",
    repo: "skills",
    description: "Official Anthropic skill examples (18 skills)",
    priority: 10,
  },
  {
    slug: "jeremylongshore-plugins",
    owner: "jeremylongshore",
    repo: "claude-code-plugins-plus-skills",
    description: "340 plugins + 4,632 agent skills",
    priority: 9,
  },
  {
    slug: "mukul975-cybersecurity",
    owner: "mukul975",
    repo: "Anthropic-Cybersecurity-Skills",
    description: "754 cybersecurity skills across 26 domains",
    priority: 8,
  },
  {
    slug: "alirezarezvani-skills",
    owner: "alirezarezvani",
    repo: "claude-skills",
    description: "540 engineering, marketing, product skills",
    priority: 8,
  },
  {
    slug: "wondelai-skills",
    owner: "wondelai",
    repo: "skills",
    description: "42 product strategy, UX, marketing skills",
    priority: 7,
  },
];

// ─── Category keyword map ──────────────────────────────────────────
// Rough auto-classifier. We'll score each keyword hit and take the top.
const CATEGORY_KEYWORDS = {
  backend: ["api", "rest", "graphql", "server", "backend", "endpoint", "microservice", "grpc"],
  frontend: ["react", "vue", "svelte", "component", "ui", "frontend", "css", "tailwind", "nextjs", "angular"],
  mobile: ["ios", "android", "react-native", "flutter", "expo", "mobile", "swift", "kotlin"],
  database: ["sql", "postgres", "mysql", "database", "query", "schema", "orm", "sqlite", "redis", "mongodb"],
  testing: ["test", "jest", "pytest", "playwright", "cypress", "qa", "unit-test", "integration-test", "coverage"],
  devops: ["docker", "kubernetes", "k8s", "terraform", "ci", "cd", "deploy", "ansible", "github-actions", "pipeline"],
  security: ["security", "pentest", "vulnerability", "auth", "oauth", "encryption", "mitre", "vuln", "cve", "owasp"],
  data: ["etl", "pandas", "analytics", "dataframe", "pipeline", "airflow", "dagster", "dbt", "bigquery", "warehouse"],
  "ai-ml": ["llm", "ml", "model", "training", "fine-tune", "embedding", "rag", "langchain", "mcp", "agent"],
  browser: ["browser", "puppeteer", "playwright", "selenium", "scraping", "web-scraping", "headless"],
  documents: ["pdf", "docx", "word", "excel", "xlsx", "pptx", "document", "resume", "letter", "report"],
  media: ["image", "video", "audio", "design", "art", "illustration", "canvas", "remotion", "animation"],
  marketing: ["seo", "marketing", "copy", "brand", "social", "email-marketing", "cro", "storybrand", "ads"],
  enterprise: ["legal", "contract", "compliance", "hr", "finance", "accounting", "invoice", "crm", "erp"],
  agents: ["agent", "workflow", "orchestration", "skill-creator", "meta", "builder"],
  research: ["research", "paper", "arxiv", "citation", "literature", "academic", "summarize", "analyze"],
};

// ─── Helpers ───────────────────────────────────────────────────────

const slugify = (s) =>
  s.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);

async function gh(endpoint) {
  const res = await fetch(`https://api.github.com${endpoint}`, {
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "skiyu-scraper/1.0",
    },
  });
  if (!res.ok) {
    if (res.status === 403) {
      const remaining = res.headers.get("x-ratelimit-remaining");
      const resetTs = res.headers.get("x-ratelimit-reset");
      throw new Error(`GitHub rate limited. Remaining: ${remaining}, resets at: ${new Date(resetTs * 1000).toISOString()}`);
    }
    throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function fetchRaw(owner, repo, branch, path) {
  const res = await fetch(
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`
  );
  if (!res.ok) return null;
  return res.text();
}

// Minimal YAML frontmatter parser — sufficient for agentskills.io format
function parseFrontmatter(md) {
  const match = md.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return { frontmatter: {}, body: md };

  const fm = {};
  const lines = match[1].split("\n");
  let currentKey = null;
  let inList = false;

  for (const line of lines) {
    if (/^[^\s]/.test(line) && line.includes(":")) {
      const [k, ...rest] = line.split(":");
      const val = rest.join(":").trim();
      currentKey = k.trim();
      inList = val === "" || val === "[]";
      if (!inList) fm[currentKey] = val.replace(/^["']|["']$/g, "");
      else fm[currentKey] = [];
    } else if (inList && line.trim().startsWith("-") && currentKey) {
      fm[currentKey].push(line.trim().slice(1).trim().replace(/^["']|["']$/g, ""));
    }
  }

  const body = md.slice(match[0].length).trim();
  return { frontmatter: fm, body };
}

function categorize(name, description, body) {
  const text = `${name} ${description} ${body.slice(0, 2000)}`.toLowerCase();
  let best = { cat: "agents", score: 0 };

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      const matches = text.match(new RegExp(`\\b${kw}\\b`, "g"));
      if (matches) score += matches.length;
    }
    if (score > best.score) best = { cat, score };
  }
  return best.cat;
}

function computeQualityScore({ frontmatter, body, stars, hasReadme, hasTests, hasLicense }) {
  let score = 0;
  if (frontmatter.name) score += 10;
  if (frontmatter.description && frontmatter.description.length > 40) score += 15;
  if (body.length > 500) score += 15;
  if (body.length > 2000) score += 10;
  if (hasReadme) score += 10;
  if (hasTests) score += 10;
  if (hasLicense) score += 10;
  if (stars >= 10) score += 5;
  if (stars >= 100) score += 10;
  if (stars >= 1000) score += 5;
  return Math.min(score, 100);
}

function qualityTier(score) {
  if (score >= 85) return "featured";
  if (score >= 60) return "standard";
  if (score >= 30) return "basic";
  return "excluded";
}

// Extract author from folder path — e.g., "skills/AgriciDaniel/claude-seo" → "AgriciDaniel"
function inferAuthor(skillPath, repoOwner) {
  const parts = skillPath.split("/").filter(Boolean);
  // If path is like skills/<author>/<skill-name>, the middle segment is the author
  if (parts.length >= 3 && parts[0] === "skills") return parts[1];
  // Otherwise the repo owner is the author
  return repoOwner;
}

// ─── Acceptance gate ──────────────────────────────────────────────
// Runs before a row is written to skills_staged. Purpose: keep the
// admin review queue small and focused on ambiguous cases, not
// obvious junk. Returns { rejected, reasons, warnings }.
//
// Reject ≠ warn:
//   - `rejected: true` — the row is dropped entirely, never shown
//     in the review UI. Use only for clearly non-skills.
//   - `warnings` — non-blocking. The row lands in staging with these
//     flags attached so the admin sees context at a glance.

const MARKETING_WORDS = [
  "revolutionary", "game-changing", "best-in-class", "next-generation",
  "cutting-edge", "world-class", "powerful", "amazing",
];

const DEMO_REPOS = new Set([
  "anthropics/claude-code",
  "anthropics/claude-cookbooks",
]);
// `owner/repo:folder_path` pairs that we explicitly accept from demo
// repos. Empty by default — add entries as real skills are identified.
const DEMO_REPO_ALLOWLIST = new Set([]);

const STOPWORDS = new Set([
  "a","an","and","as","at","be","by","for","from","has","have","in",
  "into","is","it","its","of","on","or","that","the","this","to",
  "was","were","will","with","your","you","skill","skills",
]);

function contentWords(text) {
  return new Set(
    (text || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

function countWords(s) {
  return (s || "").trim().split(/\s+/).filter(Boolean).length;
}

// Short non-crypto content hash so re-scrapes at the same commit produce
// identical values and the staging UNIQUE constraint can dedupe.
function simpleHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function evaluateAcceptance({ name, description, body, frontmatter, folderPath, repo, license }) {
  const reasons = [];
  const warnings = [];

  // HARD REJECTS — will never reach the review queue.
  if (!frontmatter || !frontmatter.name) reasons.push("missing_frontmatter_name");
  if (!description || description.trim().length < 40) reasons.push("description_under_40_chars");
  if (description && description.trim().length > 500) reasons.push("description_over_500_chars");

  const bodyLen = (body || "").trim().length;
  if (bodyLen < 400) reasons.push("body_under_400_chars");
  if (bodyLen > 50_000) reasons.push("body_over_50kb");

  if (!license || license === "Unknown" || license === "No License" || license === "NOASSERTION") {
    reasons.push("missing_license");
  }

  if (DEMO_REPOS.has(repo) && !DEMO_REPO_ALLOWLIST.has(`${repo}:${folderPath}`)) {
    reasons.push("demo_repo_not_allowlisted");
  }

  // Title ↔ body alignment — at least 2 shared content words.
  const titleWords = contentWords(name);
  if (titleWords.size >= 2) {
    const bodyWords = contentWords(body);
    let overlap = 0;
    titleWords.forEach((w) => { if (bodyWords.has(w)) overlap += 1; });
    if (overlap < 2) reasons.push("title_not_in_body");
  }

  // SOFT WARNINGS — row is staged with flags shown to the admin.
  const lowered = (description || "").toLowerCase();
  const marketingHit = MARKETING_WORDS.filter((w) => lowered.includes(w));
  if (marketingHit.length > 0) warnings.push(`marketing:${marketingHit.join(",")}`);
  if (!frontmatter?.["allowed-tools"] && !frontmatter?.allowed_tools) warnings.push("no_allowed_tools");
  if (bodyLen > 0 && bodyLen < 800) warnings.push("short_body");

  return { rejected: reasons.length > 0, reasons, warnings };
}

// ─── Main scraper ──────────────────────────────────────────────────

async function scrapeSource(source, upsertFn) {
  console.log(`\n━━━ ${source.owner}/${source.repo} ━━━`);

  // Get repo metadata for star count
  const repo = await gh(`/repos/${source.owner}/${source.repo}`);
  const stars = repo.stargazers_count;
  const defaultBranch = repo.default_branch || "main";
  console.log(`  ★ ${stars} stars · branch: ${defaultBranch}`);

  // Use git tree API to recursively list every file in one request
  const tree = await gh(
    `/repos/${source.owner}/${source.repo}/git/trees/${defaultBranch}?recursive=1`
  );

  const skillFiles = tree.tree.filter(
    (node) => node.type === "blob" && node.path.endsWith("SKILL.md")
  );
  console.log(`  Found ${skillFiles.length} SKILL.md files`);

  const allSkills = [];
  let processed = 0;
  let uploadedSoFar = 0;
  const PARALLEL = 20;
  const UPSERT_CHUNK = 200; // Flush to DB every 200 skills

  let chunk = [];

  for (let i = 0; i < skillFiles.length; i += PARALLEL) {
    if (allSkills.length >= LIMIT) break;
    const batch = skillFiles.slice(i, i + PARALLEL);

    const results = await Promise.all(
      batch.map(async (file) => {
        const folderPath = file.path.replace(/\/SKILL\.md$/, "");
        const parts = folderPath.split("/").filter(Boolean);
        if (parts.length === 0) return null;
        const skillName = parts[parts.length - 1];

        const raw = await fetchRaw(source.owner, source.repo, defaultBranch, file.path);
        if (!raw) return null;

        const { frontmatter, body } = parseFrontmatter(raw);
        const name = frontmatter.name || skillName;
        const description = frontmatter.description || body.split("\n").find((l) => l.trim())?.slice(0, 200) || "";
        const license = frontmatter.license || repo.license?.spdx_id || "Unknown";
        const authorUsername = inferAuthor(folderPath, source.owner);

        const hasReadme = tree.tree.some((n) => n.path === `${folderPath}/README.md`);
        const hasTests = tree.tree.some((n) => n.path.startsWith(`${folderPath}/tests/`) || n.path.startsWith(`${folderPath}/test/`));
        const hasLicense = tree.tree.some((n) => /LICENSE/i.test(n.path) && n.path.startsWith(folderPath));

        const category = categorize(name, description, body);
        const quality = computeQualityScore({
          frontmatter,
          body,
          stars,
          hasReadme,
          hasTests,
          hasLicense,
        });

        if (quality < 30) return null;

        // Apply acceptance gate before anything goes to staging. Rows
        // that trip the auto-reject rules never occupy review attention.
        const gate = evaluateAcceptance({
          name,
          description,
          body,
          frontmatter,
          folderPath,
          repo: `${source.owner}/${source.repo}`,
          license,
        });
        if (gate.rejected) {
          // Optional: surface in dry-run output so the operator can see
          // how many rows each rule is catching.
          if (DRY_RUN) {
            console.log(`    ✗ rejected [${gate.reasons.join(", ")}] ${folderPath}`);
          }
          return null;
        }

        return {
          source_id: source.slug,
          source_owner: source.owner,
          source_repo: source.repo,
          skill_path: folderPath,
          name,
          slug: slugify(`${authorUsername}-${source.repo}-${skillName}`),
          description: description.slice(0, 500),
          category_slug: category,
          author_username: authorUsername,
          license,
          github_url: `https://github.com/${source.owner}/${source.repo}/tree/${defaultBranch}/${folderPath}`,
          github_repo: `${source.owner}/${source.repo}`,
          skill_folder_path: folderPath,
          github_stars: stars,
          quality_score: quality,
          quality_tier: qualityTier(quality),
          // Raw content for the admin review view — NOT pushed to the live
          // catalog until an admin approves.
          skill_md_content: raw,
          skill_md_hash: simpleHash(raw),
          readme_content: hasReadme ? null : null, // README fetched on review-time, not here, to keep scrape fast
          frontmatter,
          instruction_word_count: countWords(body),
          // Review signals
          confidence_score: quality,
          auto_flags: gate.warnings,
          compatibility: frontmatter.compatibility ? (Array.isArray(frontmatter.compatibility) ? frontmatter.compatibility : [frontmatter.compatibility]) : ["claude"],
          source: "scraped",
          sync_status: "active",
          last_synced_at: new Date().toISOString(),
        };
      })
    );

    const filtered = results.filter(Boolean);
    chunk.push(...filtered);
    allSkills.push(...filtered);
    processed += batch.length;

    // Flush to DB when chunk is big enough (only in live mode)
    if (!DRY_RUN && upsertFn && chunk.length >= UPSERT_CHUNK) {
      const before = uploadedSoFar;
      uploadedSoFar += await upsertFn(chunk);
      process.stdout.write(`  [${processed}/${skillFiles.length} processed · ${uploadedSoFar} uploaded]\n`);
      chunk = [];
    }
  }

  // Final flush
  if (!DRY_RUN && upsertFn && chunk.length > 0) {
    uploadedSoFar += await upsertFn(chunk);
    console.log(`  [${processed}/${skillFiles.length} processed · ${uploadedSoFar} uploaded]`);
  }

  console.log(`  ✓ extracted ${allSkills.length} usable skills (skipped ${processed - allSkills.length} low-quality)`);
  return allSkills;
}

  console.log(`  ✓ extracted ${skills.length} usable skills (skipped ${processed - skills.length} low-quality)`);
  return skills;
}

// ─── Publish to Supabase ───────────────────────────────────────────

async function upsertToSupabase(skills) {
  if (skills.length === 0) return { inserted: 0, authors: 0 };

  // Deduplicate by slug — keep highest confidence per slug
  const bySlug = new Map();
  for (const s of skills) {
    const existing = bySlug.get(s.slug);
    if (!existing || s.quality_score > existing.quality_score) {
      bySlug.set(s.slug, s);
    }
  }
  const deduped = [...bySlug.values()];
  if (deduped.length < skills.length) {
    console.log(`  Deduped: ${skills.length} → ${deduped.length} unique slugs`);
  }

  // 1. Collect unique authors
  const uniqueAuthors = [...new Set(deduped.map((s) => s.author_username))];
  console.log(`\n  Upserting ${uniqueAuthors.length} authors...`);

  const authorRows = uniqueAuthors.map((username) => ({
    github_username: username,
    display_name: username,
  }));

  const { data: authors, error: authorErr } = await supabase
    .from("authors")
    .upsert(authorRows, { onConflict: "github_username" })
    .select();

  if (authorErr) {
    console.error("✗ Author upsert failed:", authorErr.message);
    return { inserted: 0, authors: 0 };
  }

  const authorMap = new Map(authors.map((a) => [a.github_username, a.id]));

  // 2. Get category IDs
  const { data: categories } = await supabase
    .from("categories")
    .select("id, slug");
  const categoryMap = new Map(categories.map((c) => [c.slug, c.id]));

  // 3. Write to skills_staged (NOT live skills). Admin must approve
  //    each row before it appears in /skiyu. The unique constraint on
  //    (github_repo, skill_folder_path, github_commit_sha) makes
  //    re-scrapes at the same commit idempotent.
  let inserted = 0;
  for (let i = 0; i < deduped.length; i += 100) {
    const batch = deduped.slice(i, i + 100).map((s) => ({
      name: s.name,
      slug: s.slug,
      description: s.description,
      category_id: categoryMap.get(s.category_slug) || null,
      author_id: authorMap.get(s.author_username),
      github_url: s.github_url,
      github_repo: s.github_repo,
      github_stars: s.github_stars,
      github_license: s.license,
      skill_folder_path: s.skill_folder_path,
      github_commit_sha: s.github_commit_sha || null,
      skill_md_content: s.skill_md_content,
      skill_md_hash: s.skill_md_hash,
      readme_content: s.readme_content,
      frontmatter: s.frontmatter,
      instruction_word_count: s.instruction_word_count,
      confidence_score: s.confidence_score,
      auto_flags: s.auto_flags || [],
      review_status: "pending",
    }));

    const { error: skillErr } = await supabase
      .from("skills_staged")
      .upsert(batch, { onConflict: "github_repo,skill_folder_path,github_commit_sha" });

    if (skillErr) {
      console.error(`✗ Batch ${i / 100} failed:`, skillErr.message);
      continue;
    }
    inserted += batch.length;
    process.stdout.write(`  ✓ staged ${inserted}/${deduped.length}\r`);
  }
  console.log();
  console.log(`\n  ${inserted} skills staged for review. Approve at /admin/staged.`);
  return { inserted, authors: uniqueAuthors.length };
}

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log("\n/skiyu — Skills registry scraper");
  console.log(DRY_RUN ? "📋 DRY RUN — no writes to DB" : "🚀 LIVE — will upsert to Supabase");
  console.log(`Limit per source: ${LIMIT === Infinity ? "unlimited" : LIMIT}`);
  console.log(`Source filter: ${SOURCE_FILTER}\n`);

  const toScrape = SOURCE_FILTER === "all"
    ? SOURCES
    : SOURCES.filter((s) => s.slug === SOURCE_FILTER);

  if (toScrape.length === 0) {
    console.error(`No sources match '${SOURCE_FILTER}'. Options:`);
    SOURCES.forEach((s) => console.error(`  --source=${s.slug}`));
    process.exit(1);
  }

  const allSkills = [];
  for (const source of toScrape) {
    try {
      const skills = await scrapeSource(source);
      allSkills.push(...skills);
    } catch (err) {
      console.error(`✗ Failed to scrape ${source.owner}/${source.repo}:`, err.message);
    }
  }

  console.log(`\n━━━ Summary ━━━`);
  console.log(`Total skills extracted: ${allSkills.length}`);
  const byCategory = {};
  allSkills.forEach((s) => {
    byCategory[s.category_slug] = (byCategory[s.category_slug] || 0) + 1;
  });
  console.log(`By category:`);
  Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, n]) => console.log(`  ${cat.padEnd(14)} ${n}`));

  const uniqueAuthors = new Set(allSkills.map((s) => s.author_username)).size;
  console.log(`Unique authors: ${uniqueAuthors}`);

  if (DRY_RUN) {
    console.log("\n📋 DRY RUN complete. Sample skills:");
    allSkills.slice(0, 10).forEach((s) => {
      console.log(`  [${s.category_slug}] ${s.name} by @${s.author_username} (Q${s.quality_score})`);
    });

    // Write a full report
    const reportPath = "scripts/dry-run-report.json";
    fs.writeFileSync(reportPath, JSON.stringify(allSkills, null, 2));
    console.log(`\nFull dry-run report written to ${reportPath}`);
  } else {
    console.log("\n🚀 Publishing to Supabase...");
    const { inserted, authors } = await upsertToSupabase(allSkills);
    console.log(`\n✓ Done. ${inserted} skills, ${authors} authors in database.`);
  }
}

main().catch((err) => {
  console.error("\n✗ Fatal error:", err);
  process.exit(1);
});
