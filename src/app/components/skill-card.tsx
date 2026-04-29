import { useState, useCallback, useEffect, type KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import type { SkillCatalogItem } from "@/lib/types";
import { downloadSkill } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

const F = "'Erode', 'Cormorant Garamond', Georgia, serif";
const M = "'Fragment Mono', 'JetBrains Mono', Menlo, monospace";

// Session cache: once we know the user has a stored key, we don't
// re-check on every card mount. Reset on sign-out (page reload).
let _keyStatus: "unknown" | "has_key" | "no_key" = "unknown";

async function checkKeyStatus(): Promise<boolean> {
  if (_keyStatus !== "unknown") return _keyStatus === "has_key";
  try {
    const sbBase = (supabase as unknown as { supabaseUrl: string }).supabaseUrl;
    const anonKey = (supabase as unknown as { supabaseKey: string }).supabaseKey;
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) { _keyStatus = "no_key"; return false; }

    const res = await fetch(`${sbBase}/functions/v1/deploy-to-claude`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: anonKey, authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "check-key" }),
    });
    const data = await res.json();
    _keyStatus = data.has_key ? "has_key" : "no_key";
    return data.has_key === true;
  } catch {
    _keyStatus = "no_key";
    return false;
  }
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

  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [deployPhase, setDeployPhase] = useState<"idle" | "deploying" | "success" | "error">("idle");
  const [deployError, setDeployError] = useState<string | null>(null);

  // Check key status once per session
  useEffect(() => {
    if (!user) { setHasKey(false); return; }
    checkKeyStatus().then(setHasKey);
  }, [user]);

  const sizeLabel = typeof skill.package_size_bytes === "number" && skill.package_size_bytes > 0
    ? `~${Math.round(skill.package_size_bytes / 1024)} KB` : "—";
  const zipPreview = `${skill.slug}.zip · ${sizeLabel} · ${skill.github_license || "N/A"}`;

  const previewLine =
    deployPhase === "success" ? "✓ Deployed to your Claude workspace"
    : hover === "deploy" ? "→ one-click deploy to Claude"
    : hover === "zip" ? `→ ${zipPreview}`
    : `updated ${formatRelative(skill.updated_at)}`;

  // ── Save API key (first-time setup) ─────────────────────────
  const handleSaveKey = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const key = apiKeyInput.trim();
    if (!key.startsWith("sk-ant-")) { setSaveError("Key must start with sk-ant-"); return; }

    setSaving(true);
    setSaveError(null);

    try {
      const sbBase = (supabase as unknown as { supabaseUrl: string }).supabaseUrl;
      const anonKey = (supabase as unknown as { supabaseKey: string }).supabaseKey;
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? anonKey;

      const res = await fetch(`${sbBase}/functions/v1/deploy-to-claude`, {
        method: "POST",
        headers: { "content-type": "application/json", apikey: anonKey, authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "save-key", anthropic_api_key: key }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error ?? "Failed to save"); setSaving(false); return; }

      // Key saved — update cache, close setup, auto-deploy this skill
      _keyStatus = "has_key";
      setHasKey(true);
      setShowSetup(false);
      setApiKeyInput("");
      setSaving(false);
      // Auto-deploy the skill they were trying to deploy
      void doDeploy();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }, [apiKeyInput, skill.slug]);

  // ── Deploy (one-click after setup) ──────────────────────────
  const doDeploy = useCallback(async () => {
    setDeployPhase("deploying");
    setDeployError(null);

    try {
      const sbBase = (supabase as unknown as { supabaseUrl: string }).supabaseUrl;
      const anonKey = (supabase as unknown as { supabaseKey: string }).supabaseKey;
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? anonKey;

      const res = await fetch(`${sbBase}/functions/v1/deploy-to-claude`, {
        method: "POST",
        headers: { "content-type": "application/json", apikey: anonKey, authorization: `Bearer ${token}` },
        body: JSON.stringify({ skill_slug: skill.slug }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.needs_setup) {
          setDeployPhase("idle");
          setShowSetup(true);
          return;
        }
        setDeployError(data.error ?? "Deploy failed");
        setDeployPhase("error");
        return;
      }

      setDeployPhase("success");
      window.setTimeout(() => setDeployPhase("idle"), 4000);
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : "Deploy failed");
      setDeployPhase("error");
    }
  }, [skill.slug]);

  const handleDeployClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (deployPhase === "deploying") return;

    if (!user) {
      // Not signed in — prompt to sign in first
      setDeployError("Sign in to deploy skills to Claude");
      setDeployPhase("error");
      window.setTimeout(() => { setDeployPhase("idle"); setDeployError(null); }, 3000);
      return;
    }

    if (hasKey === false) {
      setShowSetup(true);
      return;
    }

    void doDeploy();
  }, [user, hasKey, deployPhase, doDeploy]);

  // ── Download ────────────────────────────────────────────────
  const handleZip = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    const res = await downloadSkill(skill.id, skill.name, userId);
    if (!res.success) {
      setError(res.error ?? "Download failed");
      window.setTimeout(() => setError(null), 4000);
    }
    window.setTimeout(() => setDownloading(false), 1200);
  }, [skill.id, skill.name, userId, downloading]);

  const openCard = useCallback(() => {
    if (showSetup) return; // Don't navigate while setup is open
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

      {/* Preview line */}
      <div style={{
        height: 16, fontFamily: M, fontSize: 11, marginTop: 14,
        color: deployPhase === "success" ? "#4ade80" : error || deployError ? "#fca5a5" : hover ? "rgba(255,255,255,0.60)" : "rgba(255,255,255,0.25)",
        transition: "color 150ms", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {error ?? deployError ?? previewLine}
      </div>

      {/* Setup panel — shown once, first-time only */}
      {showSetup && (
        <form onClick={(e) => e.stopPropagation()} onSubmit={handleSaveKey}
          style={{ marginTop: 10, padding: "14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontFamily: M, fontSize: 10, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>
            CONNECT ANTHROPIC — ONE TIME SETUP
          </div>
          <div style={{ fontFamily: F, fontStyle: "italic", fontSize: 12, color: "rgba(255,255,255,0.50)", lineHeight: 1.5 }}>
            Your API key is encrypted and stored securely. After this, every deploy is one click.
          </div>
          <input type="password" placeholder="sk-ant-api03-..." value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)} onClick={(e) => e.stopPropagation()}
            style={{ padding: "9px 11px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 5, color: "#fff", fontFamily: M, fontSize: 12, outline: "none", width: "100%", boxSizing: "border-box" }} />
          {saveError && <div style={{ fontFamily: M, fontSize: 11, color: "#fca5a5" }}>{saveError}</div>}
          <div style={{ display: "flex", gap: 6 }}>
            <button type="submit" disabled={!apiKeyInput.trim() || saving}
              style={{ flex: 1, padding: "9px", background: apiKeyInput.trim() && !saving ? "#fff" : "rgba(255,255,255,0.10)", color: apiKeyInput.trim() && !saving ? "#000" : "rgba(255,255,255,0.40)", border: "none", borderRadius: 5, fontFamily: M, fontSize: 11, fontWeight: 600, cursor: apiKeyInput.trim() && !saving ? "pointer" : "not-allowed" }}>
              {saving ? "Saving…" : "Connect & deploy"}
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); setShowSetup(false); setSaveError(null); }}
              style={{ padding: "9px 12px", background: "transparent", color: "rgba(255,255,255,0.40)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, fontFamily: M, fontSize: 11, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
          <div style={{ fontFamily: M, fontSize: 10, color: "rgba(255,255,255,0.30)", lineHeight: 1.5 }}>
            Get your key at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()} style={{ color: "rgba(255,255,255,0.50)", textDecoration: "underline" }}>
              console.anthropic.com
            </a>
          </div>
        </form>
      )}

      {/* Buttons */}
      {!showSetup && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button type="button" onClick={handleDeployClick}
            onMouseEnter={() => setHover("deploy")} onMouseLeave={() => setHover(null)}
            disabled={deployPhase === "deploying"}
            style={{
              flex: 1, padding: "10px 14px",
              background: deployPhase === "success" ? "rgba(74,222,128,0.12)" : deployPhase === "deploying" ? "rgba(255,255,255,0.10)" : "#fff",
              color: deployPhase === "success" ? "#4ade80" : deployPhase === "deploying" ? "rgba(255,255,255,0.50)" : "#000",
              border: deployPhase === "success" ? "1px solid rgba(74,222,128,0.25)" : "1px solid rgba(255,255,255,0.10)",
              borderRadius: 6, fontFamily: M, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em",
              cursor: deployPhase === "deploying" ? "wait" : "pointer", transition: "all 150ms",
            }}>
            {deployPhase === "success" ? "✓ Deployed"
              : deployPhase === "deploying" ? "Deploying…"
              : deployPhase === "error" ? "Retry"
              : hasKey === false ? "Connect to deploy"
              : "Deploy to Claude"}
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
