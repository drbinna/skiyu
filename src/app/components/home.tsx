import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { downloadSkill } from "@/lib/hooks";
import { preloadRoute } from "../routes";
import NavAuth from "./nav-auth";
import Wordmark from "./wordmark";
import { useIsMobile } from "./ui/use-mobile";
import type { SkillCatalogItem } from "@/lib/types";

const F = "'Erode', 'Cormorant Garamond', Georgia, serif";
const M = "'Fragment Mono', 'JetBrains Mono', Menlo, monospace";

// ── Search ───────────────────────────────────────────────────

const SEARCH_RE = /\b(find|search|look(?:ing)? for|show me|get me|any skill|suggest|recommend|need a skill|skill for|skills for|skills? that)\b/i;
function isSearch(t: string) { return SEARCH_RE.test(t); }
function terms(t: string) {
  return t.replace(SEARCH_RE, "").replace(/\b(a|an|the|my|me|i|want|to|that|which|can|will|for|with|about|please|help|do|does)\b/gi, "")
    .replace(/[^\w\s-]/g, "").trim().split(/\s+/).filter(w => w.length > 2).slice(0, 5).join(" ");
}

// ── Data loaders ─────────────────────────────────────────────

function useFeatured() {
  const [skills, setSkills] = useState<SkillCatalogItem[]>([]);
  useEffect(() => {
    supabase.from("v_skill_catalog").select("*").eq("sync_status", "active")
      .order("quality_score", { ascending: false }).limit(12)
      .then(({ data }) => { if (data) setSkills(data as unknown as SkillCatalogItem[]); });
  }, []);
  return skills;
}

const CATEGORIES = [
  "Security & compliance", "Backend development", "DevOps & infrastructure",
  "Agent & orchestration", "Testing & QA", "AI & machine learning",
  "Media & creative", "Marketing & SEO",
];

// ── Types ────────────────────────────────────────────────────

interface Msg { role: "user" | "assistant"; content: string; skills?: SkillCatalogItem[]; }

