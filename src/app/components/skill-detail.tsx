import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useSkillBySlug, downloadSkill } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import NavAuth from "./nav-auth";
import Wordmark from "./wordmark";
import { preloadRoute } from "../routes";

const F = "'Erode', 'Cormorant Garamond', Georgia, serif";
const M = "'Fragment Mono', 'JetBrains Mono', Menlo, monospace";

// ── tiny presentational helpers used on this page only ──

function Kicker({
  children,
  size = 11,
}: {
  children: React.ReactNode;
  size?: number;
}) {
  return (
    <span
      style={{
        fontFamily: M,
        fontSize: size,
        fontWeight: 600,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: "rgba(255, 255, 255, 0.25)",
      }}
    >
      {children}
    </span>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: "14px 16px",
        background: "#000",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        borderRadius: 8,
        fontFamily: M,
        fontSize: 12,
        color: "#fff",
        overflow: "auto",
        userSelect: "all",
      }}
    >
      {children}
    </pre>
  );
}

/* Same shell pattern as other pages: sticky nav with the wordmark and
 * the avatar dropdown. We don't import Home's nav because Home's nav
 * has marketing-page chrome that doesn't fit here. */
function Shell({ children, route }: { children: React.ReactNode; route: string }) {
  const navigate = useNavigate();
  return (
    <div style={{ background: "#000", color: "#fff", minHeight: "100vh", fontFamily: F }}>
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          height: 56,
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(0, 0, 0, 0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Wordmark size={20} clickable />
          <span style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.40)", fontFamily: M }}>
            {route}
          </span>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          {[
            { label: "Explore", path: "/explore" as const },
            { label: "Publish", path: "/publish" as const },
            { label: "Docs", path: "/docs" as const },
          ].map((l) => (
            <span
              key={l.label}
              role="link"
              tabIndex={0}
              onClick={() => navigate(l.path)}
              onMouseEnter={() => preloadRoute[l.path]?.()}
              onFocus={() => preloadRoute[l.path]?.()}
              style={{
                fontFamily: F,
                fontStyle: "italic",
                fontSize: 13,
                fontWeight: 400,
                color: "rgba(255, 255, 255, 0.40)",
                cursor: "pointer",
              }}
            >
              {l.label}
            </span>
          ))}
        </div>
        <NavAuth />
      </nav>
      <main id="main-content">{children}</main>
    </div>
  );
}

/* ── the detail page itself ─────────────────────────────── */

