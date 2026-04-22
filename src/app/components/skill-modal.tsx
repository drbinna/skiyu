import { useEffect, useRef, useState } from "react";
import { useSkillDetail, downloadSkill, formatFileSize } from "@/lib/hooks";
import type { SkillCatalogItem } from "@/lib/types";
import { useAuth } from "@/lib/auth";

const F = "'Erode', serif";
const M = "'Fragment Mono', monospace";

// Marketing vocabulary that descriptions should not contain. Shown as a
// visible flag on the modal so the curation team can triage fast.
const MARKETING_WORDS = [
  "revolutionary",
  "game-changing",
  "best-in-class",
  "next-generation",
  "cutting-edge",
  "world-class",
  "powerful",
  "amazing",
];

// Category → default audience. Falls back to "Developers and AI engineers"
// when neither the frontmatter nor the category provides a hint.
const AUDIENCE_DEFAULTS: Record<string, string> = {
  security: "Security engineers, red teams, and compliance analysts",
  testing: "QA engineers, SDETs, and release teams",
  data: "Data engineers, analysts, and ETL developers",
  frontend: "Frontend engineers and UI designers",
  backend: "Backend and platform engineers",
  devops: "DevOps and SRE engineers",
  agents: "Agent developers and prompt engineers",
  documents: "Anyone producing structured documents",
  research: "Researchers and technical writers",
  mobile: "Mobile engineers (iOS and Android)",
  database: "Database engineers and DBAs",
  "ai-ml": "ML engineers and applied AI developers",
  marketing: "Marketing and content teams",
  enterprise: "Legal, risk, and enterprise operations",
  browser: "Automation engineers working with browsers",
};

function firstSentence(text: string | null | undefined): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^[\s\S]*?[.!?](\s|$)/);
  return (match ? match[0] : trimmed).trim();
}

function inferAudience(categorySlug: string | null | undefined): string {
  if (!categorySlug) return "Developers and AI engineers";
  return AUDIENCE_DEFAULTS[categorySlug] || "Developers and AI engineers";
}

function inferProblem(
  frontmatter: Record<string, unknown> | null,
  readme: string | null,
  description: string
): string | null {
  if (frontmatter && typeof frontmatter["problem"] === "string") {
    return frontmatter["problem"] as string;
  }
  return firstSentence(readme) || firstSentence(description);
}

function inferCapabilities(
  frontmatter: Record<string, unknown> | null
): string[] {
  if (!frontmatter) return [];
  const raw = frontmatter["capabilities"];
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string");
  }
  return [];
}

function hasMarketingLanguage(text: string | null | undefined): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  return MARKETING_WORDS.filter((w) => lower.includes(w));
}

export interface SkillModalProps {
  skill: SkillCatalogItem | null;
  onClose: () => void;
}

