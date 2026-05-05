import { useState } from "react";
import { useNavigate } from "react-router";
import NavAuth from "./nav-auth";
import Wordmark from "./wordmark";
import { useIsMobile } from "./ui/use-mobile";
import { preloadRoute } from "../routes";

const M = "'Fragment Mono', monospace";
const F = "'Erode', serif";

const DOCS_TREE = [
  { section: "Getting started", items: [
    { id: "intro", label: "What is skiyu?" },
    { id: "quickstart", label: "Quickstart" },
  ]},
  { section: "Using skiyu", items: [
    { id: "finding", label: "Finding skills" },
    { id: "authoring", label: "Authoring skills" },
    { id: "publishing", label: "Publishing skills" },
  ]},
  { section: "Deploying", items: [
    { id: "mcp-server", label: "MCP Server" },
    { id: "playwright", label: "Playwright CLI" },
    { id: "download", label: "Download & install" },
  ]},
  { section: "Reference", items: [
    { id: "skillmd", label: "SKILL.md format" },
    { id: "api", label: "API reference" },
  ]},
  { section: "Coming soon", items: [
    { id: "skill-chains", label: "Skill Chain" },
  ]},
];

type Block = { type: string; text?: string; };

const CONTENT: Record<string, { title: string; body: Block[] }> = {
  "intro": {
    title: "What is skiyu?",
    body: [
      { type: "p", text: "skiyu is the world's first skill engineering platform. It's where engineers find, author, and deploy Claude skills — all from one place." },
      { type: "p", text: "A skill is a SKILL.md file: a set of instructions that tells Claude how to perform a specific task. Code reviews, security audits, landing page generation, market analysis — each one is a skill." },
      { type: "h", text: "Three things skiyu does" },
      { type: "p", text: "Find skills. The catalog has 1,091 skills across 12 categories, all searchable from the homepage chat or the explore page. Every skill has quality scores, risk signals, input/output types, and capabilities metadata." },
      { type: "p", text: "Author skills. Describe what you want to build in the chat and skiyu drafts the SKILL.md for you. Refine it through conversation, then download or publish when it's ready." },
      { type: "p", text: "Deploy skills. Connect skiyu's MCP server to Claude once, and every skill in the catalog is available in any conversation. Or download the zip and install it manually." },
      { type: "h", text: "How it's different" },
      { type: "p", text: "Most skill directories are static lists you browse. skiyu is a platform where you can search by asking natural language questions, author skills through a chat interface, deploy to Claude with zero uploads, and iterate on skills in a single session." },
      { type: "p", text: "Think of it as npm for agent instructions. You don't browse npm's website to install packages — you tell npm what you need and it gets it. skiyu does the same for skills." },
    ],
  },
  "quickstart": {
    title: "Quickstart",
    body: [
      { type: "p", text: "There are three ways to start using skiyu, depending on what you need." },
      { type: "h", text: "1. Find and use a skill (30 seconds)" },
      { type: "p", text: "Go to skiyu.dev and type what you need in the chat. For example: \"Find me a skill for code review.\" skiyu searches the catalog and shows matching skills as clickable cards. Click one to see details, download, or view the full skill page." },
      { type: "h", text: "2. Connect skiyu to Claude (30 seconds)" },
      { type: "p", text: "Go to claude.ai, then Settings, then Connectors, then Add. Paste this URL:" },
      { type: "code", text: "https://mkqiqkqgnywosbneibqx.supabase.co/functions/v1/skiyu-mcp" },
      { type: "p", text: "That's it. Now in any Claude conversation, you can say: \"Use the website-cloner skill from skiyu\" and Claude will call skiyu's API, get the skill, and follow its instructions." },
      { type: "h", text: "3. Author a new skill (2 minutes)" },
      { type: "p", text: "On the homepage, type: \"I want to build a skill that does market analysis.\" skiyu will ask you a few questions, then generate a complete SKILL.md. You'll get buttons to download it as a zip, publish it to the marketplace, or test it — all without leaving the chat." },
    ],
  },
  "finding": {
    title: "Finding skills",
    body: [
      { type: "p", text: "There are three ways to find skills on skiyu." },
      { type: "h", text: "Homepage chat" },
      { type: "p", text: "Type a natural language query like \"Find me a skill for security auditing\" or \"Show me skills for DevOps.\" skiyu searches the catalog directly and shows results as compact cards. Click a card to see full details, download, or view the skill page." },
      { type: "h", text: "Explore page" },
      { type: "p", text: "Browse the full catalog at skiyu.dev/explore. Filter by category (Security, Backend, DevOps, Testing, etc.), sort by quality score or update date, and search by keyword. Every skill card shows the name, author, category, license, and description." },
      { type: "h", text: "MCP Server" },
      { type: "p", text: "If you've connected skiyu to Claude, you can search from any Claude conversation. Say: \"Search skiyu for testing skills\" and Claude calls the skiyu_search tool, returning results with quality scores, risk levels, and capabilities." },
      { type: "h", text: "Skill metadata" },
      { type: "p", text: "Every skill in the catalog has structured metadata: tags, capabilities (generate, analyze, test, deploy, etc.), input type (text, url, file, code, repo), output type (text, report, tests, config, html, code), quality score (45-95), risk level (low/medium/high), risk signals (executes code, network access, file system, etc.), and maturity (experimental/stable/production)." },
    ],
  },
  "authoring": {
    title: "Authoring skills",
    body: [
      { type: "p", text: "skiyu helps you write skills through a conversational interface. You describe what you want, skiyu asks clarifying questions, then generates the complete SKILL.md." },
      { type: "h", text: "The authoring flow" },
      { type: "p", text: "On the homepage, type something like: \"I want to build a skill that reviews Python code for security vulnerabilities.\" skiyu will ask what kind of review (OWASP top 10, dependency scanning, code patterns), what depth, and what output format. After you answer, it generates the full SKILL.md with frontmatter, instructions, and examples." },
      { type: "h", text: "After generation" },
      { type: "p", text: "Once the skill is generated, you'll see action buttons below the chat input: Download as .zip (browser download with correct folder structure), Publish to marketplace (goes to the publish page), Test skill (asks skiyu to demonstrate it), and Make changes (continues the conversation to iterate)." },
      { type: "h", text: "Iteration" },
      { type: "p", text: "Skills rarely come out perfect on the first try. Click \"Make changes\" to refine the instructions, add edge cases, adjust the output format, or narrow the scope. skiyu remembers the conversation and generates an updated SKILL.md." },
      { type: "h", text: "SKILL.md structure" },
      { type: "p", text: "Every skill is a single SKILL.md file with YAML frontmatter (name, description, version, allowed_tools) followed by markdown instructions. The instructions tell Claude exactly what to do when the skill is activated. See the SKILL.md format reference for the full specification." },
    ],
  },
  "publishing": {
    title: "Publishing skills",
    body: [
      { type: "p", text: "There are three ways to publish a skill to skiyu's catalog." },
      { type: "h", text: "Upload a zip" },
      { type: "p", text: "Go to skiyu.dev/publish, click \"+ New Skill\", and drag a .zip file containing a SKILL.md. skiyu automatically extracts the name and description from the frontmatter. You can optionally edit the description before publishing. The skill goes to your dashboard as \"pending\" and will be reviewed before appearing in the catalog." },
      { type: "h", text: "Import from GitHub" },
      { type: "p", text: "On the publish page, click the \"Import from GitHub\" tab. Paste your repo URL and skiyu scans it for SKILL.md files. You'll see a preview of each one and can import with a single click. This is useful if you already have skills in your repo." },
      { type: "h", text: "Author and publish" },
      { type: "p", text: "Author a skill in the homepage chat, click \"Download .zip\", then upload it on the publish page. The entire flow — from idea to published skill — takes about 5 minutes." },
      { type: "h", text: "Your dashboard" },
      { type: "p", text: "The publish page shows your skills in the \"My Skills\" tab: claimed skills from the catalog (if you're an existing author) and uploaded skills with their review status (pending, approved, rejected). You can also see install counts, runs, and ratings." },
    ],
  },
  "mcp-server": {
    title: "MCP Server",
    body: [
      { type: "p", text: "The MCP server is skiyu's primary deployment path. Connect it once to Claude, and every skill in the catalog is available without downloads or uploads." },
      { type: "h", text: "Setup" },
      { type: "p", text: "Go to claude.ai, then Settings, then Connectors, then Add connector. Paste:" },
      { type: "code", text: "https://mkqiqkqgnywosbneibqx.supabase.co/functions/v1/skiyu-mcp" },
      { type: "p", text: "Save it. That's the entire setup. Takes about 30 seconds." },
      { type: "h", text: "How it works" },
      { type: "p", text: "When you mention a skiyu skill in any Claude conversation, Claude calls skiyu's MCP server to search the catalog, get skill details, or load the full SKILL.md instructions. Claude then follows those instructions for your task." },
      { type: "h", text: "Available tools" },
      { type: "p", text: "The MCP server exposes four tools to Claude: skiyu_search (search the catalog by keyword, capability, input type, or risk level), skiyu_details (get full details for a skill by slug), skiyu_get_skill (load the complete SKILL.md for Claude to follow), and skiyu_catalog (browse featured and popular skills by category)." },
      { type: "h", text: "Example usage" },
      { type: "p", text: "In any Claude conversation after connecting: \"Use the website-cloner skill from skiyu to clone stripe.com\" or \"Search skiyu for low-risk testing skills that take a repo as input\" or \"What skills does skiyu have for DevOps?\"" },
      { type: "h", text: "Discovery endpoint" },
      { type: "p", text: "GET the MCP URL in a browser to see server info, available tools, and full catalog statistics including capability distribution, risk levels, and input/output type breakdowns." },
    ],
  },
  "playwright": {
    title: "Playwright CLI deployment",
    body: [
      { type: "p", text: "For users who want skills permanently in their Claude Settings page, the skiyu-deploy skill uses Playwright CLI to automate the upload." },
      { type: "h", text: "How it works" },
      { type: "p", text: "The skiyu-deploy skill runs in Claude Code on your local machine. It downloads the skill zip from skiyu's API, then uses Playwright CLI to open claude.ai/settings/skills in your browser (where you're already logged in), upload the zip, and confirm. The entire process takes 3-5 seconds." },
      { type: "h", text: "Why it's fast" },
      { type: "p", text: "Unlike cloud browser automation (which requires new login sessions and costs money), Playwright CLI runs in your own browser where you're already authenticated. No API keys, no cloud services, no monthly costs." },
      { type: "h", text: "Setup" },
      { type: "p", text: "Install the Playwright CLI:" },
      { type: "code", text: "npm install -g @anthropic-ai/playwright-cli\nnpx playwright install chromium" },
      { type: "p", text: "Then in Claude Code: \"Deploy the website-cloner skill from skiyu.\" Claude loads the skiyu-deploy skill and handles the rest." },
    ],
  },
  "download": {
    title: "Download & manual install",
    body: [
      { type: "p", text: "Every skill on skiyu can be downloaded as a .zip file. This is the simplest deployment method and works everywhere." },
      { type: "h", text: "From the catalog" },
      { type: "p", text: "On any skill card, click the \"Download\" button. The .zip file contains a folder with the SKILL.md file inside." },
      { type: "h", text: "Installing in Claude Code" },
      { type: "p", text: "Unzip the download and place the skill folder in your project's .claude/skills/ directory, or wherever your Claude Code skills are configured." },
      { type: "h", text: "Installing in Claude.ai" },
      { type: "p", text: "Go to claude.ai, then Settings, then Skills. Click \"Create skill\" or \"Add skill\" and upload the zip. The skill will appear in your skills list and be available in all conversations." },
    ],
  },
  "skillmd": {
    title: "SKILL.md format",
    body: [
      { type: "p", text: "Every skill is a single SKILL.md file. It contains YAML frontmatter for metadata, followed by markdown instructions that tell Claude how to behave." },
      { type: "h", text: "Frontmatter" },
      { type: "p", text: "The frontmatter block at the top of the file defines metadata:" },
      { type: "code", text: "---\nname: market-analysis\ndescription: Comprehensive market research and competitive analysis\nversion: 1.0.0\nlicense: MIT\nallowed_tools: bash, write_file, read_file\n---" },
      { type: "p", text: "Required fields: name, description. Optional: version, license, allowed_tools, argument-hint, user-invocable." },
      { type: "h", text: "Instructions" },
      { type: "p", text: "After the frontmatter, write the instructions in markdown. Use headings, lists, and code blocks to structure the skill's behavior. Be specific about what the skill should do, what inputs it expects, what outputs it produces, and how it should handle edge cases." },
      { type: "h", text: "Best practices" },
      { type: "p", text: "Be concrete, not abstract. Instead of \"analyze the code\", say \"check for SQL injection, XSS, and CSRF vulnerabilities in every route handler.\" Include examples of expected input and output. Define what the skill does NOT do (scope boundaries). Specify the output format explicitly." },
    ],
  },
  "api": {
    title: "API reference",
    body: [
      { type: "p", text: "skiyu exposes a public API via the MCP server. All endpoints are available at the base URL:" },
      { type: "code", text: "https://mkqiqkqgnywosbneibqx.supabase.co/functions/v1/skiyu-mcp" },
      { type: "h", text: "GET / — Discovery" },
      { type: "p", text: "Returns server info, available tools, and catalog statistics. No authentication required." },
      { type: "h", text: "POST / — MCP protocol" },
      { type: "p", text: "Accepts JSON-RPC 2.0 requests following the Model Context Protocol specification. Methods: initialize, tools/list, tools/call. No authentication required." },
      { type: "h", text: "Tools" },
      { type: "p", text: "skiyu_search: search by keyword, capability (generate, analyze, test, deploy, transform, document, debug, security, monitor, design, scrape, automate), input_type (text, url, file, code, repo), and risk_level (low, medium, high). Returns up to 25 results with full metadata." },
      { type: "p", text: "skiyu_details: get full details for a skill by slug. Returns description, audience, quality score, risk signals, allowed tools, maturity, and verification status." },
      { type: "p", text: "skiyu_get_skill: load the complete SKILL.md content for a skill. This is what Claude uses to follow the skill's instructions." },
      { type: "p", text: "skiyu_catalog: browse the catalog by category. Returns skills ordered by quality score with full metadata." },
      { type: "h", text: "Zip download" },
      { type: "p", text: "Skills can also be downloaded as zip files via the zip-skill-folder endpoint. This is used internally by the download buttons and the Playwright CLI deployment skill." },
    ],
  },
  "skill-chains": {
    title: "Skill Chain",
    body: [
      { type: "p", text: "Skill Chain is an upcoming feature that lets you combine multiple skills into automated workflows. Instead of using one skill at a time, you'll chain them together: the output of one skill becomes the input of the next." },
      { type: "h", text: "How it will work" },
      { type: "p", text: "You'll define a chain as a sequence of skills with connection rules. For example: a code-reviewer skill runs first and produces a report, then a test-generator skill reads that report and creates tests for the flagged issues, then a documentation skill generates updated docs reflecting the fixes." },
      { type: "h", text: "Use cases" },
      { type: "p", text: "Full security audit pipeline: scan for vulnerabilities, generate fix recommendations, create patches, write tests for each fix. Content production: research a topic, write a draft, review for tone and accuracy, format for publication. DevOps setup: scaffold infrastructure, generate CI/CD config, create monitoring dashboards, write runbook documentation." },
      { type: "h", text: "Status" },
      { type: "p", text: "Skill Chain is currently in design. The MCP server and structured metadata (input/output types, capabilities) are the foundation that makes chaining possible — every skill already declares what it takes as input and what it produces as output. When Skill Chain launches, the catalog will suggest compatible chains based on these declarations." },
    ],
  },
};

