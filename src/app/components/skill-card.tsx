import { useState, useCallback, type KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import type { SkillCatalogItem } from "@/lib/types";
import { downloadSkill } from "@/lib/hooks";

const F = "'Erode', 'Cormorant Garamond', Georgia, serif";
const M = "'Fragment Mono', 'JetBrains Mono', Menlo, monospace";

interface SkillCardProps {
  skill: SkillCatalogItem;
  /** Optional click handler — opens the legacy modal. Card is also a link
   *  to the detail page; this handler is only used when callers want the
   *  modal flow instead. */
  onOpen?: (skill: SkillCatalogItem) => void;
  /** When true, clicking the card body opens the modal via onOpen.
   *  When false (default), clicking the card body navigates to /skills/:slug. */
  preferModal?: boolean;
  /** User id for download-event attribution. */
  userId?: string | null;
}

/**
 * Skill card v3 — replaces the old card across Home + Explore.
 *
 * Layout: name → meta row (@author · category · license) → "what it does"
 * sentence → optional `// FOR` audience block (collapses when null) →
 * preview/updated line → primary "Run skill" + secondary "Download skill".
 *
 * "Run skill" navigates to the workbench at /author?skill=<slug> where the
 * skill loads and the user provides input. "Download skill" triggers a
 * server-side zip of the skill folder. Hovering either button swaps the
 * updated line for a one-line preview of what the action does.
 *
 * Source of truth: design-system handoff `skiyu-discovery-install.html`,
 * with the action surface updated post-screenshot to point Run at the
 * workbench rather than the detail page's run-launcher fiction.
 */
export default function SkillCard({
  skill,
  onOpen,
  preferModal = false,
  userId,
}: SkillCardProps) {
  const navigate = useNavigate();
  const [hover, setHover] = useState<null | "run" | "zip">(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // .zip preview details. package_size_bytes is sometimes unset on
  // scraper rows; fall back to a polite "—" rather than rendering "0 B".
  const sizeLabel =
    typeof skill.package_size_bytes === "number" && skill.package_size_bytes > 0
      ? `~${Math.round(skill.package_size_bytes / 1024)} KB`
      : "size pending";
  const license = skill.github_license || "no license";
  const zipPreview = `${skill.slug}.zip · ${sizeLabel} · ${license}`;

  // Compute the preview line. Empty when no hover; the line is height-locked
  // so the layout never shifts.
  const previewLine =
    hover === "run"
      ? `→ run ${skill.name} in the sandbox`
      : hover === "zip"
        ? `→ ${zipPreview}`
        : `updated ${formatRelative(skill.updated_at)}`;

  const handleRun = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      // /run is the real sandbox runtime. /author is the authoring assistant.
      navigate(`/run?skill=${encodeURIComponent(skill.slug)}`);
    },
    [navigate, skill.slug],
  );

  const handleZip = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (downloading) return;
      setDownloading(true);
      const res = await downloadSkill(skill.id, skill.name, userId);
      if (!res.success) {
        setError(res.error ?? "Download failed");
        window.setTimeout(() => setError(null), 4000);
      }
      window.setTimeout(() => setDownloading(false), 1200);
    },
    [skill.id, skill.name, userId, downloading],
  );

  const openCard = useCallback(() => {
    if (preferModal && onOpen) {
      onOpen(skill);
    } else {
      navigate(`/skills/${skill.slug}`);
    }
  }, [preferModal, onOpen, skill, navigate]);

  const onCardKey = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openCard();
      }
    },
    [openCard],
  );

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={openCard}
      onKeyDown={onCardKey}
      style={{
        padding: "20px 24px",
        background: "rgba(255, 255, 255, 0.04)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        borderRadius: 10,
        transition:
          "background 150ms cubic-bezier(0.2, 0.8, 0.3, 1), border-color 150ms cubic-bezier(0.2, 0.8, 0.3, 1)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        cursor: "pointer",
        outline: "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.10)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.06)";
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.30)";
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.06)";
      }}
    >
      {/* Header: name + meta row */}
      <div>
        <div
          style={{
            fontFamily: F,
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: "-0.02em",
            color: "#fff",
          }}
        >
          {skill.name}
        </div>
        <div
          style={{
            marginTop: 4,
            fontFamily: M,
            fontSize: 12,
            color: "rgba(255, 255, 255, 0.40)",
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span>@{skill.author_username ?? "anon"}</span>
          {skill.category_slug && (
            <>
              <span style={{ color: "rgba(255, 255, 255, 0.25)" }}>·</span>
              <span>{skill.category_slug}</span>
            </>
          )}
          <span style={{ color: "rgba(255, 255, 255, 0.25)" }}>·</span>
          <span>{license}</span>
        </div>
      </div>

      {/* What it does — single sentence, italic serif */}
      <div
        style={{
          fontFamily: F,
          fontStyle: "italic",
          fontSize: 14,
          lineHeight: 1.5,
          color: "rgba(255, 255, 255, 0.60)",
          // textWrap: 'pretty' isn't widely supported in TS lib types yet
          textWrap: "pretty" as never,
        }}
      >
        {firstSentence(skill.description)}
      </div>

      {/* Audience block — collapses entirely when null */}
      {skill.audience && (
        <>
          <div
            style={{
              height: 1,
              background: "rgba(255, 255, 255, 0.06)",
            }}
          />
          <div>
            <span
              style={{
                fontFamily: M,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "rgba(255, 255, 255, 0.25)",
              }}
            >
              // for
            </span>
            <div
              style={{
                marginTop: 6,
                fontFamily: F,
                fontStyle: "italic",
                fontSize: 14,
                lineHeight: 1.5,
                color: "rgba(255, 255, 255, 0.60)",
                textWrap: "pretty" as never,
              }}
            >
              {skill.audience}
            </div>
          </div>
        </>
      )}

      {/* Preview / updated line — fixed height, no layout shift */}
      <div
        style={{
          height: 16,
          fontFamily: M,
          fontSize: 11,
          color: error
            ? "#fca5a5"
            : hover
              ? "rgba(255, 255, 255, 0.60)"
              : "rgba(255, 255, 255, 0.25)",
          transition: "color 150ms cubic-bezier(0.2, 0.8, 0.3, 1)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {error ?? previewLine}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={handleRun}
          onMouseEnter={() => setHover("run")}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover("run")}
          onBlur={() => setHover(null)}
          aria-label={`Run ${skill.name}`}
          style={{
            flex: 1,
            padding: "10px 14px",
            background: "#fff",
            color: "#000",
            border: "1px solid rgba(255, 255, 255, 0.10)",
            borderRadius: 6,
            fontFamily: M,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.04em",
            cursor: "pointer",
            transition: "background 150ms cubic-bezier(0.2, 0.8, 0.3, 1)",
          }}
        >
          Run skill
        </button>
        <button
          type="button"
          onClick={handleZip}
          onMouseEnter={() => setHover("zip")}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover("zip")}
          onBlur={() => setHover(null)}
          aria-label={`Download ${skill.name} as zip`}
          disabled={downloading}
          style={{
            padding: "10px 14px",
            background: "rgba(255, 255, 255, 0.04)",
            color: downloading ? "rgba(255, 255, 255, 0.40)" : "#fff",
            border: "1px solid rgba(255, 255, 255, 0.10)",
            borderRadius: 6,
            fontFamily: M,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.04em",
            cursor: downloading ? "wait" : "pointer",
            transition: "background 150ms cubic-bezier(0.2, 0.8, 0.3, 1)",
          }}
        >
          {downloading ? "↓ Preparing…" : "↓ Download skill"}
        </button>
      </div>
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────

/** Take just the first sentence of the description. The card has room
 *  for one — the rest lives on the detail page. We trim at the first
 *  period followed by space-or-end. If there's no period, we return
 *  the description as-is (truncation handled by line-clamp on render). */
function firstSentence(s: string): string {
  if (!s) return "";
  const m = s.match(/^[^.!?]*[.!?]/);
  return (m ? m[0] : s).trim();
}

/** ISO timestamp → "3d ago" / "2w ago" / "5mo ago" / "2024".
 *  Matches design-system spacing.json: same as the existing card. */
function formatRelative(iso: string): string {
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
