# /skiyu — Scripts

## seed-from-registries.mjs

Scrapes real SKILL.md files from known public GitHub repos and ingests them into Supabase.

### Sources (verified April 2026)

| Source | Skills |
|---|---|
| `jeremylongshore/claude-code-plugins-plus-skills` | 4,632 |
| `mukul975/Anthropic-Cybersecurity-Skills` | 754 |
| `alirezarezvani/claude-skills` | 540 |
| `wondelai/skills` | 42 |
| `anthropics/skills` | 18 |
| **Total** | **~5,986** |

### Setup

You need two environment variables:

```bash
# GitHub Personal Access Token (public_repo scope only)
# Create at: https://github.com/settings/tokens
export GITHUB_TOKEN=ghp_xxx...

# Supabase service role key (NOT the anon key — service key bypasses RLS for inserts)
# Get from: https://supabase.com/dashboard/project/mkqiqkqgnywosbneibqx/settings/api
export SUPABASE_SERVICE_KEY=eyJ...
```

### Usage

```bash
# Preview what would be ingested (no DB writes, writes JSON report to disk)
node scripts/seed-from-registries.mjs --dry-run

# Test with a small batch
node scripts/seed-from-registries.mjs --limit=50

# Ingest from a single source
node scripts/seed-from-registries.mjs --source=anthropics-skills

# Full ingest — all sources, all skills (~6K skills, takes 20-30 min)
node scripts/seed-from-registries.mjs

# Combine flags
node scripts/seed-from-registries.mjs --source=wondelai-skills --dry-run
```

### What it does

1. **Fetches each source repo's file tree** via GitHub's `/git/trees?recursive=1` endpoint (one API call lists every file)
2. **Walks for SKILL.md files** anywhere in the tree
3. **Fetches each SKILL.md raw content** from `raw.githubusercontent.com`
4. **Parses YAML frontmatter** to extract name, description, tags, license, compatibility
5. **Infers the author** from the folder path (e.g., `skills/AgriciDaniel/claude-seo` → `AgriciDaniel`)
6. **Auto-categorizes** into one of the 16 /skiyu categories using keyword scoring
7. **Computes a quality score** from frontmatter completeness, body length, README presence, tests, license, and parent repo star count
8. **Skips low-quality skills** (quality < 30) to keep the catalog clean
9. **Upserts to Supabase** — creates author rows, then skill rows with proper foreign keys and download URLs

### Output

Every skill ends up with:
- `source = 'scraped'` (so the claim system knows it's unclaimed)
- `claimed_by = NULL` (authors can claim their own skills via GitHub OAuth)
- `download_url` pointing at the parent repo's archive zip
- Proper category, quality score, and author attribution

### Re-running

The script uses `upsert` with `onConflict: 'slug'`, so re-running is safe — it'll update existing skills rather than duplicate them.

### Next steps

1. **README-list scraper** — Add a separate script for `VoltAgent/awesome-agent-skills` which is a curated list that links to external repos. That scraper parses the README's markdown links and then runs the main scraper against each linked repo.
2. **GitHub code search** — Use `q=filename:SKILL.md` on the GitHub search API to find skills outside the known directories. This adds another ~10-40K skills from solo creators.
3. **Periodic sync** — Set up a cron/Edge Function to re-run weekly so new skills in source repos flow into /skiyu automatically.
