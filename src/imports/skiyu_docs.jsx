import { useState, useEffect, useRef } from "react";

const DOCS_TREE = [
  { section: "Getting started", items: [
    { id: "intro", label: "What is /skiyu?" },
    { id: "quickstart", label: "Quickstart (5 min)" },
    { id: "install-cli", label: "Install the CLI" },
    { id: "your-first-skill", label: "Your first skill" },
  ]},
  { section: "Using skills", items: [
    { id: "browsing", label: "Browsing & search" },
    { id: "installing", label: "Installing skills" },
    { id: "managing", label: "Managing installed skills" },
    { id: "skill-chains", label: "Skill chains" },
  ]},
  { section: "Publishing", items: [
    { id: "skill-format", label: "Skill package format" },
    { id: "writing-skillmd", label: "Writing SKILL.md" },
    { id: "adding-scripts", label: "Adding scripts" },
    { id: "testing", label: "Testing your skill" },
    { id: "publishing", label: "Publishing to /skiyu" },
    { id: "versioning", label: "Versioning & updates" },
  ]},
  { section: "Monetization", items: [
    { id: "pricing-models", label: "Pricing models" },
    { id: "stripe-setup", label: "Connecting Stripe" },
    { id: "withdrawals", label: "Withdrawals & payouts" },
    { id: "revenue-splits", label: "Revenue splits" },
    { id: "taxes", label: "Taxes & reporting" },
  ]},
  { section: "Collaboration", items: [
    { id: "forking", label: "Forking skills" },
    { id: "pull-requests", label: "Pull requests" },
    { id: "co-maintainers", label: "Co-maintainers" },
  ]},
  { section: "Reference", items: [
    { id: "cli-reference", label: "CLI reference" },
    { id: "api-reference", label: "API reference" },
    { id: "frontmatter", label: "Frontmatter schema" },
    { id: "review-process", label: "Review process" },
    { id: "trust-score", label: "Trust & quality scores" },
  ]},
];

