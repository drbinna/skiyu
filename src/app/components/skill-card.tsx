import { useState, useCallback, useEffect, type KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import type { SkillCatalogItem } from "@/lib/types";
import { downloadSkill } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

const F = "'Erode', 'Cormorant Garamond', Georgia, serif";
const M = "'Fragment Mono', 'JetBrains Mono', Menlo, monospace";

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

  // Deploy state
  const [deployPhase, setDeployPhase] = useState<"idle" | "starting" | "live" | "success" | "error">("idle");
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);

  // Auto-clear success
  useEffect(() => {
    if (deployPhase === "success") {
      const t = setTimeout(() => { setDeployPhase("idle"); setLiveUrl(null); }, 6000);
      return () => clearTimeout(t);
    }
  }, [deployPhase]);

  const previewLine =
    deployPhase === "success" ? "✓ Deployed to your Claude workspace"
    : deployPhase === "live" ? "Agent running — log in if prompted"
    : hover === "deploy" ? "→ deploy to Claude"
    : hover === "zip" ? `→ ${skill.slug}.zip`
    : `updated ${formatRelative(skill.updated_at)}`;

  // ── Deploy via Browser Use Cloud ────────────────────────────
  const handleDeploy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deployPhase === "starting" || deployPhase === "live") return;

    if (!user) {
      setError("Sign in to deploy");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setDeployPhase("starting");
    setDeployError(null);
    setLiveUrl(null);

    try {
      const sbBase = (supabase as unknown as { supabaseUrl: string }).supabaseUrl;
      const anonKey = (supabase as unknown as { supabaseKey: string }).supabaseKey;
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? anonKey;

      const res = await fetch(`${sbBase}/functions/v1/deploy-agent`, {
        method: "POST",
        headers: { "content-type": "application/json", apikey: anonKey, authorization: `Bearer ${token}` },
        body: JSON.stringify({ skill_slug: skill.slug }),
      });

      const data = await res.json();
      if (!res.ok) {
        setDeployError(data.error ?? "Deploy failed");
        setDeployPhase("error");
        return;
      }

      if (data.live_url) {
        setLiveUrl(data.live_url);
        setDeployPhase("live");
      } else {
        // No live URL — treat as started but can't show browser
        setDeployPhase("live");
      }

      // Poll for task completion
      if (data.task_id) {
        pollTaskStatus(data.task_id, sbBase, anonKey, data.install_id);
      }
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : "Deploy failed");
      setDeployPhase("error");
    }
  }, [user, skill.slug, deployPhase]);

  // Poll the install record for status changes
  const pollTaskStatus = useCallback((taskId: string, sbBase: string, anonKey: string, installId: string) => {
    const interval = setInterval(async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token ?? anonKey;

        const { data: install } = await supabase
          .from("skill_installs")
          .select("status, message")
          .eq("id", installId)
          .maybeSingle();

        if (install) {
          if (install.status === "run_success" || install.status === "installed" || install.status === "uploaded") {
            setDeployPhase("success");
            setLiveUrl(null);
            clearInterval(interval);
          } else if (install.status === "run_failed") {
            setDeployError(install.message ?? "Deploy failed");
            setDeployPhase("error");
            setLiveUrl(null);
            clearInterval(interval);
          }
        }
      } catch { /* keep polling */ }
    }, 5000);

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(interval), 300_000);
  }, []);

  // Close live view
  const handleCloseLive = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setLiveUrl(null);
    setDeployPhase("idle");
  }, []);

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
    if (deployPhase === "live") return; // Don't navigate during live view
    if (preferModal && onOpen) onOpen(skill);
    else navigate(`/skills/${skill.slug}`);
  }, [preferModal, onOpen, skill, navigate, deployPhase]);

  const onCardKey = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCard(); }
  }, [openCard]);

  const isActive = deployPhase === "starting" || deployPhase === "live";

  return (
    <div
      role="link" tabIndex={0}
      onClick={openCard} onKeyDown={onCardKey}
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

      {/* Status line */}
      <div style={{
        height: 16, fontFamily: M, fontSize: 11, marginTop: 14,
        color: deployPhase === "success" ? "#4ade80" : error || deployError ? "#fca5a5" : hover ? "rgba(255,255,255,0.60)" : "rgba(255,255,255,0.25)",
        transition: "color 150ms", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {error ?? deployError ?? previewLine}
      </div>

      {/* Live browser view */}
      {deployPhase === "live" && liveUrl && (
        <div onClick={(e) => e.stopPropagation()} style={{
          marginTop: 10, borderRadius: 8, overflow: "hidden",
          border: "1px solid rgba(34,211,238,0.25)",
          background: "#000",
        }}>
          <div style={{
            padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "rgba(34,211,238,0.08)", borderBottom: "1px solid rgba(34,211,238,0.15)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%", background: "#22d3ee",
                animation: "pulse 1.5s ease-in-out infinite",
              }} />
              <span style={{ fontFamily: M, fontSize: 10, fontWeight: 600, color: "#22d3ee", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                LIVE — log into Claude if prompted
              </span>
            </div>
            <button type="button" onClick={handleCloseLive}
              style={{ fontFamily: M, fontSize: 10, color: "rgba(255,255,255,0.40)", background: "none", border: "none", cursor: "pointer" }}>
              ✕ Close
            </button>
          </div>
          <iframe
            src={liveUrl}
            style={{ width: "100%", height: 400, border: "none", background: "#fff" }}
            allow="clipboard-read; clipboard-write"
            title="Browser agent — deploy to Claude"
          />
          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
        </div>
      )}

      {/* Starting spinner */}
      {deployPhase === "starting" && (
        <div onClick={(e) => e.stopPropagation()} style={{
          marginTop: 10, padding: "14px", background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 14, height: 14, borderRadius: "50%",
            border: "2px solid rgba(255,255,255,0.10)", borderTopColor: "#22d3ee",
            animation: "spin 0.8s linear infinite",
          }} />
          <span style={{ fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.60)" }}>
            Preparing deploy agent…
          </span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Error detail */}
      {deployPhase === "error" && deployError && (
        <div onClick={(e) => e.stopPropagation()} style={{
          marginTop: 8, padding: "8px 10px",
          background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.18)",
          borderRadius: 6, fontFamily: M, fontSize: 11, color: "#fca5a5",
        }}>
          {deployError}
        </div>
      )}

      {/* Buttons */}
      {!isActive && !liveUrl && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button type="button" onClick={handleDeploy}
            onMouseEnter={() => setHover("deploy")} onMouseLeave={() => setHover(null)}
            style={{
              flex: 1, padding: "10px 14px",
              background: deployPhase === "success" ? "rgba(74,222,128,0.12)" : "#fff",
              color: deployPhase === "success" ? "#4ade80" : "#000",
              border: deployPhase === "success" ? "1px solid rgba(74,222,128,0.25)" : "1px solid rgba(255,255,255,0.10)",
              borderRadius: 6, fontFamily: M, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em",
              cursor: "pointer", transition: "all 150ms",
            }}>
            {deployPhase === "success" ? "✓ Deployed" : deployPhase === "error" ? "Retry" : "Deploy to Claude"}
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
