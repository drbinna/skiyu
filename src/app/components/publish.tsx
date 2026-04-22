import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { uploadSkillPackage, formatFileSize } from "@/lib/hooks";
import NavAuth from "./nav-auth";
import { preloadRoute } from "../routes";

// ── Description validators (spec §1 + §2) ──────────────────
// Descriptions must be concrete, non-marketing, and semantically related to
// the skill title. These run at write-time in the publish flow.

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

// Conservative English stopword list for the title/description overlap check.
const STOPWORDS = new Set([
  "a", "an", "and", "as", "at", "be", "by", "for", "from", "has", "have", "in",
  "into", "is", "it", "its", "of", "on", "or", "that", "the", "this", "to",
  "was", "were", "will", "with", "your", "you", "skill", "skills",
]);

function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

export interface DescriptionValidation {
  blocking: string | null;
  warning: string | null;
}

export function validateDescription(
  title: string,
  description: string
): DescriptionValidation {
  const trimmed = description.trim();

  if (trimmed.length > 0 && trimmed.length < 40) {
    return {
      blocking: "Describe what the skill does, who it's for, and the problem it solves.",
      warning: null,
    };
  }

  if (trimmed.length > 500) {
    return {
      blocking: "Keep the description focused. Details belong in SKILL.md.",
      warning: null,
    };
  }

  if (trimmed.length >= 40 && title.trim().length > 0) {
    const titleWords = contentWords(title);
    const descWords = contentWords(trimmed);
    let overlap = 0;
    titleWords.forEach((w) => {
      if (descWords.has(w)) overlap += 1;
    });
    // Only enforce when the title itself has at least 2 content words to
    // compare against — single-word titles can't meaningfully overlap.
    if (titleWords.size >= 2 && overlap < 2) {
      return {
        blocking: "The description does not appear to describe the skill title.",
        warning: null,
      };
    }
  }

  const lowered = trimmed.toLowerCase();
  const marketingHit = MARKETING_WORDS.filter((w) => lowered.includes(w));
  if (marketingHit.length > 0) {
    return {
      blocking: null,
      warning: `Descriptions should inform, not impress. Consider revising: ${marketingHit.join(", ")}.`,
    };
  }

  return { blocking: null, warning: null };
}

// Publisher's skills — fetched from Supabase when auth is active, mock data as fallback
function usePublisherSkills() {
  const [skills, setSkills] = useState(MOCK_SKILLS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // When auth is implemented, replace with:
    // supabase.from('v_skill_catalog').select('*').eq('author_username', user.github_username)
    supabase
      .from("v_skill_catalog")
      .select("*")
      .limit(5)
      .order("install_count", { ascending: false })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setSkills(data.map((s, i) => ({
            id: i + 1,
            name: s.name,
            version: "1.0.0",
            status: "published" as const,
            installs: s.install_count,
            rating: s.avg_rating || 0,
            reviews: s.review_count,
            updated: "recently",
            views: s.install_count * 3,
            runs: s.install_count * 5,
            license: s.github_license || "MIT",
            size: "—",
            trend: Math.floor(Math.random() * 15),
          })));
        }
        setLoading(false);
      });
  }, []);

  return { skills, loading };
}

const MOCK_SKILLS = [
  { id: 1, name: "PDF Architect", version: "2.4.1", status: "published" as const, installs: 12400, rating: 4.9, reviews: 342, updated: "2d ago", views: 34200, runs: 89400, license: "MIT", size: "24KB", trend: +12 },
  { id: 2, name: "Docx Formatter", version: "4.1.2", status: "published" as const, installs: 8900, rating: 4.6, reviews: 245, updated: "1d ago", views: 21800, runs: 45600, license: "MIT", size: "33KB", trend: +8 },
  { id: 3, name: "Slide Deck Maker", version: "3.0.1", status: "published" as const, installs: 7800, rating: 4.6, reviews: 203, updated: "1w ago", views: 18400, runs: 31200, license: "Proprietary", size: "67KB", trend: +3 },
  { id: 4, name: "Invoice Generator", version: "1.0.0-beta", status: "review" as const, installs: 0, rating: 0, reviews: 0, updated: "3h ago", views: 0, runs: 0, license: "MIT", size: "19KB", trend: 0 },
  { id: 5, name: "Email Template Pro", version: "0.9.0", status: "draft" as const, installs: 0, rating: 0, reviews: 0, updated: "5d ago", views: 0, runs: 0, license: "MIT", size: "12KB", trend: 0 },
];