const CONTENT = {
  "intro": {
    title: "What is /skiyu?",
    breadcrumb: "Getting started",
    body: [
      { type: "p", text: "/skiyu is the open marketplace where AI engineers discover, share, and sell Claude skills. A skill is a self-contained instruction package that extends what Claude can do — from generating PDFs and reviewing code to building data pipelines and drafting legal contracts." },
      { type: "p", text: "Think of it as npm for AI workflows. You install a skill, and Claude immediately gains new capabilities." },
      { type: "heading", text: "What you can do" },
      { type: "p", text: "As a consumer, you can browse thousands of skills, install them with a single command, and combine them into powerful chains. As a publisher, you can package your best Claude workflows into reusable skills and share them with the world — for free or for profit." },
      { type: "heading", text: "How skills work" },
      { type: "p", text: "A skill is a .skill file (a ZIP archive) containing a SKILL.md instruction file and optional scripts, references, and assets. When installed, Claude reads the SKILL.md to understand new capabilities and follows its instructions to complete tasks." },
      { type: "code", lang: "text", text: "my-skill/\n├── SKILL.md          ← Instructions for Claude\n├── scripts/          ← Optional automation scripts\n├── references/       ← Optional documentation\n├── assets/           ← Optional templates, fonts, icons\n├── tests/            ← Optional test cases\n└── LICENSE.txt       ← Recommended" },
      { type: "heading", text: "Key concepts" },
      { type: "def", term: "Skill", desc: "A packaged set of instructions and tools that teach Claude a new capability." },
      { type: "def", term: "Publisher", desc: "Anyone who creates and shares skills on /skiyu. Can be an individual or a team." },
      { type: "def", term: "Skill chain", desc: "Multiple skills wired together into a pipeline. Each skill's output feeds the next." },
      { type: "def", term: "Trust score", desc: "A composite score (0–100) reflecting a publisher's reliability based on ratings, installs, and history." },
      { type: "callout", variant: "info", text: "Ready to jump in? Follow the Quickstart guide to install your first skill in under 5 minutes." },
    ]
  },
  "quickstart": {
    title: "Quickstart (5 min)",
    breadcrumb: "Getting started",
    body: [
      { type: "p", text: "Get up and running with /skiyu in five minutes. By the end, you'll have the CLI installed and your first skill running." },
      { type: "step", num: "1", title: "Install the CLI", text: "Install the skiyu CLI globally using npm. Requires Node.js 18 or later." },
      { type: "code", lang: "bash", text: "npm install -g skiyu" },
      { type: "step", num: "2", title: "Authenticate", text: "Log in with your /skiyu account. This opens a browser window to complete authentication." },
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
    breadcrumb: "Using skills",
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
      { type: "callout", variant: "info", text: "Purchased skills remain in your account even after uninstalling. You can reinstall them anytime without repurchasing." },
    ]
  },
  "withdrawals": {
    title: "Withdrawals & payouts",
    breadcrumb: "Monetization",
    body: [
      { type: "p", text: "When users purchase your skills, revenue accumulates in your /skiyu publisher balance. You can withdraw your earnings to your bank account via Stripe at any time." },
      { type: "heading", text: "How payouts work" },
      { type: "p", text: "You keep 85% of every sale. The remaining 15% covers payment processing, hosting, and platform operations. Your share is calculated after any refunds and chargebacks." },
      { type: "def", term: "Publisher share", desc: "85% of net revenue (after Stripe processing fees of ~2.9% + $0.30 per transaction)." },
      { type: "def", term: "Platform fee", desc: "15% retained by /skiyu for infrastructure, review, and support." },
      { type: "def", term: "Hold period", desc: "Funds become available for withdrawal 7 days after each sale to allow for refund requests." },
      { type: "heading", text: "Withdrawing funds" },
      { type: "p", text: "You can withdraw from the Publish dashboard or via the CLI." },
      { type: "code", lang: "bash", text: "# Check your balance\nskiyu balance\n\n# Withdraw all available funds\nskiyu withdraw\n\n# Withdraw a specific amount\nskiyu withdraw --amount 250.00" },
      { type: "p", text: "From the web dashboard, navigate to Publish → Revenue and click \"Withdraw to Stripe.\" Funds typically arrive in your bank account within 2–3 business days." },
      { type: "heading", text: "Minimum withdrawal" },
      { type: "p", text: "The minimum withdrawal amount is $10.00. There is no maximum. You can withdraw as often as you like — there are no fees on withdrawals." },
      { type: "heading", text: "Automatic payouts" },
      { type: "p", text: "You can enable automatic payouts to receive your balance on a schedule." },
      { type: "code", lang: "bash", text: "# Enable weekly automatic payouts\nskiyu config set payout.auto weekly\n\n# Options: weekly, biweekly, monthly, manual\nskiyu config set payout.auto monthly" },
      { type: "heading", text: "Revenue from skill chains" },
      { type: "p", text: "When your skill is used as a component in a skill chain, you earn a proportional share of the chain's revenue based on usage. These earnings appear as \"Chain revenue\" in your dashboard and follow the same withdrawal process." },
      { type: "callout", variant: "tip", text: "Set up automatic payouts so you never have to think about withdrawals. Most publishers use the monthly option." },
    ]
  },
  "pricing-models": {
    title: "Pricing models",
    breadcrumb: "Monetization",
    body: [
      { type: "p", text: "/skiyu offers four pricing models so you can choose the one that fits your skill and audience best." },
      { type: "heading", text: "Free" },
      { type: "p", text: "Your skill is available to everyone at no cost. Great for building reputation, gaining installs, and contributing to the community. Free skills can still accept tips from users." },
      { type: "heading", text: "One-time purchase" },
      { type: "p", text: "Users pay once and get permanent access, including all future updates. Best for polished, complete skills that don't require ongoing maintenance." },
      { type: "code", lang: "yaml", text: "# In your SKILL.md frontmatter\npricing:\n  model: one-time\n  amount: 9.99\n  currency: USD" },
      { type: "heading", text: "Pay-per-run" },
      { type: "p", text: "Users pay a small amount each time the skill is executed. No upfront cost means zero friction to try. Best for skills that deliver clear, measurable value on each run." },
      { type: "code", lang: "yaml", text: "pricing:\n  model: per-run\n  amount: 0.05\n  currency: USD" },
      { type: "p", text: "/skiyu handles metering automatically. Users see their estimated cost before confirming a run and can set monthly spending caps." },
      { type: "heading", text: "Subscription" },
      { type: "p", text: "Monthly or annual recurring payment for access. Best for skills with ongoing updates, premium support, or access to evolving reference data." },
      { type: "code", lang: "yaml", text: "pricing:\n  model: subscription\n  monthly: 4.99\n  annual: 49.99\n  currency: USD" },
      { type: "callout", variant: "tip", text: "Not sure which model to pick? Start with Free to build installs and reputation, then introduce a paid tier later. You can change pricing at any time — existing users are grandfathered at their original price." },
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
      { type: "cmd", name: "skiyu login", desc: "Authenticate with your /skiyu account. Opens a browser for OAuth." },
      { type: "cmd", name: "skiyu logout", desc: "Clear stored credentials." },
      { type: "cmd", name: "skiyu whoami", desc: "Print the currently authenticated user." },
      { type: "heading", text: "Consuming skills" },
      { type: "cmd", name: "skiyu install <skill>", desc: "Install a skill. Accepts @author/name, @author/name@version, or a local .skill file path." },
      { type: "cmd", name: "skiyu uninstall <skill>", desc: "Remove an installed skill." },
      { type: "cmd", name: "skiyu update [skill]", desc: "Update one or all installed skills to the latest version." },
      { type: "cmd", name: "skiyu list", desc: "List all installed skills with version and status." },
      { type: "cmd", name: "skiyu info <skill>", desc: "Show detail about a skill — description, version, author, dependencies." },
      { type: "cmd", name: "skiyu search <query>", desc: "Search the marketplace. Supports filters: --category, --price, --sort." },
      { type: "cmd", name: "skiyu trending", desc: "Show trending skills this week." },
      { type: "cmd", name: "skiyu pin <skill@version>", desc: "Pin a skill to a specific version, skipping auto-updates." },
      { type: "heading", text: "Publishing" },
      { type: "cmd", name: "skiyu init", desc: "Scaffold a new skill project in the current directory." },
      { type: "cmd", name: "skiyu validate [path]", desc: "Validate a skill package. Checks structure, frontmatter, and runs linting." },
      { type: "cmd", name: "skiyu test [path]", desc: "Run the skill's test suite in a sandboxed environment." },
      { type: "cmd", name: "skiyu publish [path]", desc: "Package and publish a skill to /skiyu. Runs validation first." },
      { type: "cmd", name: "skiyu unpublish <skill@version>", desc: "Deprecate a specific version (does not delete — existing installs continue working)." },
      { type: "heading", text: "Monetization" },
      { type: "cmd", name: "skiyu balance", desc: "Show your current publisher balance and pending amounts." },
      { type: "cmd", name: "skiyu withdraw [--amount N]", desc: "Withdraw earnings to your connected Stripe account." },
      { type: "cmd", name: "skiyu config set payout.auto <schedule>", desc: "Set automatic payout schedule: weekly, biweekly, monthly, or manual." },
    ]
  },
};