export default function Docs() {
  const [active, setActive] = useState("intro");
  const navigate = useNavigate();
  const mobile = useIsMobile();

  const doc = CONTENT[active];
  if (!doc) return null;

  return (
    <div style={{ background: "#000", color: "#fff", minHeight: "100vh", fontFamily: F }}>
      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, height: 56, padding: mobile ? "0 14px" : "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.90)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Wordmark size={20} clickable />
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", display: mobile ? "none" : "flex", gap: 24 }}>
          {[
            { label: "Explore", path: "/explore" as const },
            { label: "Publish", path: "/publish" as const },
            { label: "Docs", path: "/docs" as const },
          ].map(l => (
            <span key={l.label} onClick={() => navigate(l.path)} onMouseEnter={() => preloadRoute[l.path]?.()} tabIndex={0}
              style={{ cursor: "pointer", fontFamily: F, fontStyle: "italic", fontSize: 13, color: l.label === "Docs" ? "#fff" : "rgba(255,255,255,0.40)", fontWeight: l.label === "Docs" ? 600 : 400 }}>{l.label}</span>
          ))}
        </div>
        <NavAuth />
      </nav>

      <div style={{ display: "flex", maxWidth: 1100, margin: "0 auto", paddingTop: mobile ? 0 : 16 }}>
        {/* Sidebar — hidden on mobile, horizontal tabs instead */}
        {mobile ? (
          <div style={{ overflowX: "auto", padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 6, WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
            {DOCS_TREE.flatMap(s => s.items).map(item => (
              <button key={item.id} onClick={() => setActive(item.id)}
                style={{ padding: "6px 12px", borderRadius: 6, border: "none", whiteSpace: "nowrap", background: active === item.id ? "rgba(255,255,255,0.08)" : "transparent", color: active === item.id ? "#fff" : "rgba(255,255,255,0.40)", fontSize: 11, fontFamily: M, cursor: "pointer", fontWeight: active === item.id ? 600 : 400 }}>{item.label}</button>
            ))}
          </div>
        ) : (
          <aside style={{ width: 240, flexShrink: 0, padding: "20px 24px 40px", borderRight: "1px solid rgba(255,255,255,0.04)", position: "sticky", top: 72, height: "calc(100vh - 72px)", overflowY: "auto" }}>
            {DOCS_TREE.map(section => (
              <div key={section.section} style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: M, fontSize: 9, fontWeight: 600, letterSpacing: "0.20em", textTransform: "uppercase", color: "rgba(255,255,255,0.20)", marginBottom: 8 }}>{section.section}</div>
                {section.items.map(item => (
                  <button key={item.id} onClick={() => setActive(item.id)}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 8px", marginBottom: 1, borderRadius: 5, border: "none", background: active === item.id ? "rgba(255,255,255,0.06)" : "transparent", color: active === item.id ? "#fff" : "rgba(255,255,255,0.40)", fontFamily: F, fontSize: 13, cursor: "pointer", fontWeight: active === item.id ? 600 : 400, transition: "all 150ms" }}>{item.label}</button>
                ))}
              </div>
            ))}
          </aside>
        )}

        {/* Content */}
        <main style={{ flex: 1, minWidth: 0, padding: mobile ? "24px 16px 60px" : "24px 48px 80px", maxWidth: 720 }}>
          <h1 style={{ fontFamily: F, fontWeight: 700, fontSize: mobile ? 24 : 32, letterSpacing: "-0.02em", marginBottom: 24, lineHeight: 1.1 }}>{doc.title}</h1>
          {doc.body.map((block, i) => {
            if (block.type === "p") return (
              <p key={i} style={{ fontFamily: F, fontSize: 15, color: "rgba(255,255,255,0.65)", lineHeight: 1.7, marginBottom: 16 }}>{block.text}</p>
            );
            if (block.type === "h") return (
              <h2 key={i} style={{ fontFamily: F, fontWeight: 700, fontSize: mobile ? 17 : 19, color: "#fff", marginTop: 32, marginBottom: 10, letterSpacing: "-0.01em" }}>{block.text}</h2>
            );
            if (block.type === "code") return (
              <pre key={i} style={{ fontFamily: M, fontSize: 12, lineHeight: 1.6, color: "rgba(255,255,255,0.60)", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "14px 16px", marginBottom: 16, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{block.text}</pre>
            );
            return null;
          })}
        </main>
      </div>
    </div>
  );
}