const ACTIVITY = [
  { type: "install", text: "neural_ops installed PDF Architect", time: "2m ago" },
  { type: "review", text: "flowstate left a 5★ review on Docx Formatter", time: "18m ago" },
  { type: "fork", text: "component_lab forked PDF Architect", time: "2h ago" },
  { type: "install", text: "deck_smith installed Docx Formatter", time: "3h ago" },
  { type: "pr", text: "Pull request #12 merged on Slide Deck Maker", time: "5h ago" },
  { type: "review", text: "cloud_native left a 4★ review on PDF Architect", time: "6h ago" },
];

const M = "'Fragment Mono', monospace";
const F = "'Erode', serif";

function fmt(n: number) { return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "K" : n.toString(); }

const STATUS_MAP = {
  published: { label: "Live", color: "rgba(180,255,180,0.8)", bg: "rgba(180,255,180,0.08)" },
  review: { label: "In review", color: "rgba(255,220,150,0.8)", bg: "rgba(255,220,150,0.08)" },
  draft: { label: "Draft", color: "rgba(255,255,255,0.35)", bg: "rgba(255,255,255,0.04)" },
};

function StatusBadge({ status }: { status: "published" | "review" | "draft" }) {
  const s = STATUS_MAP[status];
  return <span style={{ fontSize: 10, fontFamily: M, padding: "3px 8px", borderRadius: 4, background: s.bg, color: s.color, fontWeight: 600, letterSpacing: "0.02em" }}>{s.label}</span>;
}