const DEFAULT_PAGE = "intro";

export default function Docs() {
  const [active, setActive] = useState(DEFAULT_PAGE);
  const [search, setSearch] = useState("");
  const [expandedSections, setExpandedSections] = useState(
    Object.fromEntries(DOCS_TREE.map(s => [s.section, true]))
  );
  const contentRef = useRef(null);

  const M = "'IBM Plex Mono', monospace";
  const S = "'Syne', sans-serif";

  const page = CONTENT[active] || CONTENT[DEFAULT_PAGE];

  const toggleSection = (section) => {
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

  const renderBlock = (block, i) => {
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
      case "callout":
        const isInfo = block.variant === "info";
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
      default:
        return null;
    }
  };

  return (
    <div style={{ background: "#000", color: "#fff", minHeight: "100vh", fontFamily: S }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
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
          <svg width="70" height="18" viewBox="0 0 70 18" style={{ display: "block" }}>
            <line x1="3" y1="16" x2="11" y2="2" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            <text x="16" y="15" fontFamily="'Syne', sans-serif" fontSize="15" fontWeight="700" fill="#fff" letterSpacing="-0.4">skiyu</text>
          </svg>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontFamily: M }}>/docs</span>
        </div>
        <div style={{ display: "flex", gap: 20, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
          {["Explore", "Publish", "Docs", "Pricing"].map(l => (
            <span key={l} className="nav-link" style={{ color: l === "Docs" ? "#fff" : undefined, fontWeight: l === "Docs" ? 600 : 400 }}>{l}</span>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="nav-link" style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Sign in</span>
        </div>
      </nav>

      <div style={{ display: "flex", maxWidth: 1100, margin: "0 auto", paddingTop: 56 }}>

        {/* SIDEBAR */}
        <aside style={{
          width: 240, flexShrink: 0,
          borderRight: "1px solid rgba(255,255,255,0.04)",
          position: "fixed", top: 56, left: "max(0px, calc((100vw - 1100px)/2))",
          width: 240, height: "calc(100vh - 56px)", overflowY: "auto",
          padding: "16px 16px 40px",
        }}>
          {/* search */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 7, padding: "0 10px", marginBottom: 20,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search docs..."
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 12, padding: "8px 0", fontFamily: S }}
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
                  onClick={() => setActive(item.id)}
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
          {/* breadcrumb */}
          <div style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.15)", letterSpacing: "0.06em", marginBottom: 8 }}>
            <span style={{ cursor: "pointer" }} onClick={() => setActive("intro")}>Docs</span>
            <span style={{ margin: "0 6px" }}>/</span>
            <span>{page.breadcrumb}</span>
          </div>

          {/* title */}
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>
            {page.title}
          </h1>

          {/* divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 28 }} />

          {/* body */}
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

          {/* footer */}
          <div style={{ marginTop: 40, padding: "20px 0", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <svg width="50" height="14" viewBox="0 0 50 14" style={{ opacity: 0.12 }}>
              <line x1="2" y1="12" x2="8" y2="2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
              <text x="12" y="12" fontFamily="'Syne', sans-serif" fontSize="11" fontWeight="600" fill="#fff" letterSpacing="-0.2">skiyu</text>
            </svg>
            <span style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.08)" }}>
              Found an error? Edit this page on GitHub →
            </span>
          </div>
        </main>
      </div>
    </div>
  );
}