// ══════════════════════════════════════════════════════════════

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const mobile = useIsMobile();
  const featured = useFeatured();

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<SkillCatalogItem | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasMessages = msgs.length > 0;

  const resize = useCallback(() => {
    const t = taRef.current; if (!t) return;
    t.style.height = "52px"; t.style.height = Math.min(t.scrollHeight, 160) + "px";
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs]);

  // ── Catalog search ──────────────────────────────────────────
  const doSearch = useCallback(async (q: string): Promise<SkillCatalogItem[]> => {
    const t = terms(q); if (!t) return [];
    const { data } = await supabase.from("v_skill_catalog").select("*").eq("sync_status", "active")
      .or(t.split(" ").map(w => `name.ilike.%${w}%,description.ilike.%${w}%`).join(","))
      .order("quality_score", { ascending: false }).limit(6);
    return (data ?? []) as unknown as SkillCatalogItem[];
  }, []);

  // ── Send ────────────────────────────────────────────────────
  const send = useCallback(async () => {
    const text = input.trim(); if (!text || busy) return;
    setInput(""); setBusy(true);
    if (taRef.current) taRef.current.style.height = "52px";
    const next: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next);

    if (isSearch(text)) {
      const results = await doSearch(text).catch(() => [] as SkillCatalogItem[]);
      const t = terms(text);
      setMsgs(p => [...p, { role: "assistant", content: results.length ? `Found ${results.length} skill${results.length > 1 ? "s" : ""} for "${t}":` : `No skills found for "${t}". Try different keywords.`, skills: results.length ? results : undefined }]);
      setBusy(false); return;
    }

    try {
      const sbBase = (supabase as unknown as { supabaseUrl: string }).supabaseUrl;
      const anonKey = (supabase as unknown as { supabaseKey: string }).supabaseKey;
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? anonKey;
      const res = await fetch(`${sbBase}/functions/v1/chat-with-skill`, {
        method: "POST", headers: { "content-type": "application/json", apikey: anonKey, authorization: `Bearer ${token}` },
        body: JSON.stringify({ skill_slug: "skill-composer", messages: next.slice(-10) }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); setMsgs(p => [...p, { role: "assistant", content: e.error ?? "Something went wrong." }]); setBusy(false); return; }
      const reader = res.body!.getReader(); const dec = new TextDecoder();
      let buf = "", full = ""; setMsgs(p => [...p, { role: "assistant", content: "" }]);
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const evts = buf.split("\n\n"); buf = evts.pop() ?? "";
        for (const ev of evts) {
          const ln = ev.split("\n").find(l => l.startsWith("data: ")); if (!ln) continue;
          try { const p = JSON.parse(ln.slice(6)); if (p.type === "content_block_delta" && p.delta?.text) { full += p.delta.text; setMsgs(prev => { const c = [...prev]; c[c.length - 1] = { role: "assistant", content: full }; return c; }); } } catch { /**/ }
        }
      }
    } catch { setMsgs(p => [...p, { role: "assistant", content: "Connection error." }]); }
    finally { setBusy(false); }
  }, [input, msgs, busy, doSearch]);

  const chip = (prompt: string) => { setInput(prompt); setTimeout(() => taRef.current?.focus(), 80); };

  const handleDownload = useCallback(async () => {
    if (!selected || downloading) return;
    setDownloading(true);
    await downloadSkill(selected.id, selected.name, user?.id ?? null);
    setTimeout(() => setDownloading(false), 1200);
  }, [selected, user, downloading]);

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════

  return (
    <div style={{ display: "flex", height: "100vh", background: "#000", color: "#fff", fontFamily: F, overflow: "hidden" }}>
      <style>{`@keyframes sk-spin{to{transform:rotate(360deg)}} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:4px}`}</style>

      {/* ═══ LEFT SIDEBAR ═══ */}
      {(!mobile || sidebarOpen) && (
        <aside style={{
          width: mobile ? "85vw" : 280, maxWidth: 320, flexShrink: 0,
          borderRight: "1px solid rgba(255,255,255,0.06)",
          display: "flex", flexDirection: "column",
          background: mobile ? "#0a0a0a" : "transparent",
          position: mobile ? "fixed" : "relative",
          top: 0, left: 0, bottom: 0, zIndex: mobile ? 200 : 1,
          boxShadow: mobile ? "8px 0 32px rgba(0,0,0,0.6)" : "none",
        }}>
          {/* Sidebar header */}
          <div style={{ flexShrink: 0, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <Wordmark size={18} clickable />
            {mobile && (
              <button type="button" onClick={() => setSidebarOpen(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.40)", fontSize: 18, cursor: "pointer", padding: "4px 8px" }}>✕</button>
            )}
          </div>

          {/* Categories */}
          <div style={{ flexShrink: 0, padding: "14px 14px 8px" }}>
            <div style={{ fontFamily: M, fontSize: 9, fontWeight: 600, letterSpacing: "0.20em", textTransform: "uppercase", color: "rgba(255,255,255,0.18)", marginBottom: 8, padding: "0 4px" }}>CATEGORIES</div>
            {CATEGORIES.map(cat => (
              <button key={cat} type="button"
                onClick={() => { navigate(`/explore?category=${encodeURIComponent(cat)}`); if (mobile) setSidebarOpen(false); }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 8px", borderRadius: 6, border: "none", background: "transparent", color: "rgba(255,255,255,0.40)", fontFamily: M, fontSize: 11, cursor: "pointer", transition: "all 150ms", marginBottom: 1 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.40)"; }}
              >{cat}</button>
            ))}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "4px 14px" }} />

          {/* Featured skills */}
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
            <div style={{ fontFamily: M, fontSize: 9, fontWeight: 600, letterSpacing: "0.20em", textTransform: "uppercase", color: "rgba(255,255,255,0.18)", marginBottom: 8, padding: "0 4px" }}>FEATURED</div>
            {featured.map(sk => (
              <button key={sk.id} type="button"
                onClick={() => { setSelected(sk); if (mobile) setSidebarOpen(false); }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 8px", borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", marginBottom: 2, transition: "background 150ms" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                <div style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.70)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sk.name}</div>
                <div style={{ fontFamily: M, fontSize: 10, color: "rgba(255,255,255,0.20)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  @{sk.author_username}{sk.category_name ? ` · ${sk.category_name}` : ""}
                </div>
              </button>
            ))}
          </div>

          {/* Sidebar footer */}
          <div style={{ flexShrink: 0, padding: "12px 18px", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: M, fontSize: 10, color: "rgba(255,255,255,0.15)" }}>1,091 skills</span>
            <span role="link" tabIndex={0} onClick={() => navigate("/explore")} onMouseEnter={() => preloadRoute["/explore"]?.()}
              style={{ fontFamily: M, fontSize: 10, color: "rgba(255,255,255,0.30)", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.10)" }}>Browse all</span>
          </div>
        </aside>
      )}

      {/* Mobile sidebar overlay */}
      {mobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 199 }} />
      )}

      {/* ═══ MAIN CHAT AREA ═══ */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh" }}>

        {/* Top bar */}
        <div style={{ flexShrink: 0, height: 52, padding: mobile ? "0 14px" : "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {mobile && (
              <button type="button" onClick={() => setSidebarOpen(true)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.50)", fontSize: 18, cursor: "pointer", padding: "4px" }}>☰</button>
            )}
            {mobile && <Wordmark size={16} clickable />}
            {!mobile && (
              <div style={{ display: "flex", gap: 16 }}>
                {(["Explore", "Publish"] as const).map(l => {
                  const p = `/${l.toLowerCase()}` as keyof typeof preloadRoute;
                  return <span key={l} role="link" tabIndex={0} onClick={() => navigate(p)} onMouseEnter={() => preloadRoute[p]?.()} style={{ fontFamily: F, fontStyle: "italic", fontSize: 13, color: "rgba(255,255,255,0.40)", cursor: "pointer" }}>{l}</span>;
                })}
              </div>
            )}
          </div>
          <NavAuth />
        </div>

        {/* Chat content — vertically centered when empty, top-aligned when has messages */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: hasMessages ? "flex-start" : "center", overflow: "hidden" }}>

          {/* Messages scroll area */}
          {hasMessages && (
            <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: `16px ${mobile ? 14 : 32}px` }}>
              <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
                {msgs.map((m, i) => (
                  <div key={i}>
                    {m.role === "user" && (
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <div style={{ maxWidth: "80%", padding: "9px 14px", borderRadius: "16px 16px 4px 16px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", fontFamily: M, fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>{m.content}</div>
                      </div>
                    )}
                    {m.role === "assistant" && m.content && (
                      <div style={{ maxWidth: "85%", padding: "9px 14px", borderRadius: "16px 16px 16px 4px", background: "rgba(255,255,255,0.02)", fontFamily: F, fontSize: 14, color: "rgba(255,255,255,0.80)", lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.content}</div>
                    )}
                    {m.role === "assistant" && !m.content && !m.skills && busy && i === msgs.length - 1 && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: "16px 16px 16px 4px", background: "rgba(255,255,255,0.02)", fontFamily: F, fontSize: 14, color: "rgba(255,255,255,0.35)" }}>
                        <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.10)", borderTopColor: "#22d3ee", animation: "sk-spin 0.7s linear infinite" }} />
                        Thinking…
                      </div>
                    )}
                    {m.skills && m.skills.length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 8, marginTop: 8 }}>
                        {m.skills.map(sk => (
                          <button key={sk.id} type="button" onClick={() => setSelected(sk)}
                            style={{ textAlign: "left", cursor: "pointer", padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", transition: "all 150ms" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#22d3ee"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}>
                            <div style={{ fontFamily: F, fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 2 }}>{sk.name}</div>
                            <div style={{ fontFamily: M, fontSize: 10, color: "rgba(255,255,255,0.25)", marginBottom: 5 }}>@{sk.author_username}{sk.category_name ? ` · ${sk.category_name}` : ""}</div>
                            <div style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.40)", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>{sk.description}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Centered content when no messages */}
          {!hasMessages && (
            <div style={{ padding: `0 ${mobile ? 14 : 32}px`, maxWidth: 680, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
              <h1 style={{ textAlign: "center", fontFamily: F, fontWeight: 700, fontSize: mobile ? "clamp(24px, 7vw, 36px)" : "clamp(32px, 5vw, 48px)", letterSpacing: "-0.035em", lineHeight: 1.1, marginBottom: mobile ? 20 : 28 }}>
                What skill do you need?
              </h1>
            </div>
          )}

          {/* Input area — always at bottom */}
          <div style={{ flexShrink: 0, padding: `${hasMessages ? 8 : 0}px ${mobile ? 14 : 32}px ${mobile ? 14 : 20}px` }}>
            <div style={{ maxWidth: 680, margin: "0 auto" }}>
              <div style={{ position: "relative", background: "rgba(255,255,255,0.03)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", transition: "border-color 200ms" }}
                onFocus={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)")}
                onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}>
                <textarea ref={taRef} value={input} onChange={e => { setInput(e.target.value); resize(); }}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                  placeholder="Find a skill, author a new one, or ask anything…" rows={1}
                  style={{ width: "100%", boxSizing: "border-box", padding: mobile ? "13px 14px 5px" : "14px 18px 6px", background: "transparent", border: "none", outline: "none", color: "#fff", fontFamily: F, fontStyle: "italic", fontSize: mobile ? 14 : 15, lineHeight: 1.5, resize: "none", minHeight: 52, maxHeight: 160, overflow: "hidden" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 12px 8px" }}>
                  <span style={{ fontFamily: M, fontSize: 10, color: busy ? "#22d3ee" : "rgba(255,255,255,0.18)", display: "inline-flex", alignItems: "center", gap: 5, transition: "color 200ms" }}>
                    {busy && <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", border: "1.5px solid rgba(34,211,238,0.3)", borderTopColor: "#22d3ee", animation: "sk-spin 0.7s linear infinite" }} />}
                    {busy ? "Searching…" : "1,091 skills"}
                  </span>
                  <button type="button" onClick={() => void send()} disabled={!input.trim() || busy}
                    style={{ width: 28, height: 28, borderRadius: 7, border: "none", display: "flex", alignItems: "center", justifyContent: "center", background: input.trim() && !busy ? "#fff" : "rgba(255,255,255,0.06)", cursor: input.trim() && !busy ? "pointer" : "default", transition: "background 150ms" }}>
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ transform: "rotate(-90deg)" }}>
                      <path d="M7 1L7 13M7 1L1 7M7 1L13 7" stroke={input.trim() && !busy ? "#000" : "rgba(255,255,255,0.25)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Action chips — only when no messages */}
              {!hasMessages && (
                <div style={{ display: "flex", flexWrap: mobile ? "nowrap" : "wrap", gap: 8, justifyContent: "center", marginTop: 12, overflowX: mobile ? "auto" : "visible", scrollbarWidth: "none" }}>
                  {[
                    { icon: "🔍", label: "Find a skill", prompt: "Help me find a skill for " },
                    { icon: "✏️", label: "Author a skill", prompt: "I want to build a skill that " },
                    { icon: "🚀", label: "Deploy to Claude", prompt: "How do I deploy a skill to Claude?" },
                    { icon: "📦", label: "Import from GitHub", prompt: "I want to import a skill from my GitHub repo" },
                  ].map(c => (
                    <button key={c.label} type="button" onClick={() => chip(c.prompt)}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 100, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.40)", fontFamily: M, fontSize: 11, cursor: "pointer", transition: "all 150ms", whiteSpace: "nowrap", flexShrink: 0 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.18)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.40)"; }}>
                      <span style={{ fontSize: 12 }}>{c.icon}</span>{c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ═══ SKILL DETAIL MODAL ═══ */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.80)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: mobile ? 16 : 32 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto", background: "#111", border: "1px solid rgba(255,255,255,0.10)", borderTop: "2px solid #22d3ee", borderRadius: 14, padding: mobile ? "20px 18px" : "28px 32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <h2 style={{ fontFamily: F, fontWeight: 700, fontSize: mobile ? 20 : 24, letterSpacing: "-0.02em", margin: 0 }}>{selected.name}</h2>
                <div style={{ fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>@{selected.author_username}{selected.category_name ? ` · ${selected.category_name}` : ""}{selected.github_license ? ` · ${selected.github_license}` : ""}</div>
              </div>
              <button type="button" onClick={() => setSelected(null)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, color: "#fff", padding: "4px 10px", fontFamily: M, fontSize: 11, cursor: "pointer" }}>✕</button>
            </div>
            <p style={{ fontFamily: F, fontStyle: "italic", fontSize: 14, color: "rgba(255,255,255,0.60)", lineHeight: 1.6, margin: "0 0 16px" }}>{selected.description}</p>
            {selected.audience && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: M, fontSize: 10, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 4 }}>FOR</div>
                <div style={{ fontFamily: F, fontStyle: "italic", fontSize: 13, color: "rgba(255,255,255,0.50)", lineHeight: 1.5 }}>{selected.audience}</div>
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {selected.quality_score && <Tag label={`Quality: ${selected.quality_score}`} />}
              {(selected as unknown as { risk_level?: string }).risk_level && <Tag label={`Risk: ${(selected as unknown as { risk_level: string }).risk_level}`} />}
              {(selected as unknown as { input_type?: string }).input_type && <Tag label={`Input: ${(selected as unknown as { input_type: string }).input_type}`} />}
              {(selected as unknown as { output_type?: string }).output_type && <Tag label={`Output: ${(selected as unknown as { output_type: string }).output_type}`} />}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => { navigate(`/skills/${selected.slug}`); setSelected(null); }}
                style={{ flex: 1, padding: "12px", background: "#fff", color: "#000", border: "none", borderRadius: 8, fontFamily: M, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>View details</button>
              <button type="button" onClick={handleDownload} disabled={downloading}
                style={{ padding: "12px 18px", background: "rgba(255,255,255,0.06)", color: downloading ? "rgba(255,255,255,0.40)" : "#fff", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, fontFamily: M, fontSize: 12, fontWeight: 600, cursor: downloading ? "wait" : "pointer" }}>
                {downloading ? "↓ …" : "↓ Download"}</button>
            </div>
            <div style={{ marginTop: 14, fontFamily: M, fontSize: 10, color: "rgba(255,255,255,0.25)", lineHeight: 1.5, textAlign: "center" }}>Or use via MCP: "Use the {selected.name} skill from skiyu"</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return <span style={{ fontFamily: M, fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.40)" }}>{label}</span>;
}
