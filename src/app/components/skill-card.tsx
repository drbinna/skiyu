import { useState, useCallback, useEffect, type KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import type { SkillCatalogItem } from "@/lib/types";
import { downloadSkill } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

const F = "'Erode', 'Cormorant Garamond', Georgia, serif";
const M = "'Fragment Mono', 'JetBrains Mono', Menlo, monospace";

// Map Twin statuses to user-friendly labels
const STATUS_LABELS: Record<string, string> = {
  pending: "Preparing…",
  started: "Starting Twin agent…",
  login_required: "Waiting for Claude login…",
  login_completed: "Logged in to Claude",
  skills_page_opened: "Opened Claude Skills page",
  awaiting_upload_confirmation: "Ready to upload — confirm in Twin",
  uploading: "Uploading skill…",
  uploaded: "Skill uploaded",
  installed: "Skill installed in Claude",
  awaiting_test_confirmation: "Ready to test — confirm in Twin",
  test_prompt_sent: "Running test prompt…",
  run_success: "✓ Deployed and tested",
  run_failed: "Deploy failed",
  needs_manual_review: "Needs manual review",
};

const TERMINAL = new Set(["run_success", "run_failed", "needs_manual_review"]);
const SUCCESS = new Set(["run_success", "installed", "uploaded"]);

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

  // Twin install state
  const [installId, setInstallId] = useState<string | null>(null);
  const [installStatus, setInstallStatus] = useState<string | null>(null);
  const [installMessage, setInstallMessage] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);

  // Subscribe to realtime updates when we have an install_id
  useEffect(() => {
    if (!installId) return;

    const channel = supabase
      .channel(`install-${installId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "skill_installs",
          filter: `id=eq.${installId}`,
        },
        (payload) => {
          const row = payload.new as { status: string; message: string | null; error: unknown };
          setInstallStatus(row.status);
          setInstallMessage(row.message);
          if (TERMINAL.has(row.status)) {
            setDeploying(false);
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [installId]);

  // Auto-clear success after 6 seconds
  useEffect(() => {
    if (installStatus && SUCCESS.has(installStatus)) {
      const t = setTimeout(() => {
        setInstallId(null);
        setInstallStatus(null);
        setInstallMessage(null);
      }, 6000);
      return () => clearTimeout(t);
    }
  }, [installStatus]);

  const previewLine =
    installStatus && SUCCESS.has(installStatus)
      ? "✓ Deployed to your Claude workspace"
      : hover === "deploy"
        ? "→ deploy to Claude via Twin"
        : hover === "zip"
          ? `→ ${skill.slug}.zip`
          : `updated ${formatRelative(skill.updated_at)}`;

  // ── Deploy via Twin ─────────────────────────────────────────
  const handleDeploy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deploying) return;

    if (!user) {
      setError("Sign in to deploy");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setDeploying(true);
    setInstallStatus("pending");
    setInstallMessage("Preparing…");
    setError(null);

    try {
      const sbBase = (supabase as unknown as { supabaseUrl: string }).supabaseUrl;
      const anonKey = (supabase as unknown as { supabaseKey: string }).supabaseKey;
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? anonKey;

      const res = await fetch(`${sbBase}/functions/v1/twin-install`, {
        method: "POST",
        headers: { "content-type": "application/json", apikey: anonKey, authorization: `Bearer ${token}` },
        body: JSON.stringify({ skill_slug: skill.slug }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to start deploy");
        setDeploying(false);
        setInstallStatus(null);
        return;
      }

      setInstallId(data.install_id);
      setInstallStatus("started");
      setInstallMessage("Twin agent started…");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deploy failed");
      setDeploying(false);
      setInstallStatus(null);
    }
  }, [user, skill.slug, deploying]);

  // ── Download ────────────────────────────────────────────────
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
    if (preferModal && onOpen) onOpen(skill);
    else navigate(`/skills/${skill.slug}`);
  }, [preferModal, onOpen, skill, navigate]);

  const onCardKey = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCard(); }
  }, [openCard]);

  const isActive = deploying || (installStatus && !TERMINAL.has(installStatus));
  const isSuccess = installStatus && SUCCESS.has(installStatus);
  const isFailed = installStatus === "run_failed" || installStatus === "needs_manual_review";

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

      {/* Audience */}
      {skill.audience && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontFamily: M, fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.20)" }}>FOR</div>
          <div style={{ fontFamily: F, fontStyle: "italic", fontSize: 12, color: "rgba(255,255,255,0.40)", lineHeight: 1.5, marginTop: 4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
            {skill.audience}
          </div>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Preview / status line */}
      <div style={{
        height: 16, fontFamily: M, fontSize: 11, marginTop: 14,
        color: isSuccess ? "#4ade80" : isFailed ? "#fca5a5" : error ? "#fca5a5" : hover ? "rgba(255,255,255,0.60)" : "rgba(255,255,255,0.25)",
        transition: "color 150ms", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {error ?? previewLine}
      </div>

      {/* Install progress panel */}
      {isActive && installStatus && (
        <div onClick={(e) => e.stopPropagation()} style={{
          marginTop: 10, padding: "12px 14px",
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8, display: "flex", flexDirection: "column", gap: 6,
        }}>
          <div style={{ fontFamily: M, fontSize: 10, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>
            INSTALLING VIA TWIN
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              border: "2px solid rgba(255,255,255,0.15)",
              borderTopColor: "#22d3ee",
              animation: "spin 0.8s linear infinite",
            }} />
            <span style={{ fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.70)" }}>
              {STATUS_LABELS[installStatus] ?? installStatus}
            </span>
          </div>
          {installMessage && installMessage !== STATUS_LABELS[installStatus] && (
            <div style={{ fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
              {installMessage}
            </div>
          )}
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Error/failure detail */}
      {isFailed && installMessage && (
        <div onClick={(e) => e.stopPropagation()} style={{
          marginTop: 8, padding: "8px 10px",
          background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.18)",
          borderRadius: 6, fontFamily: M, fontSize: 11, color: "#fca5a5",
        }}>
          {installMessage}
        </div>
      )}

      {/* Buttons */}
      {!isActive && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button type="button" onClick={handleDeploy}
            onMouseEnter={() => setHover("deploy")} onMouseLeave={() => setHover(null)}
            disabled={deploying}
            style={{
              flex: 1, padding: "10px 14px",
              background: isSuccess ? "rgba(74,222,128,0.12)" : "#fff",
              color: isSuccess ? "#4ade80" : "#000",
              border: isSuccess ? "1px solid rgba(74,222,128,0.25)" : "1px solid rgba(255,255,255,0.10)",
              borderRadius: 6, fontFamily: M, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em",
              cursor: "pointer", transition: "all 150ms",
            }}>
            {isSuccess ? "✓ Deployed" : isFailed ? "Retry" : "Deploy to Claude"}
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
