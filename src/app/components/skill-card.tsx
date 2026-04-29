import { useState, useCallback, useEffect, useRef, type KeyboardEvent } from "react";
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
  const [deploying, setDeploying] = useState(false);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [deployStatus, setDeployStatus] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const previewLine =
    deployStatus === "completed" || deployStatus === "done"
      ? "✓ Deployed to your Claude workspace"
      : hover === "deploy"
        ? "→ deploy to Claude"
        : hover === "zip"
          ? `→ ${skill.slug}.zip`
          : `updated ${formatRelative(skill.updated_at)}`;

  // Poll Browser Use session status
  useEffect(() => {
    if (!sessionId) return;

    const poll = async () => {
      try {
        const sbBase = (supabase as unknown as { supabaseUrl: string }).supabaseUrl;
        const anonKey = (supabase as unknown as { supabaseKey: string }).supabaseKey;
        const res = await fetch(`${sbBase}/functions/v1/browser-use-deploy`, {
          method: "POST",
          headers: { "content-type": "application/json", apikey: anonKey },
          body: JSON.stringify({ action: "check-status", session_id: sessionId }),
        });
        const data = await res.json();
        if (data.status === "completed" || data.status === "done" || data.status === "finished") {
          setDeployStatus("completed");
          setLiveUrl(null);
          setDeploying(false);
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (data.status === "failed" || data.status === "error") {
          setDeployStatus("failed");
          setError("Deploy failed — check the browser session for details.");
          setLiveUrl(null);
          setDeploying(false);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch { /* ignore poll errors */ }
    };

    pollRef.current = setInterval(poll, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [sessionId]);

  // Auto-clear success
  useEffect(() => {
    if (deployStatus === "completed") {
      const t = setTimeout(() => { setDeployStatus(null); setSessionId(null); }, 8000);
      return () => clearTimeout(t);
    }
  }, [deployStatus]);

  // ── Deploy via Browser Use ──────────────────────────────────
  const handleDeploy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deploying) return;

    if (!user) {
      setError("Sign in to deploy");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setDeploying(true);
    setError(null);
    setDeployStatus("starting");

    try {
      const sbBase = (supabase as unknown as { supabaseUrl: string }).supabaseUrl;
      const anonKey = (supabase as unknown as { supabaseKey: string }).supabaseKey;
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? anonKey;

      const res = await fetch(`${sbBase}/functions/v1/browser-use-deploy`, {
        method: "POST",
        headers: { "content-type": "application/json", apikey: anonKey, authorization: `Bearer ${token}` },
        body: JSON.stringify({ skill_slug: skill.slug }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to start deploy");
        setDeploying(false);
        setDeployStatus(null);
        return;
      }

      setSessionId(data.session_id);
      setLiveUrl(data.live_url);
      setDeployStatus("running");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deploy failed");
      setDeploying(false);
      setDeployStatus(null);
    }
  }, [user, skill.slug, deploying]);

  const handleCloseLive = useCallback(() => {
    setLiveUrl(null);
    // Don't cancel the session — it continues in the background
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
    if (liveUrl) return;
    if (preferModal && onOpen) onOpen(skill);
    else navigate(`/skills/${skill.slug}`);
  }, [preferModal, onOpen, skill, navigate, liveUrl]);

  const onCardKey = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCard(); }
  }, [openCard]);

  const isSuccess = deployStatus === "completed";
  const isRunning = deploying && !isSuccess;

  return (
    <>
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

        {/* Preview line */}
        <div style={{
          height: 16, fontFamily: M, fontSize: 11, marginTop: 14,
          color: isSuccess ? "#4ade80" : error ? "#fca5a5" : hover ? "rgba(255,255,255,0.60)" : "rgba(255,255,255,0.25)",
          transition: "color 150ms", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {error ?? previewLine}
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button type="button" onClick={handleDeploy}
            onMouseEnter={() => setHover("deploy")} onMouseLeave={() => setHover(null)}
            disabled={isRunning}
            style={{
              flex: 1, padding: "10px 14px",
              background: isSuccess ? "rgba(74,222,128,0.12)" : isRunning ? "rgba(255,255,255,0.10)" : "#fff",
              color: isSuccess ? "#4ade80" : isRunning ? "rgba(255,255,255,0.50)" : "#000",
              border: isSuccess ? "1px solid rgba(74,222,128,0.25)" : "1px solid rgba(255,255,255,0.10)",
              borderRadius: 6, fontFamily: M, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em",
              cursor: isRunning ? "wait" : "pointer", transition: "all 150ms",
            }}>
            {isSuccess ? "✓ Deployed" : isRunning ? "Deploying…" : "Deploy to Claude"}
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
      </div>

      {/* ── Live Browser Modal ── */}
      {liveUrl && (
        <div
          onClick={handleCloseLive}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(1100px, 95vw)", height: "min(750px, 85vh)",
              background: "#111", borderRadius: 12, overflow: "hidden",
              display: "flex", flexDirection: "column",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
            }}
          >
            {/* Header */}
            <div style={{
              flexShrink: 0, padding: "12px 20px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(0,0,0,0.4)",
            }}>
              <div>
                <div style={{ fontFamily: M, fontSize: 11, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>
                  DEPLOYING · {skill.name}
                </div>
                <div style={{ fontFamily: F, fontStyle: "italic", fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 3 }}>
                  Log in to Claude below if needed — the agent will handle the upload automatically.
                </div>
              </div>
              <button type="button" onClick={handleCloseLive}
                style={{ padding: "6px 14px", background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, fontFamily: M, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Close
              </button>
            </div>
            {/* Live browser iframe */}
            <iframe
              src={liveUrl}
              style={{ flex: 1, border: "none", width: "100%", background: "#000" }}
              title="Browser Use live session"
              allow="clipboard-write"
            />
          </div>
        </div>
      )}
    </>
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
