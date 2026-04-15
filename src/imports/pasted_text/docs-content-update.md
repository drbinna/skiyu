# Figma Make Prompt — /skiyu Docs Restructure (v3 — No Pricing Content)

Rewrite the docs page (`src/app/components/docs.tsx`) with the following changes. Keep the same visual design, layout, sidebar + content pane structure, fonts (Erode as F, Fragment Mono as M), render system (renderBlock), breadcrumbs, previous/next navigation, and search functionality. Only change the DOCS_TREE structure and CONTENT data.

---

## 1. Replace DOCS_TREE with this new structure (9 pages, 4 sections):

```
Getting started
  → What is /skiyu?          (id: "intro")
  → Quickstart               (id: "quickstart")
  → Installing skills        (id: "installing")

Publishing
  → Writing SKILL.md         (id: "writing-skillmd")
  → Publishing & validation  (id: "publishing")

Collaboration
  → Forking & pull requests  (id: "forking")

Reference
  → CLI reference            (id: "cli-reference")
  → API reference            (id: "api-reference")
  → Skill chains             (id: "skill-chains")
```

Remove all other pages that existed before. This includes: "Install the CLI", "Your first skill", "Browsing & search", "Managing installed skills", "Skill package format", "Adding scripts", "Testing your skill", "Versioning & updates", "Pricing models", "Connecting Stripe", "Withdrawals & payouts", "Revenue splits", "Taxes & reporting", "Pull requests", "Co-maintainers", "Frontmatter schema", "Review process", "Trust & quality scores", "Selling your skill", "Creator billing", "Creator credits".

No Monetization section. No selling, pricing, billing, credits, withdrawals, or payout pages.

---

## 2. Keep these existing pages as-is (no content changes):

- **"intro"** — What is /skiyu? (keep all existing blocks unchanged)
- **"quickstart"** — Quickstart (keep all existing blocks unchanged)
- **"installing"** — Installing skills (keep all existing blocks unchanged)
- **"cli-reference"** — CLI reference (keep all existing blocks unchanged)

---

## 3. Write new page "writing-skillmd":

Title: "Writing SKILL.md"
Breadcrumb: "Publishing"
Body:
- p: "SKILL.md is the core of every skill. It tells Claude what your skill does, when to use it, and how to execute it. A well-written SKILL.md is the difference between a skill that works and one that works beautifully."
- heading: "File structure"
- p: "Every SKILL.md has two parts: YAML frontmatter (metadata) and a Markdown body (instructions)."
- code (yaml): "---\nname: pdf-architect\ndescription: \"Generate, merge, split, and watermark PDFs.\"\nversion: 2.4.1\nauthor: synthwave_dev\nlicense: MIT\ncategories:\n  - documents\n  - pdf\ntags:\n  - pdf\n  - generation\n  - merge\n---\n\n# PDF Architect\n\nYour Markdown instructions go here..."
- heading: "Frontmatter fields"
- def: term "name" → desc "Required. Unique identifier for your skill. Lowercase, hyphens only."
- def: term "description" → desc "Required. One-line summary shown in search results and the explore page."
- def: term "version" → desc "Required. Semantic version (e.g. 1.0.0). Must increment with each publish."
- def: term "author" → desc "Required. Your /skiyu username."
- def: term "license" → desc "Required. MIT, Apache-2.0, or proprietary."
- def: term "categories" → desc "Optional. One or more from: documents, code, data, devops, research, creative, legal, finance, testing, api."
- def: term "tags" → desc "Optional. Freeform tags for search discovery."
- heading: "Writing the body"
- p: "The Markdown body is what Claude reads when using your skill. Write it as clear instructions addressed to Claude. Be specific about what the skill does, what inputs it expects, what outputs it produces, and what steps to follow."
- callout (tip): "Write your SKILL.md as if you're explaining the task to a smart colleague who has never done it before. Be explicit about edge cases and output formats."
- heading: "Adding scripts"
- p: "If your skill needs to run code (e.g. generating files, calling APIs, processing data), add scripts to the scripts/ directory. Reference them from your SKILL.md body with clear instructions on when and how to run them."
- code (text): "my-skill/\n├── SKILL.md\n├── scripts/\n│   ├── generate.py\n│   └── validate.sh\n├── references/\n│   └── api-docs.md\n└── assets/\n    └── template.docx"
- heading: "Best practices"
- p: "Keep your SKILL.md under 500 lines. If it's getting longer, move detailed reference material into the references/ directory and point to it from the main file. Use clear section headings. Include example inputs and outputs so Claude knows exactly what success looks like."

---

## 4. Write new page "publishing":

Title: "Publishing & validation"
Breadcrumb: "Publishing"
Body:
- p: "Once your skill is ready, publish it to /skiyu so others can discover and install it."
- heading: "Validate first"
- p: "Before publishing, run validation to catch issues early. This checks your package structure, frontmatter, and runs linting on any scripts."
- code (bash): "skiyu validate ./my-skill"
- code (text): "✓ SKILL.md found\n✓ Frontmatter valid (name, version, author, license)\n✓ Scripts scanned — no issues\n✓ Package size: 24KB\n✓ Ready to publish"
- heading: "Testing in sandbox"
- p: "Run your test suite in a sandboxed environment to verify the skill works as expected."
- code (bash): "skiyu test ./my-skill"
- heading: "Publishing"
- p: "When validation passes, publish your skill. This packages the directory into a .skill file, uploads it, and submits it for review."
- code (bash): "skiyu publish ./my-skill"
- code (text): "✓ Packaged my-skill@1.0.0 (24KB)\n✓ Uploaded to /skiyu\n✓ Submitted for review\n\nYour skill will be reviewed within 24 hours."
- heading: "What happens during review"
- p: "Every skill goes through automated checks: package structure validation, script security scanning (static analysis for malicious patterns), and an AI quality score (0–100). Free skills from trusted publishers with a track record are auto-approved. First-time publishers go through human review."
- heading: "Versioning"
- p: "Skills follow semantic versioning. Each new publish must increment the version in your frontmatter."
- code (bash): "# Publish an update\n# (make sure version in SKILL.md is incremented)\nskiyu publish ./my-skill"
- callout (info): "You can also publish via the web interface. Navigate to Publish → New Skill and drag-and-drop your .skill file or folder."

---

## 5. Add "Coming soon" pages for these three:

For "forking", "api-reference", and "skill-chains", create simple content:
- Title: the page title (e.g. "Forking & pull requests", "API reference", "Skill chains")
- Breadcrumb: the section name (e.g. "Collaboration", "Reference", "Reference")
- Body: one paragraph saying "This feature is under development and will be available in a future release. Check back soon or follow our changelog for updates."
- One callout (info): "Want this sooner? Let us know what you'd build with it — your feedback shapes our roadmap."

---

## 6. Do NOT change:
- The component's visual styling, layout, or CSS
- The renderBlock function or block types
- The sidebar search, section toggle, breadcrumb, or previous/next navigation
- The nav bar or footer
- The font aliases (F and M)
- Any imports or routing logic

Only change DOCS_TREE and CONTENT. Everything else stays exactly as it is.