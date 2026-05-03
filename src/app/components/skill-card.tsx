import { useState, useCallback, type KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import type { SkillCatalogItem } from "@/lib/types";
import { downloadSkill } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";

const F = "'Erode', 'Cormorant Garamond', Georgia, serif";
const M = "'Fragment Mono', 'JetBrains Mono', Menlo, monospace";

const MCP_URL = "https://mkqiqkqgnywosbneibqx.supabase.co/functions/v1/skiyu-mcp";

// Persist across cards in the same session
let _mcpSetupDone = false;

interface SkillCardProps {
  skill: SkillCatalogItem;
  onOpen?: (skill: SkillCatalogItem) => void;
  preferModal?: boolean;
  userId?: string | null;
}

export default function SkillCard({ skill, onOpen, preferModal = false, userId }: SkillCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [hover, setHover] = useState<null | "deploy" | "zip">(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [setupDone, setSetupDone] = useState(_mcpSetupDone);
  const [copied, setCopied] = useState(false);

  const previewLine =
    setupDone && hover === "deploy"
      ? `→ ask Claude: "use ${skill.name} from skiyu"`
      : hover === "deploy"
        ? "→ add skiyu to Claude (one-time setup)"
        : hover === "zip"
          ? `→ ${skill.slug}.zip`
          : `updated ${formatRelative(skill.updated_at)}`;

  const handleDeployClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();

    if (setupDone) {
      // Already connected — copy the usage prompt
      const prompt = `Use the ${skill.name} skill from skiyu to help me.`;
      navigator.clipboard.writeText(prompt).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
      return;
    }

    setShowSetup(true);
  }, [setupDone, skill.name]);

  const handleSetupDone = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    _mcpSetupDone = true;
    setSetupDone(true);
    setShowSetup(false);
  }, []);

  const handleCopyUrl = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(MCP_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const handleZip = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    const res = await downloadSkill(skill.id, skill.name, userId);
    if (!res.success) {
      setError(res.error ?? "Download failed");
      setTimeout(() => setError(null), 4000);
    }
    setTimeout(() => setDownloading(false), 1200);
  }, [skill.id, skill.name, userId, downloading]);

  const openCard = useCallback(() => {
    if (showSetup) return;
    if (preferModal && onOpen) onOpen(skill);
    else navigate(`/skills/${skill.slug}`);
  }, [preferModal, onOpen, skill, navigate, showSetup]);

  const onCardKey = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCard(); }
  }, [openCard]);

  return (
    <div
      role="link" tabIndex={0} onClick={openCard} onKeyDown={onCardKey}
      style={{
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
        borderTop: "2px solid #22d3ee", borderRadius: 10, padding: 20,
        display: "flex", flexDirection: "column", minHeight: 160, cursor: "pointer", transition: "all 0.2s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
    >
      {/* Name + license */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700, fontFamily: F, letterSpacing: "-0.01em" }}>{skill.name}</span>
        <span style={{ fontSize: 11, fontFamily: M, fontWeight: 600, padding: "3px 10px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>
          {skill.github_license || "N/A"}
        </span>
      </div>

      {/* Meta */}
      <div style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.30)", marginTop: 4, display: "flex", gap: 6 }}>
        <span>@{skill.author_username}</span>
        {skill.category_name && <><span style={{ color: "rgba(255,255,255,0.15)" }}>·</span><span>{skill.category_name}</span></>}
      </div>

      {/* Description */}
      <div style={{ fontSize: 13, fontFamily: F, color: "rgba(255,255,255,0.35)", lineHeight: 1.5, marginTop: 12, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
        {skill.description}
      </div>

      {skill.audience && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontFamily: M, fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.20)" }}>FOR</div>
          <div style={{ fontFamily: F, fontStyle: "italic", fontSize: 12, color: "rgba(255,255,255,0.40)", lineHeight: 1.5, marginTop: 4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
            {skill.audience}
          </div>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Status line */}
      <div style={{
        height: 16, fontFamily: M, fontSize: 11, marginTop: 14,
        color: copied ? "#4ade80" : error ? "#fca5a5" : hover ? "rgba(255,255,255,0.60)" : "rgba(255,255,255,0.25)",
        transition: "color 150ms", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {copied ? "✓ Prompt copied — paste it in Claude" : error ?? previewLine}
      </div>

      {/* Setup panel — one-time MCP connector instructions */}
      {showSetup && (
        <div onClick={(e) => e.stopPropagation()} style={{
          marginTop: 10, padding: "16px",
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8, display: "flex", flexDirection: "column", gap: 10,
        }}>
          <div style={{ fontFamily: M, fontSize: 10, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.40)" }}>
            ONE-TIME SETUP · 30 SECONDS
          </div>
          <div style={{ fontFamily: F, fontStyle: "italic", fontSize: 13, color: "rgba(255,255,255,0.60)", lineHeight: 1.55 }}>
            Connect skiyu to Claude once. After that, every skill in the catalog is available — just ask Claude to use it.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            <Step num="1" text='Open Claude.ai → Settings → Connectors' />
            <Step num="2" text='Click "Add connector" → paste this URL:' />
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <code style={{
                flex: 1, padding: "8px 10px",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 5, fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.70)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {MCP_URL}
              </code>
              <button type="button" onClick={handleCopyUrl}
                style={{ flexShrink: 0, padding: "8px 12px", background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 5, fontFamily: M, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                {copied ? "✓" : "Copy"}
              </button>
            </div>
            <Step num="3" text="Done! Now ask Claude to use any skiyu skill." />
          </div>

          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button type="button" onClick={handleSetupDone}
              style={{ flex: 1, padding: "10px", background: "#fff", color: "#000", border: "none", borderRadius: 6, fontFamily: M, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              I've connected skiyu
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); setShowSetup(false); }}
              style={{ padding: "10px 14px", background: "transparent", color: "rgba(255,255,255,0.40)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, fontFamily: M, fontSize: 11, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Buttons */}
      {!showSetup && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button type="button" onClick={handleDeployClick}
            onMouseEnter={() => setHover("deploy")} onMouseLeave={() => setHover(null)}
            style={{
              flex: 1, padding: "10px 14px",
              background: copied ? "rgba(74,222,128,0.12)" : "#fff",
              color: copied ? "#4ade80" : "#000",
              border: copied ? "1px solid rgba(74,222,128,0.25)" : "1px solid rgba(255,255,255,0.10)",
              borderRadius: 6, fontFamily: M, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em",
              cursor: "pointer", transition: "all 150ms",
            }}>
            {copied ? "✓ Copied" : setupDone ? "Use in Claude" : "Add to Claude"}
          </button>
          <button type="button" onClick={handleZip}
            onMouseEnter={() => setHover("zip")} onMouseLeave={() => setHover(null)}
            disabled={downloading}
            style={{
              padding: "10px 14px", background: "rgba(255,255,255,0.04)",
              color: downloading ? "rgba(255,255,255,0.40)" : "#fff",
              border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6,
              fontFamily: M, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em",
              cursor: downloading ? "wait" : "pointer", transition: "background 150ms",
            }}>
            {downloading ? "↓ …" : "↓ Download"}
          </button>
        </div>
      )}
    </div>
  );
}

function Step({ num, text }: { num: string; text: string }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span style={{
        flexShrink: 0, width: 20, height: 20, borderRadius: "50%",
        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: M, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.50)",
      }}>{num}</span>
      <span style={{ fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.5, paddingTop: 1 }}>{text}</span>
    </div>
  );
}

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
