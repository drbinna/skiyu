import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import NavAuth from "./nav-auth";
import { preloadRoute } from "../routes";

const M = "'Fragment Mono', monospace";
const F = "'Erode', serif";

const DOCS_TREE = [
  { section: "Getting started", items: [
    { id: "intro", label: "What is / skiyu?" },
    { id: "quickstart", label: "Quickstart" },
    { id: "installing", label: "Installing skills" },
  ]},
  { section: "Publishing", items: [
    { id: "writing-skillmd", label: "Writing SKILL.md" },
    { id: "publishing", label: "Publishing & validation" },
  ]},
  { section: "Collaboration", items: [
    { id: "forking", label: "Forking & pull requests" },
  ]},
  { section: "Reference", items: [
    { id: "cli-reference", label: "CLI reference" },
    { id: "api-reference", label: "API reference" },
    { id: "skill-chains", label: "Skill chains" },
  ]},
];

type Block = { type: string; text?: string; lang?: string; num?: string; title?: string; term?: string; desc?: string; name?: string; variant?: string };

const CONTENT: Record<string, { title: string; breadcrumb: string; body: Block[] }> = {
  "intro": {
    title: "What is / skiyu?",
    breadcrumb: "Getting started",
    body: [
      { type: "p", text: "/ skiyu is the open marketplace where AI engineers discover, share, and install Claude skills. A skill is a self-contained instruction package that extends what Claude can do — from generating PDFs and reviewing code to building data pipelines and drafting legal contracts." },
      { type: "p", text: "Think of it as npm for AI workflows. You install a skill, and Claude immediately gains new capabilities." },
      { type: "heading", text: "What you can do" },
      { type: "p", text: "As a consumer, you can browse thousands of skills, install them with a single command, and combine them into powerful chains. As a publisher, you can package your best Claude workflows into reusable skills and share them with the community." },
      { type: "heading", text: "How skills work" },
      { type: "p", text: "A skill is a .skill file (a ZIP archive) containing a SKILL.md instruction file and optional scripts, references, and assets. When installed, Claude reads the SKILL.md to understand new capabilities and follows its instructions to complete tasks." },
      { type: "code", lang: "text", text: "my-skill/\n├── SKILL.md          ← Instructions for Claude\n├── scripts/          ← Optional automation scripts\n├── references/       ← Optional documentation\n├── assets/           ← Optional templates, fonts, icons\n├── tests/            ← Optional test cases\n└── LICENSE.txt       ← Recommended" },
      { type: "heading", text: "Key concepts" },
      { type: "def", term: "Skill", desc: "A packaged set of instructions and tools that teach Claude a new capability." },
      { type: "def", term: "Publisher", desc: "Anyone who creates and shares skills on / skiyu. Can be an individual or a team." },
      { type: "def", term: "Skill chain", desc: "Multiple skills wired together into a pipeline. Each skill's output feeds the next." },
      { type: "def", term: "Trust score", desc: "A composite score (0–100) reflecting a publisher's reliability based on ratings, installs, and history." },
      { type: "callout", variant: "info", text: "Ready to jump in? Follow the Quickstart guide to install your first skill in under 5 minutes." },
    ]
  },
  "quickstart": {
    title: "Quickstart",
    breadcrumb: "Getting started",
    body: [
      { type: "p", text: "Get up and running with / skiyu in five minutes. By the end, you'll have the CLI installed and your first skill running." },
      { type: "step", num: "1", title: "Install the CLI", text: "Install the skiyu CLI globally using npm. Requires Node.js 18 or later." },
      { type: "code", lang: "bash", text: "npm install -g skiyu" },
      { type: "step", num: "2", title: "Authenticate", text: "Log in with your / skiyu account. This opens a browser window to complete authentication." },
      { type: "code", lang: "bash", text: "skiyu login" },
      { type: "step", num: "3", title: "Install a skill", text: "Install your first skill. Let's start with PDF Architect, one of the most popular skills on the platform." },
      { type: "code", lang: "bash", text: "skiyu install @synthwave/pdf-architect" },
      { type: "code", lang: "text", text: "✓ Fetching @synthwave/pdf-architect@2.4.1\n✓ Verified checksum (SHA-256)\n✓ Installed to ~/.skiyu/skills/\n✓ Ready — Claude can now use PDF Architect" },
      { type: "step", num: "4", title: "Use it", text: "Open Claude and ask it to use your new skill. Claude automatically detects installed skills." },
      { type: "code", lang: "text", text: "You: Generate a PDF report from this CSV data\nClaude: I'll use PDF Architect to create that report.\n       [reads SKILL.md → runs scripts → produces report.pdf]" },
      { type: "step", num: "5", title: "Explore more", text: "Browse the marketplace to find more skills for your workflow." },
      { type: "code", lang: "bash", text: "skiyu search \"data pipeline\"\nskiyu explore --category devops\nskiyu trending" },
      { type: "callout", variant: "tip", text: "Use skiyu list to see all installed skills, and skiyu update to update them all at once." },
    ]
  },
  "installing": {
    title: "Installing skills",
    breadcrumb: "Getting started",
    body: [
      { type: "p", text: "There are two ways to install skills: through the CLI (recommended for engineers) or through the web interface (no terminal needed)." },
      { type: "heading", text: "Via CLI" },
      { type: "p", text: "The skiyu install command downloads, verifies, and installs a skill in one step." },
      { type: "code", lang: "bash", text: "# Install latest version\nskiyu install @author/skill-name\n\n# Install a specific version\nskiyu install @author/skill-name@2.1.0\n\n# Install from a local .skill file\nskiyu install ./my-skill.skill" },
      { type: "heading", text: "Via web" },
      { type: "p", text: "On any skill's detail page, click the Install button. You'll be given a CLI command to copy, or you can click \"Add to Claude\" to install directly if you're using Claude's web interface." },
      { type: "heading", text: "Where skills are stored" },
      { type: "p", text: "Installed skills live in your local skill directory. Claude reads from this directory when looking for available skills." },
      { type: "code", lang: "bash", text: "# Default location\n~/.skiyu/skills/\n\n# View installed skills\nskiyu list\n\n# See details about a specific skill\nskiyu info @synthwave/pdf-architect" },
      { type: "heading", text: "Updating skills" },
      { type: "code", lang: "bash", text: "# Update a single skill\nskiyu update @author/skill-name\n\n# Update all installed skills\nskiyu update\n\n# Pin to a version (skip auto-updates)\nskiyu pin @author/skill-name@2.1.0" },
      { type: "heading", text: "Uninstalling" },
      { type: "code", lang: "bash", text: "skiyu uninstall @author/skill-name" },
      { type: "callout", variant: "info", text: "You can reinstall any previously installed skill anytime." },
    ]
  },
  "writing-skillmd": {
    title: "Writing SKILL.md",
    breadcrumb: "Publishing",
    body: [
      { type: "p", text: "SKILL.md is the core of every skill. It tells Claude what your skill does, when to use it, and how to execute it. A well-written SKILL.md is the difference between a skill that works and one that works beautifully." },
      { type: "heading", text: "File structure" },
      { type: "p", text: "Every SKILL.md has two parts: YAML frontmatter (metadata) and a Markdown body (instructions)." },
      { type: "code", lang: "yaml", text: "---\nname: pdf-architect\ndescription: \"Generate, merge, split, and watermark PDFs.\"\nversion: 2.4.1\nauthor: synthwave_dev\nlicense: MIT\ncategories:\n  - documents\n  - pdf\ntags:\n  - pdf\n  - generation\n  - merge\n---\n\n# PDF Architect\n\nYour Markdown instructions go here..." },
      { type: "heading", text: "Frontmatter fields" },
      { type: "def", term: "name", desc: "Required. Unique identifier for your skill. Lowercase, hyphens only." },
      { type: "def", term: "description", desc: "Required. One-line summary shown in search results and the explore page." },
      { type: "def", term: "version", desc: "Required. Semantic version (e.g. 1.0.0). Must increment with each publish." },
      { type: "def", term: "author", desc: "Required. Your / skiyu username." },
      { type: "def", term: "license", desc: "Required. MIT, Apache-2.0, or proprietary." },
      { type: "def", term: "categories", desc: "Optional. One or more from: documents, code, data, devops, research, creative, legal, finance, testing, api." },
      { type: "def", term: "tags", desc: "Optional. Freeform tags for search discovery." },
      { type: "heading", text: "Writing the body" },
      { type: "p", text: "The Markdown body is what Claude reads when using your skill. Write it as clear instructions addressed to Claude. Be specific about what the skill does, what inputs it expects, what outputs it produces, and what steps to follow." },
      { type: "callout", variant: "tip", text: "Write your SKILL.md as if you're explaining the task to a smart colleague who has never done it before. Be explicit about edge cases and output formats." },
      { type: "heading", text: "Adding scripts" },
      { type: "p", text: "If your skill needs to run code (e.g. generating files, calling APIs, processing data), add scripts to the scripts/ directory. Reference them from your SKILL.md body with clear instructions on when and how to run them." },
      { type: "code", lang: "text", text: "my-skill/\n├── SKILL.md\n├── scripts/\n│   ├── generate.py\n│   └── validate.sh\n├── references/\n│   └── api-docs.md\n└── assets/\n    └── template.docx" },
      { type: "heading", text: "Best practices" },
      { type: "p", text: "Keep your SKILL.md under 500 lines. If it's getting longer, move detailed reference material into the references/ directory and point to it from the main file. Use clear section headings. Include example inputs and outputs so Claude knows exactly what success looks like." },
    ]
  },
  "publishing": {
    title: "Publishing & validation",
    breadcrumb: "Publishing",
    body: [
      { type: "p", text: "Once your skill is ready, publish it to / skiyu so others can discover and install it." },
      { type: "heading", text: "Validate first" },
      { type: "p", text: "Before publishing, run validation to catch issues early. This checks your package structure, frontmatter, and runs linting on any scripts." },
      { type: "code", lang: "bash", text: "skiyu validate ./my-skill" },
      { type: "code", lang: "text", text: "✓ SKILL.md found\n✓ Frontmatter valid (name, version, author, license)\n✓ Scripts scanned — no issues\n✓ Package size: 24KB\n✓ Ready to publish" },
      { type: "heading", text: "Testing in sandbox" },
      { type: "p", text: "Run your test suite in a sandboxed environment to verify the skill works as expected." },
      { type: "code", lang: "bash", text: "skiyu test ./my-skill" },
      { type: "heading", text: "Publishing" },
      { type: "p", text: "When validation passes, publish your skill. This packages the directory into a .skill file, uploads it, and submits it for review." },
      { type: "code", lang: "bash", text: "skiyu publish ./my-skill" },
      { type: "code", lang: "text", text: "✓ Packaged my-skill@1.0.0 (24KB)\n✓ Uploaded to / skiyu\n✓ Submitted for review\n\nYour skill will be reviewed within 24 hours." },
      { type: "heading", text: "What happens during review" },
      { type: "p", text: "Every skill goes through automated checks: package structure validation, script security scanning (static analysis for malicious patterns), and an AI quality score (0–100). Free skills from trusted publishers with a track record are auto-approved. First-time publishers go through human review." },
      { type: "heading", text: "Versioning" },
      { type: "p", text: "Skills follow semantic versioning. Each new publish must increment the version in your frontmatter." },
      { type: "code", lang: "bash", text: "# Publish an update\n# (make sure version in SKILL.md is incremented)\nskiyu publish ./my-skill" },
      { type: "callout", variant: "info", text: "You can also publish via the web interface. Navigate to Publish → New Skill and drag-and-drop your .skill file or folder." },
    ]
  },
  "forking": {
    title: "Forking & pull requests",
    breadcrumb: "Collaboration",
    body: [
      { type: "p", text: "This feature is under development and will be available in a future release. Check back soon or follow our changelog for updates." },
      { type: "callout", variant: "info", text: "Want this sooner? Let us know what you'd build with it — your feedback shapes our roadmap." },
    ]
  },
  "cli-reference": {
    title: "CLI reference",
    breadcrumb: "Reference",
    body: [
      { type: "p", text: "The skiyu CLI is the fastest way to install, publish, and manage skills. Below is the complete command reference." },
      { type: "heading", text: "Global options" },
      { type: "code", lang: "bash", text: "skiyu [command] [options]\n\n  --help, -h       Show help for a command\n  --version, -v    Print CLI version\n  --verbose        Show detailed output\n  --json           Output as JSON (for scripting)" },
      { type: "heading", text: "Authentication" },
      { type: "cmd", name: "skiyu login", desc: "Authenticate with your / skiyu account. Opens a browser for OAuth." },
      { type: "cmd", name: "skiyu logout", desc: "Clear stored credentials." },
      { type: "cmd", name: "skiyu whoami", desc: "Print the currently authenticated user." },
      { type: "heading", text: "Consuming skills" },
      { type: "cmd", name: "skiyu install <skill>", desc: "Install a skill. Accepts @author/name, @author/name@version, or a local .skill file path." },
      { type: "cmd", name: "skiyu uninstall <skill>", desc: "Remove an installed skill." },
      { type: "cmd", name: "skiyu update [skill]", desc: "Update one or all installed skills to the latest version." },
      { type: "cmd", name: "skiyu list", desc: "List all installed skills with version and status." },
      { type: "cmd", name: "skiyu info <skill>", desc: "Show detail about a skill — description, version, author, dependencies." },
      { type: "cmd", name: "skiyu search <query>", desc: "Search the marketplace. Supports filters: --category, --sort." },
      { type: "cmd", name: "skiyu trending", desc: "Show trending skills this week." },
      { type: "cmd", name: "skiyu pin <skill@version>", desc: "Pin a skill to a specific version, skipping auto-updates." },
      { type: "heading", text: "Publishing" },
      { type: "cmd", name: "skiyu init", desc: "Scaffold a new skill project in the current directory." },
      { type: "cmd", name: "skiyu validate [path]", desc: "Validate a skill package. Checks structure, frontmatter, and runs linting." },
      { type: "cmd", name: "skiyu test [path]", desc: "Run the skill's test suite in a sandboxed environment." },
      { type: "cmd", name: "skiyu publish [path]", desc: "Package and publish a skill to / skiyu. Runs validation first." },
      { type: "cmd", name: "skiyu unpublish <skill@version>", desc: "Deprecate a specific version (does not delete — existing installs continue working)." },
    ]
  },
  "api-reference": {
    title: "API reference",
    breadcrumb: "Reference",
    body: [
      { type: "p", text: "This feature is under development and will be available in a future release. Check back soon or follow our changelog for updates." },
      { type: "callout", variant: "info", text: "Want this sooner? Let us know what you'd build with it — your feedback shapes our roadmap." },
    ]
  },
  "skill-chains": {
    title: "Skill chains",
    breadcrumb: "Reference",
    body: [
      { type: "p", text: "This feature is under development and will be available in a future release. Check back soon or follow our changelog for updates." },
      { type: "callout", variant: "info", text: "Want this sooner? Let us know what you'd build with it — your feedback shapes our roadmap." },
    ]
  },
};