export default function SkillModal({ skill, onClose }: SkillModalProps) {
  const { user } = useAuth();
  const { detail, loading: detailLoading } = useSkillDetail(skill?.id ?? null);
  const [downloadState, setDownloadState] = useState<
    "idle" | "preparing" | "done" | "error"
  >("idle");
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Reset transient state whenever the modal target changes.
  useEffect(() => {
    setDownloadState("idle");
    setDownloadError(null);
  }, [skill?.id]);

  // Lock scroll, trap focus, and restore focus on close.
  useEffect(() => {
    if (!skill) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // The dialog declares aria-modal="true". To actually isolate the
    // background from focus and AT, we walk up from the overlay and at
    // every ancestor mark the siblings (not the path itself) as inert.
    // Walking just `document.body.children` isn't enough when the app
    // is mounted under <div id="root">, because everything — including
    // the modal — is the same body child.
    const overlay = dialogRef.current?.parentElement; // the full-screen backdrop div
    const inerted: HTMLElement[] = [];
    if (overlay) {
      let node: HTMLElement | null = overlay;
      while (node && node !== document.body) {
        const parent = node.parentElement;
        if (!parent) break;
        Array.from(parent.children).forEach((sibling) => {
          if (sibling !== node && sibling instanceof HTMLElement && !sibling.hasAttribute("inert")) {
            sibling.setAttribute("inert", "");
            inerted.push(sibling);
          }
        });
        node = parent;
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])"
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);

    // Move focus inside the dialog.
    setTimeout(() => {
      dialogRef.current?.focus();
    }, 0);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      inerted.forEach((el) => el.removeAttribute("inert"));
      returnFocusRef.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill?.id]);

  if (!skill) return null;

  const needsAudit = skill.quality_tier === "needs_audit";
  const marketingFlags = hasMarketingLanguage(skill.description);
  const problem = inferProblem(
    detail?.frontmatter ?? null,
    detail?.readme_content ?? null,
    skill.description
  );
  const audience = detail?.frontmatter && typeof detail.frontmatter["audience"] === "string"
    ? (detail.frontmatter["audience"] as string)
    : inferAudience(skill.category_slug);
  const capabilities = inferCapabilities(detail?.frontmatter ?? null);
  const lastUpdated = skill.last_synced_at || skill.updated_at;

  const handleDownload = async () => {
    if (needsAudit) return;
    setDownloadState("preparing");
    setDownloadError(null);
    const result = await downloadSkill(skill.id, skill.name, user?.id);
    if (result.success) {
      setDownloadState("done");
      setTimeout(() => setDownloadState("idle"), 1500);
    } else {
      setDownloadState("error");
      setDownloadError(result.error || "Download failed");
    }
  };

  const downloadLabel =
    downloadState === "preparing"
      ? "Preparing…"
      : downloadState === "done"
        ? "Downloaded ✓"
        : downloadState === "error"
          ? "Download failed — retry"
          : "Download Skill";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-labelledby="skill-modal-title"
        aria-modal="true"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 640,
          maxHeight: "calc(100vh - 48px)",
          overflowY: "auto",
          background: "#0a0a0a",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          color: "#fff",
          fontFamily: F,
          outline: "none",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "24px 28px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2
              id="skill-modal-title"
              style={{
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                fontFamily: F,
                lineHeight: 1.15,
                wordBreak: "break-word",
              }}
            >
              {skill.name}
            </h2>
            <div
              style={{
                marginTop: 8,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 10,
                fontSize: 12,
                fontFamily: M,
                color: "rgba(255,255,255,0.45)",
              }}
            >
              {skill.author_username && (
                <span>@{skill.author_username}</span>
              )}
              {skill.category_name && (
                <span
                  style={{
                    padding: "3px 8px",
                    borderRadius: 100,
                    background: "rgba(34,211,238,0.12)",
                    color: "#22d3ee",
                    fontSize: 10,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  {skill.category_name}
                </span>
              )}
              <span>{skill.github_license || "No license"}</span>
              <span>★ {skill.github_stars ?? 0}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.6)",
              borderRadius: 6,
              width: 32,
              height: 32,
              cursor: "pointer",
              fontFamily: M,
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 28px 16px" }}>
          {/* What it does */}
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.55,
              color: "rgba(255,255,255,0.78)",
              margin: 0,
            }}
          >
            {skill.description}
          </p>

          {/* The problem */}
          {problem && (
            <Section label="THE PROBLEM">
              <p style={{ fontSize: 14, lineHeight: 1.55, color: "rgba(255,255,255,0.6)" }}>
                {problem}
              </p>
            </Section>
          )}

          {/* Who it's for */}
          <Section label="WHO IT'S FOR">
            <p style={{ fontSize: 14, lineHeight: 1.55, color: "rgba(255,255,255,0.6)" }}>
              {audience}
            </p>
          </Section>

          {/* Unique capabilities */}
          {capabilities.length > 0 && (
            <Section label="WHAT'S UNIQUE">
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {capabilities.map((cap, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: 14,
                      lineHeight: 1.55,
                      color: "rgba(255,255,255,0.6)",
                      paddingLeft: 18,
                      position: "relative",
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        left: 0,
                        color: "rgba(255,255,255,0.25)",
                      }}
                    >
                      —
                    </span>
                    {cap}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {detailLoading && (
            <div
              style={{
                marginTop: 16,
                fontSize: 11,
                fontFamily: M,
                color: "rgba(255,255,255,0.2)",
              }}
            >
              Loading details…
            </div>
          )}
        </div>

        {/* Audit / marketing-language warnings */}
        {(needsAudit || marketingFlags.length > 0) && (
          <div
            style={{
              margin: "0 28px 16px",
              padding: "10px 12px",
              borderRadius: 8,
              background: needsAudit
                ? "rgba(245,158,11,0.08)"
                : "rgba(245,158,11,0.04)",
              border: `1px solid ${needsAudit ? "rgba(245,158,11,0.3)" : "rgba(245,158,11,0.15)"}`,
              fontSize: 12,
              fontFamily: M,
              color: needsAudit ? "rgba(252,211,77,0.9)" : "rgba(252,211,77,0.7)",
              lineHeight: 1.5,
            }}
          >
            {needsAudit
              ? "⚠ needs_audit — this skill's listing does not align with its source repository. Download is disabled until the curation team reviews it."
              : `⚠ descriptions should inform, not impress — contains: ${marketingFlags.join(", ")}`}
          </div>
        )}

        {/* Footer — download + secondary row */}
        <div
          style={{
            padding: "16px 28px 24px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <button
            onClick={handleDownload}
            disabled={needsAudit || downloadState === "preparing"}
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.12)",
              background: needsAudit
                ? "rgba(255,255,255,0.04)"
                : downloadState === "done"
                  ? "rgba(34,197,94,0.15)"
                  : downloadState === "error"
                    ? "rgba(220,38,38,0.15)"
                    : "#fff",
              color: needsAudit
                ? "rgba(255,255,255,0.35)"
                : downloadState === "done"
                  ? "#4ade80"
                  : downloadState === "error"
                    ? "#fca5a5"
                    : "#000",
              fontFamily: M,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.02em",
              cursor: needsAudit || downloadState === "preparing" ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {downloadState === "preparing" && (
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  border: "2px solid rgba(0,0,0,0.2)",
                  borderTopColor: "rgba(0,0,0,0.8)",
                  animation: "skiyu-spin 0.8s linear infinite",
                  display: "inline-block",
                }}
              />
            )}
            <span>
              {needsAudit ? "Audit in progress" : downloadLabel}
            </span>
          </button>
          <style>{`@keyframes skiyu-spin { to { transform: rotate(360deg); } }`}</style>

          {downloadError && (
            <div
              style={{
                marginTop: 10,
                fontSize: 11,
                fontFamily: M,
                color: "rgba(252,165,165,0.9)",
              }}
            >
              {downloadError}
            </div>
          )}

          <div
            style={{
              marginTop: 14,
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
              fontSize: 11,
              fontFamily: M,
              color: "rgba(255,255,255,0.25)",
            }}
          >
            <span>↓ {skill.download_count || 0}</span>
            {skill.package_size_bytes != null && (
              <span>{formatFileSize(skill.package_size_bytes)}</span>
            )}
            <span>updated {new Date(lastUpdated).toLocaleDateString()}</span>
            {skill.github_repo && (
              <a
                href={`https://github.com/${skill.github_repo}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                source ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div
        style={{
          fontSize: 10,
          fontFamily: M,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.35)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}
