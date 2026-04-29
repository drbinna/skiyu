import { useState, useCallback, type KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import type { SkillCatalogItem } from "@/lib/types";
import { downloadSkill } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";

const F = "'Erode', 'Cormorant Garamond', Georgia, serif";
const M = "'Fragment Mono', 'JetBrains Mono', Menlo, monospace";

// Session-level API key cache. Entered once, reused across all cards
// within the same page session. Never written to disk or DB.
let _cachedApiKey: string | null = null;

interface SkillCardProps {
  skill: SkillCatalogItem;
  onOpen?: (skill: SkillCatalogItem) => void;
  preferModal?: boolean;
  userId?: string | null;
}

/**
 * Skill card v4 — Deploy to Claude + Download skill.
 *
 * "Deploy to Claude" calls the Anthropic Skills API via our edge function
 * to install the skill directly into the user's Claude workspace. One click
 * after the initial API key entry. The key is cached in memory for the
 * session — never stored in a database.
 *
 * "Download skill" triggers a .zip download via the existing zip-skill-folder
 * edge function for users who prefer manual installation.
 */
export default function SkillCard({
  skill,
  onOpen,
  preferModal = false,
  userId,
}: SkillCardProps) {
  const navigate = useNavigate();
  const [hover, setHover] = useState<null | "deploy" | "zip">(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Deploy state
  const [deployPhase, setDeployPhase] = useState<
    "idle" | "needs_key" | "deploying" | "success" | "error"
  >("idle");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [deployError, setDeployError] = useState<string | null>(null);

  const sizeLabel =
    typeof skill.package_size_bytes === "number" && skill.package_size_bytes > 0
      ? `~${Math.round(skill.package_size_bytes / 1024)} KB`
      : "size pending";
  const license = skill.github_license || "no license";
  const zipPreview = `${skill.slug}.zip · ${sizeLabel} · ${license}`;

  const previewLine =
    deployPhase === "success"
      ? "✓ Deployed to your Claude workspace"
      : hover === "deploy"
        ? "→ one-click install to Claude"
        : hover === "zip"
          ? `→ ${zipPreview}`
          : `updated ${formatRelative(skill.updated_at)}`;

  // ── Deploy handler ──────────────────────────────────────────
  const handleDeployClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (deployPhase === "deploying") return;

      // If we have a cached key, deploy immediately
      if (_cachedApiKey) {
        void doDeploy(_cachedApiKey);
      } else {
        // Show the API key input
        setDeployPhase("needs_key");
        setDeployError(null);
      }
    },
    [deployPhase],
  );

  const doDeploy = useCallback(
    async (key: string) => {
      setDeployPhase("deploying");
      setDeployError(null);

      try {
        const sbBase = (supabase as unknown as { supabaseUrl: string }).supabaseUrl;
        const anonKey = (supabase as unknown as { supabaseKey: string }).supabaseKey;

        const res = await fetch(`${sbBase}/functions/v1/deploy-to-claude`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            apikey: anonKey,
          },
          body: JSON.stringify({
            skill_slug: skill.slug,
            anthropic_api_key: key,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          const msg = data.error ?? `Deploy failed (${res.status})`;
          // If the key is invalid, clear the cache so user can re-enter
          if (res.status === 401) {
            _cachedApiKey = null;
            setDeployPhase("needs_key");
          } else {
            setDeployPhase("error");
          }
          setDeployError(msg);
          return;
        }

        // Success — cache the key for this session
        _cachedApiKey = key;
        setDeployPhase("success");

        // Reset back to idle after 4 seconds
        window.setTimeout(() => setDeployPhase("idle"), 4000);
      } catch (err) {
        setDeployError(
          err instanceof Error ? err.message : "Deploy failed. Try again.",
        );
        setDeployPhase("error");
      }
    },
    [skill.slug],
  );

  const handleKeySubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const key = apiKeyInput.trim();
      if (!key.startsWith("sk-ant-")) {
        setDeployError("Key must start with sk-ant-");
        return;
      }
      void doDeploy(key);
    },
    [apiKeyInput, doDeploy],
  );

  // ── Download handler ────────────────────────────────────────
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
        background: "rgba(255, 255, 255, 0.02)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        borderTop: "2px solid #22d3ee",
        borderRadius: 10,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        minHeight: 160,
        cursor: "pointer",
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)";
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)";
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
      }}
    >
      {/* Name + license */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700, fontFamily: F, letterSpacing: "-0.01em" }}>{skill.name}</span>
        <span style={{ fontSize: 11, fontFamily: M, fontWeight: 600, padding: "3px 10px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>
          {skill.github_license || "N/A"}
        </span>
      </div>

      {/* Meta row */}
      <div style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.30)", marginTop: 4, display: "flex", gap: 6 }}>
        <span>@{skill.author_username}</span>
        {skill.category_name && <><span style={{ color: "rgba(255,255,255,0.15)" }}>·</span><span>{skill.category_name}</span></>}
      </div>

      {/* Description */}
      <div style={{ fontSize: 13, fontFamily: F, color: "rgba(255,255,255,0.35)", lineHeight: 1.5, marginTop: 12, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
        {skill.description}
      </div>

      {/* Audience */}
      {skill.audience && (
        <>
          <div style={{ marginTop: 14 }}>
            <div style={{ fontFamily: M, fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.20)" }}>FOR</div>
            <div style={{ fontFamily: F, fontStyle: "italic", fontSize: 12, color: "rgba(255,255,255,0.40)", lineHeight: 1.5, marginTop: 4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
              {skill.audience}
            </div>
          </div>
        </>
      )}

      <div style={{ flex: 1 }} />

      {/* Preview line */}
      <div style={{
        height: 16, fontFamily: M, fontSize: 11, marginTop: 14,
        color: deployPhase === "success" ? "#4ade80" : error ? "#fca5a5" : hover ? "rgba(255,255,255,0.60)" : "rgba(255,255,255,0.25)",
        transition: "color 150ms", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {error ?? previewLine}
      </div>

      {/* API key input panel (shown when needs_key) */}
      {deployPhase === "needs_key" && (
        <form
          onClick={(e) => e.stopPropagation()}
          onSubmit={handleKeySubmit}
          style={{
            marginTop: 10, padding: "12px 14px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            display: "flex", flexDirection: "column", gap: 8,
          }}
        >
          <div style={{ fontFamily: M, fontSize: 10, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>
            ANTHROPIC API KEY
          </div>
          <div style={{ fontFamily: F, fontStyle: "italic", fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
            Used once to deploy this skill. Not stored.
          </div>
          <input
            type="password"
            placeholder="sk-ant-api03-..."
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: "8px 10px", background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)", borderRadius: 5,
              color: "#fff", fontFamily: M, fontSize: 12, outline: "none",
              width: "100%", boxSizing: "border-box",
            }}
          />
          {deployError && (
            <div style={{ fontFamily: M, fontSize: 11, color: "#fca5a5" }}>{deployError}</div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <button type="submit" disabled={!apiKeyInput.trim()}
              style={{
                flex: 1, padding: "8px", background: apiKeyInput.trim() ? "#fff" : "rgba(255,255,255,0.10)",
                color: apiKeyInput.trim() ? "#000" : "rgba(255,255,255,0.40)",
                border: "none", borderRadius: 5, fontFamily: M, fontSize: 11, fontWeight: 600, cursor: apiKeyInput.trim() ? "pointer" : "not-allowed",
              }}>
              Deploy
            </button>
            <button type="button"
              onClick={(e) => { e.stopPropagation(); setDeployPhase("idle"); setDeployError(null); }}
              style={{
                padding: "8px 12px", background: "transparent",
                color: "rgba(255,255,255,0.40)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 5, fontFamily: M, fontSize: 11, cursor: "pointer",
              }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Action buttons */}
      {deployPhase !== "needs_key" && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            type="button"
            onClick={handleDeployClick}
            onMouseEnter={() => setHover("deploy")}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover("deploy")}
            onBlur={() => setHover(null)}
            disabled={deployPhase === "deploying"}
            aria-label={`Deploy ${skill.name} to Claude`}
            style={{
              flex: 1,
              padding: "10px 14px",
              background: deployPhase === "success" ? "rgba(74,222,128,0.12)" : deployPhase === "deploying" ? "rgba(255,255,255,0.10)" : "#fff",
              color: deployPhase === "success" ? "#4ade80" : deployPhase === "deploying" ? "rgba(255,255,255,0.50)" : "#000",
              border: deployPhase === "success" ? "1px solid rgba(74,222,128,0.25)" : "1px solid rgba(255,255,255,0.10)",
              borderRadius: 6,
              fontFamily: M,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.04em",
              cursor: deployPhase === "deploying" ? "wait" : "pointer",
              transition: "all 150ms cubic-bezier(0.2, 0.8, 0.3, 1)",
            }}
          >
            {deployPhase === "success"
              ? "✓ Deployed"
              : deployPhase === "deploying"
                ? "Deploying…"
                : deployPhase === "error"
                  ? "Retry deploy"
                  : "Deploy to Claude"}
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
      )}

      {/* Deploy error banner */}
      {deployPhase === "error" && deployError && (
        <div style={{ marginTop: 8, padding: "8px 10px", background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.18)", borderRadius: 6, fontFamily: M, fontSize: 11, color: "#fca5a5" }}>
          {deployError}
        </div>
      )}
    </div>
  );
}

/** ISO timestamp → "3d ago" / "2w ago" / "5mo ago" / "2024". */
function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const mins = ms / 60_000;
  if (mins < 60) return `${Math.floor(mins)}m ago`;
  const hours = mins / 60;
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = hours / 24;
  if (days < 14) return `${Math.floor(days)}d ago`;
  const weeks = days / 7;
  if (weeks < 8) return `${Math.floor(weeks)}w ago`;
  const months = days / 30;
  if (months < 12) return `${Math.floor(months)}mo ago`;
  return new Date(iso).getFullYear().toString();
}