const DEFAULT_PAGE = "intro";

export default function Docs() {
  const [active, setActive] = useState(DEFAULT_PAGE);
  const [search, setSearch] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    Object.fromEntries(DOCS_TREE.map(s => [s.section, true]))
  );
  const contentRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const page = CONTENT[active] || CONTENT[DEFAULT_PAGE];

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const filteredTree = search
    ? DOCS_TREE.map(s => ({
        ...s,
        items: s.items.filter(i => i.label.toLowerCase().includes(search.toLowerCase()))
      })).filter(s => s.items.length > 0)
    : DOCS_TREE;

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [active]);

  const renderBlock = (block: Block, i: number) => {
    switch (block.type) {
      case "p":
        return <p key={i} style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.8, marginBottom: 16 }}>{block.text}</p>;
      case "heading":
        return <h3 key={i} style={{ fontSize: 15, fontWeight: 700, marginTop: 32, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{block.text}</h3>;
      case "code":
        return (
          <div key={i} style={{ marginBottom: 16, borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
            {block.lang && (
              <div style={{ padding: "6px 14px", fontSize: 10, fontFamily: M, color: "rgba(255,255,255,0.15)", letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.02)" }}>
                {block.lang}
              </div>
            )}
            <pre style={{ padding: "14px 16px", fontSize: 13, fontFamily: M, color: "rgba(255,255,255,0.65)", lineHeight: 1.7, overflowX: "auto", margin: 0, background: "rgba(255,255,255,0.015)" }}>
              {block.text}
            </pre>
          </div>
        );
      case "step":
        return (
          <div key={i} style={{ display: "flex", gap: 14, marginBottom: 8, marginTop: 24 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 7, flexShrink: 0,
              background: "#fff", color: "#000", fontSize: 12, fontWeight: 700, fontFamily: M,
              display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1,
            }}>{block.num}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{block.title}</div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.7 }}>{block.text}</div>
            </div>
          </div>
        );
      case "def":
        return (
          <div key={i} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
            <span style={{ fontSize: 13, fontWeight: 600, width: 140, flexShrink: 0, fontFamily: M, color: "rgba(255,255,255,0.6)" }}>{block.term}</span>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>{block.desc}</span>
          </div>
        );
      case "cmd":
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
            <code style={{ fontSize: 13, fontFamily: M, color: "#fff", fontWeight: 500 }}>{block.name}</code>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>{block.desc}</span>
          </div>
        );
      case "callout": {
        const isTip = block.variant === "tip";
        return (
          <div key={i} style={{
            marginTop: 20, marginBottom: 16, padding: "14px 16px", borderRadius: 8,
            background: "rgba(255,255,255,0.02)",
            borderLeft: `3px solid ${isTip ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.12)"}`,
          }}>
            <div style={{ fontSize: 10, fontFamily: M, color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
              {isTip ? "Tip" : "Note"}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>{block.text}</div>
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div style={{ background: "#000", color: "#fff", minHeight: "100vh", fontFamily: F }}>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        ::selection{background:#fff;color:#000}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:#000}
        ::-webkit-scrollbar-thumb{background:#222;border-radius:2px}
        input::placeholder{color:rgba(255,255,255,0.15)}
        .nav-link{transition:color .2s;cursor:pointer}
        .nav-link:hover{color:#fff!important}
        .doc-link{transition:all .2s;cursor:pointer;display:block;padding:5px 10px;border-radius:5px;margin-bottom:1px}
        .doc-link:hover{background:rgba(255,255,255,0.04);color:#fff!important}
        .section-toggle{cursor:pointer;transition:color .2s;display:flex;align-items:center;justify-content:space-between;user-select:none}
        .section-toggle:hover{color:rgba(255,255,255,0.5)!important}
        pre::-webkit-scrollbar{height:3px}
        pre::-webkit-scrollbar-track{background:transparent}
        pre::-webkit-scrollbar-thumb{background:#222;border-radius:2px}
      `}</style>

      {/* NAV */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, height: 56, padding: "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <span onClick={() => navigate("/")} style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.5px", cursor: "pointer", fontFamily: F }}>/ skiyu</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontFamily: M }}>/docs</span>
        </div>
        <div style={{ display: "flex", gap: 20, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
          {[
            { label: "Explore", path: "/explore" as const },
            { label: "Publish", path: "/publish" as const },
            { label: "Docs", path: "/docs" as const },
          ].map(l => (
            <span
              key={l.label}
              className="nav-link"
              onClick={() => navigate(l.path)}
              onMouseEnter={() => preloadRoute[l.path]?.()}
              onFocus={() => preloadRoute[l.path]?.()}
              tabIndex={0}
              style={{ color: l.label === "Docs" ? "#fff" : undefined, fontWeight: l.label === "Docs" ? 600 : 400 }}
            >{l.label}</span>
          ))}
        </div>
        <NavAuth />
      </nav>

      <div style={{ display: "flex", maxWidth: 1100, margin: "0 auto", paddingTop: 56 }}>

        {/* SIDEBAR */}
        <aside style={{
          width: 240, flexShrink: 0,
          borderRight: "1px solid rgba(255,255,255,0.04)",
          position: "fixed", top: 56, left: "max(0px, calc((100vw - 1100px)/2))",
          height: "calc(100vh - 56px)", overflowY: "auto",
          padding: "16px 16px 40px",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 7, padding: "0 10px", marginBottom: 20,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search docs..."
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 12, padding: "8px 0", fontFamily: F }}
            />
            {search && (
              <span onClick={() => setSearch("")} style={{ cursor: "pointer", color: "rgba(255,255,255,0.2)", fontSize: 14 }}>×</span>
            )}
          </div>

          {filteredTree.map(section => (
            <div key={section.section} style={{ marginBottom: 8 }}>
              <div
                className="section-toggle"
                onClick={() => toggleSection(section.section)}
                style={{
                  fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.2)",
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  padding: "6px 10px",
                }}
              >
                <span>{section.section}</span>
                <span style={{ fontSize: 10 }}>{expandedSections[section.section] ? "−" : "+"}</span>
              </div>
              {expandedSections[section.section] && section.items.map(item => (
                <div
                  key={item.id}
                  className="doc-link"
                  onClick={() => { setActive(item.id); window.scrollTo(0, 0); }}
                  style={{
                    fontSize: 13,
                    color: active === item.id ? "#fff" : "rgba(255,255,255,0.3)",
                    fontWeight: active === item.id ? 600 : 400,
                    background: active === item.id ? "rgba(255,255,255,0.05)" : "transparent",
                    borderLeft: active === item.id ? "2px solid #fff" : "2px solid transparent",
                    paddingLeft: active === item.id ? 8 : 10,
                  }}
                >
                  {item.label}
                </div>
              ))}
            </div>
          ))}
        </aside>

        {/* CONTENT */}
        <main ref={contentRef} style={{
          flex: 1, marginLeft: 240, padding: "40px 48px 120px",
          maxWidth: 680, minHeight: "calc(100vh - 56px)",
        }}>
          <div style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.15)", letterSpacing: "0.06em", marginBottom: 8 }}>
            <span style={{ cursor: "pointer" }} onClick={() => setActive("intro")}>Docs</span>
            <span style={{ margin: "0 6px" }}>/</span>
            <span>{page.breadcrumb}</span>
          </div>

          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>
            {page.title}
          </h1>

          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 28 }} />

          {page.body.map(renderBlock)}

          {/* bottom nav */}
          <div style={{
            display: "flex", justifyContent: "space-between", marginTop: 48, paddingTop: 20,
            borderTop: "1px solid rgba(255,255,255,0.04)",
          }}>
            {(() => {
              const allItems = DOCS_TREE.flatMap(s => s.items);
              const idx = allItems.findIndex(i => i.id === active);
              const prev = idx > 0 ? allItems[idx - 1] : null;
              const next = idx < allItems.length - 1 ? allItems[idx + 1] : null;
              return (
                <>
                  {prev ? (
                    <div onClick={() => setActive(prev.id)} style={{ cursor: "pointer" }}>
                      <div style={{ fontSize: 10, fontFamily: M, color: "rgba(255,255,255,0.15)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Previous</div>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>← {prev.label}</div>
                    </div>
                  ) : <div />}
                  {next ? (
                    <div onClick={() => setActive(next.id)} style={{ cursor: "pointer", textAlign: "right" }}>
                      <div style={{ fontSize: 10, fontFamily: M, color: "rgba(255,255,255,0.15)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Next</div>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>{next.label} →</div>
                    </div>
                  ) : <div />}
                </>
              );
            })()}
          </div>

          <div style={{ marginTop: 40, padding: "20px 0", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, fontFamily: F, opacity: 0.12, cursor: "pointer" }} onClick={() => navigate("/")}>/ skiyu</span>
            <span style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.08)" }}>
              Found an error? Edit this page on GitHub →
            </span>
          </div>
        </main>
      </div>
    </div>
  );
}