export default function SkillDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading } = useSkillBySlug(slug);

  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reflect the skill name in the document title.
  useEffect(() => {
    if (data?.skill) {
      document.title = `${data.skill.name} — skiyu`;
    } else if (slug) {
      document.title = `${slug} — skiyu`;
    }
    return () => {
      document.title = "skiyu";
    };
  }, [data?.skill, slug]);

  const cmd = data?.skill
    ? `claude code skills add @${data.skill.author_username ?? "anon"}/${data.skill.slug}`
    : "";

  const handleCopy = useCallback(async () => {
    if (!cmd) return;
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Couldn't copy. Select the command above and copy it manually.");
      window.setTimeout(() => setError(null), 4000);
    }
  }, [cmd]);

  const handleZip = useCallback(async () => {
    if (!data?.skill || downloading) return;
    setDownloading(true);
    const res = await downloadSkill(data.skill.id, data.skill.name, user?.id);
    if (!res.success) {
      setError(res.error ?? "Download failed");
      window.setTimeout(() => setError(null), 4000);
    }
    window.setTimeout(() => setDownloading(false), 1200);
  }, [data?.skill, downloading, user?.id]);

  // ── loading + 404 states ──
  if (loading) {
    return (
      <Shell route={`/skills/${slug ?? ""}`}>
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "120px 48px",
            color: "rgba(255, 255, 255, 0.40)",
            fontFamily: M,
            fontSize: 13,
          }}
        >
          Loading…
        </div>
      </Shell>
    );
  }

  if (!data?.skill) {
    return (
      <Shell route={`/skills/${slug ?? ""}`}>
        <div
          style={{
            maxWidth: 700,
            margin: "0 auto",
            padding: "140px 48px",
            textAlign: "center",
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <Kicker>404 · not found</Kicker>
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: F,
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: 40,
              letterSpacing: "-0.025em",
            }}
          >
            No skill named <span style={{ color: "rgba(255, 255, 255, 0.40)" }}>{slug}</span>.
          </h1>
          <p
            style={{
              marginTop: 18,
              fontFamily: F,
              fontStyle: "italic",
              fontSize: 16,
              color: "rgba(255, 255, 255, 0.60)",
            }}
          >
            It may have been renamed, removed, or it never existed.
          </p>
          <button
            type="button"
            onClick={() => navigate("/explore")}
            onMouseEnter={() => preloadRoute["/explore"]?.()}
            style={{
              marginTop: 28,
              padding: "10px 22px",
              background: "rgba(255, 255, 255, 0.04)",
              color: "#fff",
              border: "1px solid rgba(255, 255, 255, 0.10)",
              borderRadius: 6,
              fontFamily: M,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.04em",
              cursor: "pointer",
            }}
          >
            Browse skills
          </button>
        </div>
      </Shell>
    );
  }

  const { skill } = data;
  const license = skill.github_license || "no license";

  return (
    <Shell route={`/skills/${skill.slug}`}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 48px 80px" }}>
        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <Kicker>
            {skill.category_slug ?? "general"} · skill
          </Kicker>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, margin: "14px 0 0" }}>
            <h1
              style={{
                fontFamily: F,
                fontStyle: "italic",
                fontWeight: 700,
                fontSize: 64,
                letterSpacing: "-0.04em",
                lineHeight: 1,
                margin: 0,
              }}
            >
              <span style={{ fontWeight: 400, marginRight: "0.18em" }}>/</span>
              {skill.name}
            </h1>
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: 14,
                height: 48,
                background: "#fff",
                marginLeft: 10,
                animation: "ski-cursor-blink 1.1s linear infinite",
                alignSelf: "flex-end",
                marginBottom: 4,
              }}
            />
          </div>
          <div
            style={{
              marginTop: 16,
              fontFamily: M,
              fontSize: 12,
              color: "rgba(255, 255, 255, 0.40)",
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span>@{skill.author_username ?? "anon"}</span>
            <span style={{ color: "rgba(255, 255, 255, 0.25)" }}>·</span>
            <span>{license}</span>
            <span style={{ color: "rgba(255, 255, 255, 0.25)" }}>·</span>
            <span>updated {formatRelative(skill.updated_at)}</span>
            {skill.is_claimed && (
              <>
                <span style={{ color: "rgba(255, 255, 255, 0.25)" }}>·</span>
                <span style={{ color: "rgba(255, 255, 255, 0.60)" }}>verified author</span>
              </>
            )}
          </div>
          {skill.description && (
            <p
              style={{
                marginTop: 24,
                fontFamily: F,
                fontStyle: "italic",
                fontSize: 17,
                lineHeight: 1.55,
                color: "rgba(255, 255, 255, 0.60)",
                maxWidth: 600,
                textWrap: "pretty" as never,
              }}
            >
              {skill.description}
            </p>
          )}
        </div>

        {/* Two-column install + at-a-glance */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 360px",
            gap: 36,
            alignItems: "start",
            marginBottom: 64,
          }}
        >
          {/* INSTALL CARD */}
          <section
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: 10,
              padding: "24px 28px",
            }}
          >
            <Kicker>INSTALL</Kicker>
            <p
              style={{
                margin: "14px 0 12px",
                fontFamily: F,
                fontStyle: "italic",
                fontSize: 14,
                color: "rgba(255, 255, 255, 0.60)",
              }}
            >
              Paste in your terminal:
            </p>
            <CodeBlock>{cmd}</CodeBlock>
            {error && (
              <div
                style={{
                  marginTop: 12,
                  fontFamily: M,
                  fontSize: 12,
                  color: "#fca5a5",
                }}
              >
                {error}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  padding: "10px 16px",
                  background: "#fff",
                  color: "#000",
                  border: "1px solid rgba(255, 255, 255, 0.10)",
                  borderRadius: 6,
                  fontFamily: M,
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  cursor: "pointer",
                }}
              >
                {copied ? "✓ Copied — paste to deploy" : "Copy command"}
              </button>
              <button
                type="button"
                onClick={handleZip}
                disabled={downloading}
                style={{
                  padding: "10px 16px",
                  background: "rgba(255, 255, 255, 0.04)",
                  color: downloading ? "rgba(255, 255, 255, 0.40)" : "#fff",
                  border: "1px solid rgba(255, 255, 255, 0.10)",
                  borderRadius: 6,
                  fontFamily: M,
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  cursor: downloading ? "wait" : "pointer",
                }}
              >
                {downloading ? "↓ …" : "↓ Download .zip"}
              </button>
            </div>
            <div
              style={{
                marginTop: 20,
                paddingTop: 16,
                borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                fontFamily: F,
                fontStyle: "italic",
                fontSize: 13,
                color: "rgba(255, 255, 255, 0.40)",
              }}
            >
              Don't have Claude Code?{" "}
              <a
                href="https://docs.claude.com/code"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "#fff",
                  textDecoration: "none",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.10)",
                }}
              >
                Install it from docs.claude.com/code →
              </a>
            </div>
          </section>

          {/* AT A GLANCE */}
          <aside
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: 10,
              padding: "24px 28px",
            }}
          >
            <Kicker>AT A GLANCE</Kicker>
            <div
              style={{
                marginTop: 16,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <Row k="license" v={license} />
              <Row k="last published" v={formatRelative(skill.updated_at)} />
              {skill.compatibility?.length > 0 && (
                <Row k="compatibility" v={skill.compatibility.join(" · ")} />
              )}
              {skill.github_repo && (
                <Row
                  k="source"
                  v={
                    <a
                      href={skill.github_url ?? `https://github.com/${skill.github_repo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#fff", textDecoration: "none" }}
                    >
                      {skill.github_repo} ↗
                    </a>
                  }
                />
              )}
              {typeof skill.github_stars === "number" && skill.github_stars > 0 && (
                <Row k="github stars" v={skill.github_stars.toLocaleString()} />
              )}
              {skill.github_language && (
                <Row k="language" v={skill.github_language} />
              )}
            </div>
          </aside>
        </div>

        {/* Prose sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: 48, maxWidth: 700 }}>
          {skill.description && (
            <section>
              <Kicker>WHAT IT DOES</Kicker>
              <p
                style={{
                  marginTop: 12,
                  fontFamily: F,
                  fontStyle: "italic",
                  fontSize: 16,
                  lineHeight: 1.6,
                  color: "rgba(255, 255, 255, 0.60)",
                  textWrap: "pretty" as never,
                }}
              >
                {skill.description}
              </p>
            </section>
          )}

          {skill.audience && (
            <section>
              <Kicker>WHO IT'S FOR</Kicker>
              <p
                style={{
                  marginTop: 12,
                  fontFamily: F,
                  fontStyle: "italic",
                  fontSize: 16,
                  lineHeight: 1.6,
                  color: "rgba(255, 255, 255, 0.60)",
                  textWrap: "pretty" as never,
                }}
              >
                {skill.audience}
              </p>
            </section>
          )}

          {skill.does_not_do && (
            <section>
              <Kicker>WHAT IT DOESN'T DO</Kicker>
              <p
                style={{
                  marginTop: 12,
                  fontFamily: F,
                  fontStyle: "italic",
                  fontSize: 16,
                  lineHeight: 1.6,
                  color: "rgba(255, 255, 255, 0.60)",
                  textWrap: "pretty" as never,
                }}
              >
                {skill.does_not_do}
              </p>
            </section>
          )}

          {/* Allowed tools, derived from frontmatter when present */}
          <AllowedTools frontmatter={data.frontmatter} />

          <section>
            <Link
              to="/explore"
              onMouseEnter={() => preloadRoute["/explore"]?.()}
              style={{
                fontFamily: M,
                fontSize: 13,
                color: "#fff",
                textDecoration: "none",
                borderBottom: "1px solid rgba(255, 255, 255, 0.10)",
                paddingBottom: 2,
              }}
            >
              ← back to all skills
            </Link>
          </section>
        </div>
      </div>
    </Shell>
  );
}

// ── ancillaries ─────────────────────────────────────────────

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        fontFamily: M,
        fontSize: 12,
      }}
    >
      <span style={{ color: "rgba(255, 255, 255, 0.40)" }}>{k}</span>
      <span style={{ color: "#fff", textAlign: "right" }}>{v}</span>
    </div>
  );
}

/** Surface allowed tools from the SKILL.md frontmatter when present.
 *  This is the only place we show "what permissions this skill needs."
 *  It's a static declaration the author makes — not runtime measurement. */
function AllowedTools({ frontmatter }: { frontmatter: Record<string, unknown> | null }) {
  const tools = extractAllowedTools(frontmatter);
  if (tools.length === 0) return null;
  return (
    <section>
      <Kicker>ALLOWED TOOLS</Kicker>
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        {tools.map((t) => (
          <div
            key={t}
            style={{
              display: "grid",
              gridTemplateColumns: "120px 1fr",
              gap: 16,
              alignItems: "baseline",
            }}
          >
            <span style={{ fontFamily: M, fontSize: 13, color: "#fff" }}>{t}</span>
            <span
              style={{
                fontFamily: F,
                fontStyle: "italic",
                fontSize: 14,
                color: "rgba(255, 255, 255, 0.60)",
              }}
            >
              {describeTool(t)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function extractAllowedTools(fm: Record<string, unknown> | null): string[] {
  if (!fm) return [];
  const raw =
    (fm["allowed-tools"] as unknown) ??
    (fm["allowed_tools"] as unknown) ??
    (fm["tools"] as unknown);
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string");
  }
  if (typeof raw === "string") {
    return raw
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/** Plain-language descriptions for the tool names skills commonly declare.
 *  Unknown tools render with a neutral fallback rather than nothing. */
function describeTool(name: string): string {
  const k = name.toLowerCase();
  if (k.includes("file") || k === "fs" || k === "read" || k === "write")
    return "Read or write files on the local filesystem.";
  if (k.includes("http") || k.includes("fetch") || k.includes("net"))
    return "Make outbound HTTP requests to declared hosts.";
  if (k.includes("shell") || k.includes("bash") || k.includes("exec"))
    return "Execute shell commands inside the runtime sandbox.";
  if (k.includes("python") || k === "py") return "Run Python code.";
  if (k.includes("node") || k === "js") return "Run JavaScript code.";
  if (k.includes("search") || k.includes("web"))
    return "Search the web for results matching a query.";
  if (k.includes("memory") || k.includes("kv"))
    return "Read or write to a key-value store scoped to this skill.";
  return "Custom tool declared by the skill author.";
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "recently";
  const sec = Math.max(0, (Date.now() - then) / 1000);
  if (sec < 60) return "just now";
  const min = sec / 60;
  if (min < 60) return `${Math.floor(min)}m ago`;
  const hr = min / 60;
  if (hr < 24) return `${Math.floor(hr)}h ago`;
  const day = hr / 24;
  if (day < 7) return `${Math.floor(day)}d ago`;
  const week = day / 7;
  if (week < 4.3) return `${Math.floor(week)}w ago`;
  const mo = day / 30;
  if (mo < 12) return `${Math.floor(mo)}mo ago`;
  return new Date(iso).getFullYear().toString();
}