function ActivityIcon({ type }: { type: string }) {
  const map: Record<string, string> = { install: "↓", review: "★", fork: "⑂", pr: "⤴" };
  return <span style={{ fontSize: 12, width: 22, height: 22, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>{map[type]}</span>;
}

export default function Publish() {
  const [tab, setTab] = useState("skills");
  const [dragOver, setDragOver] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadStep, setUploadStep] = useState(0);
  const [claimBannerDismissed, setClaimBannerDismissed] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<number | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSkillTarget, setUploadSkillTarget] = useState<string>("");
  const [uploadVersion, setUploadVersion] = useState("1.0.0");
  const [uploadDescription, setUploadDescription] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const { user, profile, loading: authLoading, signInWithGitHub, claimableSkills, claimedSkills, claimAllSkills } = useAuth();
  const { skills: MY_SKILLS } = usePublisherSkills();

  const totalInstalls = MY_SKILLS.reduce((a, s) => a + s.installs, 0);
  const avgRating = MY_SKILLS.filter(s => s.rating > 0).reduce((a, s) => a + s.rating, 0) / MY_SKILLS.filter(s => s.rating > 0).length;
  const totalRuns = MY_SKILLS.reduce((a, s) => a + s.runs, 0);

  const handleClaimAll = async () => {
    setClaiming(true);
    const count = await claimAllSkills();
    setClaimResult(count);
    setClaiming(false);
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith(".zip")) {
      setUploadError("Only .zip files are allowed");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setUploadError("File is too large. Maximum size is 50 MB.");
      return;
    }
    setUploadError(null);
    setUploadFile(file);
    setUploadStep(1);
  };

  // Pre-fill the description input with the skill's current description when
  // the creator picks a target skill. They can edit/keep it; empty means no
  // change on upload.
  useEffect(() => {
    if (!uploadSkillTarget) {
      setUploadDescription("");
      return;
    }
    const target = claimedSkills.find((s) => s.id === uploadSkillTarget);
    if (target) {
      setUploadDescription(target.description || "");
    }
  }, [uploadSkillTarget, claimedSkills]);

  const handleUpload = async () => {
    if (!uploadFile || !user || !uploadSkillTarget) {
      setUploadError("Please select a skill to upload for");
      return;
    }

    // Run description validation (spec §1 + §2).
    const targetSkill = claimedSkills.find((s) => s.id === uploadSkillTarget);
    const titleForValidation = targetSkill?.name || "";
    const descForValidation = uploadDescription.trim();
    if (descForValidation.length > 0) {
      const { blocking } = validateDescription(titleForValidation, descForValidation);
      if (blocking) {
        setUploadError(blocking);
        return;
      }
    }

    setUploadProgress(10);
    const result = await uploadSkillPackage(
      uploadSkillTarget,
      user.id,
      uploadFile,
      uploadVersion
    );
    if (result.success) {
      // Persist the revised description, if the creator provided one.
      if (descForValidation.length > 0) {
        await supabase
          .from("skills")
          .update({ description: descForValidation })
          .eq("id", uploadSkillTarget);
      }
      setUploadProgress(100);
      setUploadStep(2);
    } else {
      setUploadError(result.error || "Upload failed");
      setUploadProgress(0);
    }
  };

  const resetUpload = () => {
    setShowUpload(false);
    setUploadStep(0);
    setUploadFile(null);
    setUploadProgress(0);
    setUploadError(null);
    setUploadSkillTarget("");
    setUploadVersion("1.0.0");
    setUploadDescription("");
  };

  return (
    <div style={{ background: "#000", color: "#fff", minHeight: "100vh", fontFamily: F }}>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        ::selection{background:#fff;color:#000}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:#000}
        ::-webkit-scrollbar-thumb{background:#222;border-radius:2px}
        input::placeholder{color:rgba(255,255,255,0.2)}
        .row-item{transition:background .2s;cursor:pointer;position:relative}
        .row-item:hover{background:rgba(255,255,255,0.03)!important}
        .action-btn{transition:all .2s;cursor:pointer;font-family:inherit}
        .action-btn:hover{background:#fff!important;color:#000!important}
        .ghost-btn{transition:all .2s;cursor:pointer;font-family:inherit}
        .ghost-btn:hover{border-color:rgba(255,255,255,0.3)!important;background:rgba(255,255,255,0.04)!important}
        .feed-item{transition:background .2s}
        .feed-item:hover{background:rgba(255,255,255,0.02)}
        .upload-zone{transition:all .3s;cursor:pointer}
        .upload-zone:hover{border-color:rgba(255,255,255,0.2)!important;background:rgba(255,255,255,0.03)!important}
      `}</style>

      {/* NAV */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100, height: 56, padding: "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <span onClick={() => navigate("/")} style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.5px", cursor: "pointer", fontFamily: F }}>/ skiyu</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontFamily: M }}>/publish</span>
        </div>
        <div style={{ display: "flex", gap: 20, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
          {[
            { label: "Explore", path: "/explore" as const },
            { label: "Publish", path: "/publish" as const },
            { label: "Docs", path: "/docs" as const },
          ].map(l => (
            <span
              key={l.label}
              onClick={() => navigate(l.path)}
              onMouseEnter={() => preloadRoute[l.path]?.()}
              onFocus={() => preloadRoute[l.path]?.()}
              tabIndex={0}
              style={{ cursor: "pointer", color: l.label === "Publish" ? "#fff" : undefined, fontWeight: l.label === "Publish" ? 600 : 400 }}
            >{l.label}</span>
          ))}
        </div>
        <NavAuth />
      </nav>

      {/* AUTH GATE — show sign-in screen when not logged in */}
      {!authLoading && !user ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 56px)", padding: 48 }}>
          <div style={{ textAlign: "center", maxWidth: 420 }}>
            <div style={{ fontSize: 64, marginBottom: 24, opacity: 0.08, fontWeight: 800 }}>/</div>
            <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 12 }}>Publisher Dashboard</h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.7, marginBottom: 32 }}>
              Sign in with GitHub to manage your skills, track installs, respond to reviews, and claim skills you've published on GitHub.
            </p>
            <button
              onClick={signInWithGitHub}
              style={{
                background: "#fff", color: "#000", border: "none",
                padding: "12px 32px", borderRadius: 8, fontSize: 14, fontWeight: 700,
                cursor: "pointer", fontFamily: F,
                display: "inline-flex", alignItems: "center", gap: 8,
                transition: "all 0.2s",
              }}
              onMouseEnter={e => { (e.currentTarget.style.background) = "rgba(255,255,255,0.9)"; }}
              onMouseLeave={e => { (e.currentTarget.style.background) = "#fff"; }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              Continue with GitHub
            </button>
            <div style={{ marginTop: 24, display: "flex", gap: 24, justifyContent: "center" }}>
              {[
                { num: "0%", label: "Commission" },
                { num: "22+", label: "Skills listed" },
                { num: "16", label: "Categories" },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{s.num}</div>
                  <div style={{ fontSize: 10, fontFamily: M, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
      <>

      {/* CLAIM BANNER — show when user has unclaimed skills */}
      {user && claimableSkills.length > 0 && !claimBannerDismissed && (
        <div style={{
          margin: "0 auto", maxWidth: 1200, padding: "0 24px",
        }}>
          <div style={{
            margin: "16px 0 0",
            padding: "20px 24px",
            background: "rgba(34,211,238,0.04)",
            border: "1px solid rgba(34,211,238,0.12)",
            borderRadius: 12,
            display: "flex", alignItems: "flex-start", gap: 16,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "rgba(34,211,238,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, flexShrink: 0,
            }}>⚡</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                {claimResult !== null
                  ? `${claimResult} skill${claimResult !== 1 ? "s" : ""} claimed!`
                  : `${claimableSkills.length} skill${claimableSkills.length !== 1 ? "s" : ""} found on GitHub`
                }
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 12 }}>
                {claimResult !== null
                  ? "You now have full control — set pricing, view analytics, and push updates."
                  : `We found skills published under @${profile?.github_username} that aren't claimed yet. Claim them to manage pricing, analytics, and updates.`
                }
              </div>
              {claimResult === null && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  {claimableSkills.map(s => (
                    <span key={s.id} style={{
                      fontSize: 11, fontFamily: M,
                      padding: "4px 10px", borderRadius: 6,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.5)",
                    }}>{s.name} · ↓{fmt(s.install_count)}</span>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                {claimResult === null ? (
                  <button
                    onClick={handleClaimAll}
                    disabled={claiming}
                    style={{
                      background: "#22d3ee", color: "#000", border: "none",
                      padding: "8px 20px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                      cursor: claiming ? "wait" : "pointer", fontFamily: F,
                      opacity: claiming ? 0.7 : 1,
                      transition: "all 0.2s",
                    }}
                  >{claiming ? "Claiming..." : `Claim ${claimableSkills.length > 1 ? "all" : ""}`}</button>
                ) : null}
                <button
                  onClick={() => setClaimBannerDismissed(true)}
                  style={{
                    background: "transparent", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)",
                    padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 500,
                    cursor: "pointer", fontFamily: F,
                    transition: "all 0.2s",
                  }}
                >{claimResult !== null ? "Got it" : "Later"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", maxWidth: 1200, margin: "0 auto" }}>

        {/* SIDEBAR */}
        <aside style={{
          width: 220, flexShrink: 0,
          borderRight: "1px solid rgba(255,255,255,0.04)",
          padding: "20px 16px",
          position: "sticky", top: 56, height: "calc(100vh - 56px)", overflowY: "auto",
        }}>
          <button className="action-btn" onClick={() => setShowUpload(true)} style={{
            width: "100%", padding: "10px 0", borderRadius: 8, border: "none",
            background: "#fff", color: "#000", fontSize: 13, fontWeight: 700, marginBottom: 20,
          }}>+ New Skill</button>

          {[
            { id: "skills", label: "My Skills", count: String(MY_SKILLS.length) },
            { id: "analytics", label: "Analytics", count: null },
            { id: "activity", label: "Activity", count: String(ACTIVITY.length) },
            { id: "settings", label: "Settings", count: null },
          ].map(t => (
            <div key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "8px 10px", borderRadius: 6, marginBottom: 2, cursor: "pointer",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: tab === t.id ? "rgba(255,255,255,0.06)" : "transparent",
              color: tab === t.id ? "#fff" : "rgba(255,255,255,0.35)",
              fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
              transition: "all .2s",
            }}>
              <span>{t.label}</span>
              {t.count !== null && <span style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.15)" }}>{t.count}</span>}
            </div>
          ))}
        </aside>

        {/* MAIN */}
        <main style={{ flex: 1, minWidth: 0 }}>

          {/* STATS BAR */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1px",
            background: "rgba(255,255,255,0.04)",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}>
            {[
              { label: "Total installs", val: fmt(totalInstalls), trend: "+23 today" },
              { label: "Total runs", val: fmt(totalRuns), trend: "+412 today" },
              { label: "Avg rating", val: avgRating.toFixed(1) + " ★", trend: "790 reviews" },
              { label: "Published skills", val: String(MY_SKILLS.filter(s => s.status === "published").length), trend: MY_SKILLS.length + " total" },
            ].map(s => (
              <div key={s.label} style={{ background: "#000", padding: "18px 20px" }}>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>{s.val}</div>
                <div style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.2)", marginTop: 4 }}>{s.label}</div>
                <div style={{ fontSize: 10, fontFamily: M, color: "rgba(255,255,255,0.12)", marginTop: 2 }}>{s.trend}</div>
              </div>
            ))}
          </div>

          {/* TAB: MY SKILLS */}
          {tab === "skills" && (
            <>
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 80px 80px 80px 80px 70px",
                padding: "10px 24px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                fontSize: 10, fontFamily: M, color: "rgba(255,255,255,0.2)",
                letterSpacing: "0.08em", textTransform: "uppercase",
              }}>
                <span>Skill</span>
                <span style={{ textAlign: "right" }}>Status</span>
                <span style={{ textAlign: "right" }}>Installs</span>
                <span style={{ textAlign: "right" }}>Runs</span>
                <span style={{ textAlign: "right" }}>Rating</span>
                <span style={{ textAlign: "right" }}>Trend</span>
              </div>

              {MY_SKILLS.map(s => (
                <div key={s.id} className="row-item" style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 80px 80px 80px 80px 70px",
                  padding: "14px 24px", alignItems: "center",
                  borderBottom: "1px solid rgba(255,255,255,0.03)",
                }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{s.name}</span>
                      <span style={{ fontSize: 10, fontFamily: M, color: "rgba(255,255,255,0.15)" }}>v{s.version}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.12)" }}>{s.license}</span>
                      <span style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.1)" }}>·</span>
                      <span style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.12)" }}>{s.size}</span>
                      <span style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.1)" }}>·</span>
                      <span style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.12)" }}>updated {s.updated}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}><StatusBadge status={s.status} /></div>
                  <div style={{ textAlign: "right", fontSize: 13, fontFamily: M, color: "rgba(255,255,255,0.5)" }}>{s.installs > 0 ? fmt(s.installs) : "—"}</div>
                  <div style={{ textAlign: "right", fontSize: 13, fontFamily: M, color: "rgba(255,255,255,0.5)" }}>{s.runs > 0 ? fmt(s.runs) : "—"}</div>
                  <div style={{ textAlign: "right", fontSize: 13, fontFamily: M, color: "rgba(255,255,255,0.5)" }}>{s.rating > 0 ? s.rating + " ★" : "—"}</div>
                  <div style={{ textAlign: "right", fontSize: 12, fontFamily: M, color: s.trend > 0 ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.1)" }}>
                    {s.trend > 0 ? `+${s.trend}%` : "—"}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* TAB: ACTIVITY */}
          {tab === "activity" && (
            <div>
              <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 10, fontFamily: M, color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Recent activity
              </div>
              {ACTIVITY.map((a, i) => (
                <div key={i} className="feed-item" style={{
                  padding: "12px 24px", display: "flex", alignItems: "center", gap: 12,
                  borderBottom: "1px solid rgba(255,255,255,0.03)",
                }}>
                  <ActivityIcon type={a.type} />
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", flex: 1 }}>{a.text}</span>
                  <span style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.12)", flexShrink: 0 }}>{a.time}</span>
                </div>
              ))}
            </div>
          )}

          {/* TAB: ANALYTICS */}
          {tab === "analytics" && (
            <div style={{ padding: "24px" }}>
              <div style={{ fontSize: 10, fontFamily: M, color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>
                Installs — last 30 days
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 120, padding: "0 0 8px" }}>
                {[18, 24, 31, 22, 28, 35, 42, 38, 45, 52, 48, 55, 60, 58, 63, 70, 65, 72, 68, 75, 80, 78, 85, 82, 88, 92, 90, 95, 98, 100].map((v, i) => (
                  <div key={i} style={{
                    flex: 1, height: `${v}%`, background: "rgba(255,255,255,0.08)", borderRadius: "2px 2px 0 0",
                    transition: "background .2s", cursor: "pointer",
                  }}
                    onMouseEnter={e => (e.target as HTMLDivElement).style.background = "rgba(255,255,255,0.25)"}
                    onMouseLeave={e => (e.target as HTMLDivElement).style.background = "rgba(255,255,255,0.08)"}
                  />
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: M, color: "rgba(255,255,255,0.1)", marginTop: 4 }}>
                <span>Mar 5</span><span>Mar 12</span><span>Mar 19</span><span>Mar 26</span><span>Apr 4</span>
              </div>

              <div style={{ marginTop: 32, fontSize: 10, fontFamily: M, color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>
                Per-skill breakdown
              </div>
              {MY_SKILLS.filter(s => s.status === "published").map(s => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, width: 140, flexShrink: 0 }}>{s.name}</span>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(s.installs / totalInstalls) * 100}%`, background: "rgba(255,255,255,0.2)", borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 12, fontFamily: M, color: "rgba(255,255,255,0.3)", width: 50, textAlign: "right" }}>{fmt(s.installs)}</span>
                </div>
              ))}
            </div>
          )}

          {/* TAB: SETTINGS */}
          {tab === "settings" && (
            <div style={{ padding: "24px", maxWidth: 480 }}>
              <div style={{ fontSize: 10, fontFamily: M, color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Publisher profile</div>
              {[
                { label: "Display name", val: "synthwave_dev" },
                { label: "Email", val: "dev@synthwave.io" },
                { label: "Publisher since", val: "Jan 2026" },
                { label: "Trust score", val: "94 / 100" },
              ].map(f => (
                <div key={f.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.03)", fontSize: 13 }}>
                  <span style={{ color: "rgba(255,255,255,0.35)" }}>{f.label}</span>
                  <span style={{ fontFamily: M, fontSize: 12 }}>{f.val}</span>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      </>
      )}

      {/* UPLOAD MODAL */}
      {showUpload && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={resetUpload}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 520, background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16, overflow: "hidden",
          }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Upload skill package</span>
              <span onClick={resetUpload} style={{ cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 18 }}>×</span>
            </div>

            <div style={{ padding: "16px 24px", display: "flex", gap: 8, alignItems: "center" }}>
              {["Select", "Configure", "Done"].map((s, i) => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: M,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: i <= uploadStep ? "#fff" : "rgba(255,255,255,0.06)",
                    color: i <= uploadStep ? "#000" : "rgba(255,255,255,0.2)",
                    transition: "all .3s",
                  }}>{i + 1}</div>
                  <span style={{ fontSize: 12, color: i <= uploadStep ? "#fff" : "rgba(255,255,255,0.2)", fontWeight: i === uploadStep ? 600 : 400 }}>{s}</span>
                  {i < 2 && <div style={{ width: 24, height: 1, background: "rgba(255,255,255,0.06)" }} />}
                </div>
              ))}
            </div>

            <div style={{ padding: "8px 24px 24px" }}>
              {uploadError && (
                <div style={{
                  background: "rgba(255,100,100,0.06)", border: "1px solid rgba(255,100,100,0.2)",
                  borderRadius: 8, padding: "10px 14px", marginBottom: 14,
                  fontSize: 12, color: "rgba(255,150,150,0.9)",
                }}>{uploadError}</div>
              )}

              {/* Step 0 — file drop */}
              {uploadStep === 0 && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip,application/zip"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileSelect(f);
                    }}
                  />
                  <div className="upload-zone"
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => {
                      e.preventDefault();
                      setDragOver(false);
                      const f = e.dataTransfer.files[0];
                      if (f) handleFileSelect(f);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: `1px dashed ${dragOver ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.1)"}`,
                      borderRadius: 12, padding: "40px 24px", textAlign: "center",
                      background: dragOver ? "rgba(255,255,255,0.03)" : "transparent",
                      cursor: "pointer",
                    }}>
                    <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.15 }}>↓</div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Drop your .zip file here</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>or click to browse — max 50 MB</div>
                  </div>
                  <div style={{ marginTop: 16, padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 8, fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>
                    <span style={{ color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>What gets uploaded:</span> A zipped folder containing SKILL.md + any supporting scripts. This replaces the GitHub redirect for this skill — users will download from our CDN instead.
                  </div>
                </>
              )}

              {/* Step 1 — configure skill + version */}
              {uploadStep === 1 && uploadFile && (
                <>
                  <div style={{
                    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 8, padding: "12px 14px", marginBottom: 16,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{uploadFile.name}</div>
                      <div style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                        {formatFileSize(uploadFile.size)}
                      </div>
                    </div>
                    <button onClick={() => { setUploadFile(null); setUploadStep(0); }} style={{
                      background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.4)", padding: "4px 10px", borderRadius: 6,
                      fontSize: 11, cursor: "pointer", fontFamily: F,
                    }}>Change</button>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.25)", marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>Target skill</div>
                    <select
                      value={uploadSkillTarget}
                      onChange={(e) => setUploadSkillTarget(e.target.value)}
                      style={{
                        width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 13,
                        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                        color: "#fff", outline: "none", fontFamily: F, cursor: "pointer",
                      }}>
                      <option value="" style={{ background: "#111" }}>Select a claimed skill...</option>
                      {claimedSkills.map(s => (
                        <option key={s.id} value={s.id} style={{ background: "#111" }}>{s.name}</option>
                      ))}
                    </select>
                    {claimedSkills.length === 0 && (
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 6, fontStyle: "italic" }}>
                        You need to claim a skill first before you can upload a package for it.
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.25)", marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>Version</div>
                    <input
                      value={uploadVersion}
                      onChange={(e) => setUploadVersion(e.target.value)}
                      placeholder="1.0.0"
                      style={{
                        width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 13,
                        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                        color: "#fff", outline: "none", fontFamily: M,
                      }}
                    />
                  </div>

                  {uploadSkillTarget && (() => {
                    const targetSkill = claimedSkills.find((s) => s.id === uploadSkillTarget);
                    const title = targetSkill?.name || "";
                    const validation = uploadDescription.trim().length > 0
                      ? validateDescription(title, uploadDescription)
                      : { blocking: null, warning: null };
                    const len = uploadDescription.trim().length;
                    return (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                          <div style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.25)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                            Description (optional — edit)
                          </div>
                          <div style={{ fontSize: 10, fontFamily: M, color: len > 500 ? "#fca5a5" : "rgba(255,255,255,0.25)" }}>
                            {len} / 500
                          </div>
                        </div>
                        <textarea
                          value={uploadDescription}
                          onChange={(e) => setUploadDescription(e.target.value)}
                          placeholder="Describe what this skill does, who it's for, and the problem it solves."
                          rows={4}
                          style={{
                            width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 13,
                            background: "rgba(255,255,255,0.03)",
                            border: `1px solid ${validation.blocking ? "rgba(220,38,38,0.4)" : "rgba(255,255,255,0.08)"}`,
                            color: "#fff", outline: "none", fontFamily: F, lineHeight: 1.5,
                            resize: "vertical",
                          }}
                        />
                        {validation.blocking && (
                          <div style={{
                            marginTop: 6, fontSize: 11, fontFamily: M,
                            color: "rgba(252,165,165,0.9)",
                          }}>
                            {validation.blocking}
                          </div>
                        )}
                        {!validation.blocking && validation.warning && (
                          <div style={{
                            marginTop: 6, fontSize: 11, fontFamily: M,
                            color: "rgba(252,211,77,0.85)",
                          }}>
                            ⚠ {validation.warning}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>
                        Uploading... {uploadProgress}%
                      </div>
                      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${uploadProgress}%`, background: "#22d3ee", transition: "width 0.3s" }} />
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Step 2 — success */}
              {uploadStep === 2 && (
                <>
                  <div style={{ textAlign: "center", padding: "16px 0 24px" }}>
                    <div style={{
                      width: 56, height: 56, margin: "0 auto 16px", borderRadius: 12,
                      background: "rgba(52,211,153,0.1)", color: "rgb(52,211,153)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 24,
                    }}>✓</div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Package uploaded!</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
                      Your skill now serves downloads from our CDN instead of GitHub.
                      Users will get the latest version you uploaded.
                    </div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12 }}>
                      <span style={{ color: "rgba(255,255,255,0.4)" }}>File size</span>
                      <span style={{ fontFamily: M, color: "rgba(255,255,255,0.5)" }}>{uploadFile && formatFileSize(uploadFile.size)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12 }}>
                      <span style={{ color: "rgba(255,255,255,0.4)" }}>Version</span>
                      <span style={{ fontFamily: M, color: "rgba(255,255,255,0.5)" }}>{uploadVersion}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12 }}>
                      <span style={{ color: "rgba(255,255,255,0.4)" }}>Status</span>
                      <span style={{ fontFamily: M, color: "rgb(52,211,153)" }}>Active</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div style={{
              padding: "16px 24px", borderTop: "1px solid rgba(255,255,255,0.06)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <button onClick={() => {
                if (uploadStep === 0 || uploadStep === 2) { resetUpload(); }
                else { setUploadStep(uploadStep - 1); }
              }} style={{
                padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "rgba(255,255,255,0.35)",
                cursor: "pointer", fontFamily: F,
              }}>{uploadStep === 2 ? "Close" : uploadStep === 0 ? "Cancel" : "Back"}</button>

              {uploadStep === 1 && (
                <button
                  onClick={handleUpload}
                  disabled={!uploadSkillTarget || uploadProgress > 0}
                  style={{
                    padding: "8px 20px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                    border: "none", background: !uploadSkillTarget || uploadProgress > 0 ? "rgba(255,255,255,0.2)" : "#fff",
                    color: !uploadSkillTarget || uploadProgress > 0 ? "rgba(255,255,255,0.4)" : "#000",
                    cursor: !uploadSkillTarget || uploadProgress > 0 ? "not-allowed" : "pointer",
                    fontFamily: F,
                  }}
                >{uploadProgress > 0 && uploadProgress < 100 ? "Uploading..." : "Upload to storage"}</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}