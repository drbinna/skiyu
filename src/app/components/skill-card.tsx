import { useState, useCallback, useRef, type KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import type { SkillCatalogItem } from "@/lib/types";
import { downloadSkill } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

const F = "'Erode', 'Cormorant Garamond', Georgia, serif";
const M = "'Fragment Mono', 'JetBrains Mono', Menlo, monospace";

interface TraceEvent {
  type: string;
  message?: string;
  output?: string;
  error?: boolean;
  live_url?: string;
  needs_login?: boolean;
  summary?: string;
  duration_ms?: number;
  [key: string]: unknown;
}

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

  const [deploying, setDeploying] = useState(false);
  const [deployStatus, setDeployStatus] = useState<string | null>(null);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isSuccess = deployStatus === "complete";
  const isFailed = deployStatus === "error";
  const isRunning = deploying && !isSuccess && !isFailed;

  const previewLine =
    isSuccess ? "✓ Deployed to your Claude workspace"
    : isRunning && statusMessage ? statusMessage
    : hover === "deploy" ? "→ deploy to Claude"
    : hover === "zip" ? `→ ${skill.slug}.zip`
    : `updated ${formatRelative(skill.updated_at)}`;

  // ── Deploy via Browserbase + Playwright ──────────────────────
  const handleDeploy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deploying) return;

    if (!user) {
      setError("Sign in to deploy");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setDeploying(true);
    setDeployStatus(null);
    setError(null);
    setLiveUrl(null);
    setStatusMessage("Preparing…");

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      // Step 1: Generate the zip URL via our edge function
      const sbBase = (supabase as unknown as { supabaseUrl: string }).supabaseUrl;
      const anonKey = (supabase as unknown as { supabaseKey: string }).supabaseKey;

      // Look up skill info for the zip
      const { data: skillData } = await supabase
        .from("skills")
        .select("github_repo, skill_folder_path, skill_path_in_repo")
        .eq("slug", skill.slug)
        .eq("is_canonical", true)
        .maybeSingle();

      if (!skillData?.github_repo) {
        setError("Skill has no download source");
        setDeploying(false);
        return;
      }

      setStatusMessage("Building skill zip…");

      // Build zip and upload to storage
      const zipRes = await fetch(`${sbBase}/functions/v1/zip-skill-folder`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repo: skillData.github_repo,
          skill_folder_path: skillData.skill_folder_path ?? skillData.skill_path_in_repo,
          filename: skill.slug,
        }),
      });

      if (!zipRes.ok) {
        const t = await zipRes.text();
        throw new Error(`Zip failed: ${t.slice(0, 100)}`);
      }

      const zipBlob = await zipRes.blob();

      // Upload to Supabase Storage for a public URL
      const storagePath = `deploy/${skill.slug}-${Date.now()}.zip`;
      const { error: uploadErr } = await supabase.storage
        .from("skill-zips")
        .upload(storagePath, zipBlob, { contentType: "application/zip", upsert: true });

      if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

      const { data: urlData } = supabase.storage.from("skill-zips").getPublicUrl(storagePath);
      const skillZipUrl = urlData.publicUrl;

      setStatusMessage("Starting browser…");

      // Step 2: Call the Vercel API route for deterministic Playwright automation
      const res = await fetch("/api/deploy-to-claude", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          skill_slug: skill.slug,
          skill_name: skill.name,
          skill_zip_url: skillZipUrl,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok && !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Deploy failed (${res.status})`);
      }

      if (!res.body) throw new Error("No response body");

      // Stream SSE events
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";

        for (const ev of events) {
          const line = ev.split("\n").find(l => l.startsWith("data: "));
          if (!line) continue;
          try {
            const payload = JSON.parse(line.slice(6)) as TraceEvent;

            if (payload.type === "status") {
              setStatusMessage(payload.message ?? null);
            }
            if (payload.type === "sandbox_ready" && payload.live_url) {
              setLiveUrl(payload.live_url as string);
            }
            if (payload.type === "error") {
              if (payload.needs_login && payload.live_url) {
                setLiveUrl(payload.live_url as string);
                setStatusMessage("Log in to Claude in the browser window, then retry");
                setDeployStatus("needs_login");
                setDeploying(false);
              } else {
                setError(payload.message ?? "Deploy failed");
                setDeployStatus("error");
                setDeploying(false);
              }
            }
            if (payload.type === "complete") {
              setDeployStatus("complete");
              setStatusMessage(payload.summary ?? "Deployed");
              setDeploying(false);
              setLiveUrl(null);
              setTimeout(() => { setDeployStatus(null); setStatusMessage(null); }, 8000);
            }
          } catch { /**/ }
        }
      }

      if (!deployStatus) {
        setDeployStatus("complete");
        setDeploying(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Deploy failed";
      if (!msg.toLowerCase().includes("abort")) {
        setError(msg);
        setDeployStatus("error");
      }
      setDeploying(false);
    } finally {
      abortRef.current = null;
    }
  }, [user, skill.slug, skill.name, deploying, deployStatus]);

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

        {/* Status line */}
        <div style={{
          minHeight: 16, fontFamily: M, fontSize: 11, marginTop: 14,
          color: isSuccess ? "#4ade80" : isFailed || error ? "#fca5a5" : isRunning ? "#22d3ee" : hover ? "rgba(255,255,255,0.60)" : "rgba(255,255,255,0.25)",
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
              background: isSuccess ? "rgba(74,222,128,0.12)" : isRunning ? "rgba(34,211,238,0.10)" : "#fff",
              color: isSuccess ? "#4ade80" : isRunning ? "#22d3ee" : "#000",
              border: isSuccess ? "1px solid rgba(74,222,128,0.25)" : isRunning ? "1px solid rgba(34,211,238,0.20)" : "1px solid rgba(255,255,255,0.10)",
              borderRadius: 6, fontFamily: M, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em",
              cursor: isRunning ? "wait" : "pointer", transition: "all 150ms",
            }}>
            {isSuccess ? "✓ Deployed" : isRunning ? "Deploying…" : isFailed ? "Retry" : "Deploy to Claude"}
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

      {/* ── Live Browserbase Session Modal ── */}
      {liveUrl && (
        <div
          onClick={() => setLiveUrl(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(1100px, 95vw)", height: "min(750px, 85vh)",
              background: "#111", borderRadius: 12, overflow: "hidden",
              display: "flex", flexDirection: "column",
              border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{
              flexShrink: 0, padding: "12px 20px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.4)",
            }}>
              <div>
                <div style={{ fontFamily: M, fontSize: 11, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>
                  {deployStatus === "needs_login" ? "LOG IN TO CLAUDE" : `DEPLOYING · ${skill.name}`}
                </div>
                <div style={{ fontFamily: F, fontStyle: "italic", fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 3 }}>
                  {deployStatus === "needs_login"
                    ? "Log in below, then close this window and click Deploy again."
                    : "The automation is running — you can watch it here."}
                </div>
              </div>
              <button type="button" onClick={() => setLiveUrl(null)}
                style={{ padding: "6px 14px", background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, fontFamily: M, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Close
              </button>
            </div>
            <iframe src={liveUrl} style={{ flex: 1, border: "none", width: "100%", background: "#000" }} title="Browserbase session" allow="clipboard-write" />
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
