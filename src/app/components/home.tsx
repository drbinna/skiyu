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

// ── Search intent detection ──────────────────────────────────

const SEARCH_RE = /\b(find|search|look(?:ing)? for|show me|get me|any skill|suggest|recommend|need a skill|skill for|skills for|skills? that)\b/i;

function isSearchQuery(text: string): boolean { return SEARCH_RE.test(text); }

function extractTerms(text: string): string {
  return text.replace(SEARCH_RE, "")
    .replace(/\b(a|an|the|my|me|i|want|to|that|which|can|will|for|with|about|please|help|do|does)\b/gi, "")
    .replace(/[^\w\s-]/g, "").trim().split(/\s+/).filter(w => w.length > 2).slice(0, 5).join(" ");
}

// ── Featured skills loader ───────────────────────────────────

function useFeatured() {
  const [skills, setSkills] = useState<SkillCatalogItem[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("v_skill_catalog").select("*").eq("sync_status", "active")
        .order("quality_score", { ascending: false }).limit(8);
      if (data) setSkills(data as unknown as SkillCatalogItem[]);
    })();
  }, []);
  return skills;
}

// ── Types ────────────────────────────────────────────────────

interface Msg { role: "user" | "assistant"; content: string; skills?: SkillCatalogItem[]; }

// ══════════════════════════════════════════════════════════════
// HOME
// ══════════════════════════════════════════════════════════════

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const mobile = useIsMobile();
  const featured = useFeatured();

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);  // chat active
  const [selected, setSelected] = useState<SkillCatalogItem | null>(null);
  const [downloading, setDownloading] = useState(false);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const resize = useCallback(() => {
    const t = taRef.current; if (!t) return;
    t.style.height = "56px"; t.style.height = Math.min(t.scrollHeight, 180) + "px";
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs]);

  // ── Catalog search ──────────────────────────────────────────
  const search = useCallback(async (q: string): Promise<SkillCatalogItem[]> => {
    const terms = extractTerms(q); if (!terms) return [];
    const { data } = await supabase.from("v_skill_catalog").select("*").eq("sync_status", "active")
      .or(terms.split(" ").map(t => `name.ilike.%${t}%,description.ilike.%${t}%`).join(","))
      .order("quality_score", { ascending: false }).limit(6);
    return (data ?? []) as unknown as SkillCatalogItem[];
  }, []);

  // ── Send ────────────────────────────────────────────────────
  const send = useCallback(async () => {
    const text = input.trim(); if (!text || busy) return;
    setInput(""); setOpen(true); setBusy(true);
    if (taRef.current) taRef.current.style.height = "56px";
    const next: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next);

    // Route 1: search
    if (isSearchQuery(text)) {
      const results = await search(text).catch(() => [] as SkillCatalogItem[]);
      const terms = extractTerms(text);
      setMsgs(prev => [...prev, {
        role: "assistant",
        content: results.length ? `Found ${results.length} skill${results.length > 1 ? "s" : ""} for "${terms}":` : `No skills found for "${terms}". Try different keywords, or I can help you author one.`,
        skills: results.length ? results : undefined,
      }]);
      setBusy(false); return;
    }

    // Route 2: LLM
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
    } catch { setMsgs(p => [...p, { role: "assistant", content: "Connection error. Try again." }]); }
    finally { setBusy(false); }
  }, [input, msgs, busy, search]);

  const chip = (prompt: string) => { setInput(prompt); setOpen(true); setTimeout(() => taRef.current?.focus(), 80); };

  // ── Download handler for modal ──────────────────────────────
  const handleDownload = useCallback(async () => {
    if (!selected || downloading) return;
    setDownloading(true);
    await downloadSkill(selected.id, selected.name, user?.id ?? null);
    setTimeout(() => setDownloading(false), 1200);
  }, [selected, user, downloading]);

  return (
    <div style={{ background: "#000", color: "#fff", minHeight: "100vh", fontFamily: F }}>
      <style>{`@keyframes sk-spin{to{transform:rotate(360deg)}}`}</style>

      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, height: 52, padding: mobile ? "0 14px" : "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.90)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <Wordmark size={18} clickable />
        <div style={{ display: "flex", gap: mobile ? 12 : 20, alignItems: "center" }}>
          {!mobile && (["Explore", "Publish"] as const).map(l => {
            const p = `/${l.toLowerCase()}` as keyof typeof preloadRoute;
            return <span key={l} role="link" tabIndex={0} onClick={() => navigate(p)} onMouseEnter={() => preloadRoute[p]?.()} style={{ fontFamily: F, fontStyle: "italic", fontSize: 13, color: "rgba(255,255,255,0.40)", cursor: "pointer" }}>{l}</span>;
          })}
          <NavAuth />
        </div>
      </nav>

      {/* HERO — headline + input (always centered before chat starts) */}
      <section style={{
        maxWidth: 720, margin: "0 auto", padding: `0 ${mobile ? 14 : 20}px`,
        display: "flex", flexDirection: "column", justifyContent: open ? "flex-start" : "center",
        minHeight: open ? undefined : `min(55vh, 420px)`,
        paddingTop: open ? (mobile ? 16 : 28) : 0,
      }}>
        <h1 style={{
          textAlign: "center", fontFamily: F, fontWeight: 700,
          fontSize: open ? (mobile ? 16 : 22) : (mobile ? "clamp(24px, 7vw, 36px)" : "clamp(32px, 5vw, 52px)"),
          letterSpacing: "-0.035em", lineHeight: 1.1,
          transition: "font-size 300ms ease",
          marginBottom: open ? 10 : (mobile ? 20 : 28),
        }}>What skill do you need?</h1>

        {/* INPUT */}
        <div style={{ position: "relative", background: "rgba(255,255,255,0.03)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", transition: "border-color 200ms" }}
          onFocus={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)")}
          onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}>
          <textarea ref={taRef} value={input} onChange={e => { setInput(e.target.value); resize(); }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder="Find a skill, author a new one, or ask anything…" rows={1}
            style={{ width: "100%", boxSizing: "border-box", padding: mobile ? "14px 14px 6px" : "16px 18px 8px", background: "transparent", border: "none", outline: "none", color: "#fff", fontFamily: F, fontStyle: "italic", fontSize: mobile ? 14 : 15, lineHeight: 1.5, resize: "none", minHeight: 56, maxHeight: 180, overflow: "hidden" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 12px 10px" }}>
            <span style={{ fontFamily: M, fontSize: 10, color: busy ? "#22d3ee" : "rgba(255,255,255,0.20)", padding: "4px 8px", borderRadius: 6, background: "rgba(255,255,255,0.02)", display: "inline-flex", alignItems: "center", gap: 5, transition: "color 200ms" }}>
              {busy && <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", border: "1.5px solid rgba(34,211,238,0.3)", borderTopColor: "#22d3ee", animation: "sk-spin 0.7s linear infinite" }} />}
              {busy ? "Searching…" : "1,091 skills"}
            </span>
            <button type="button" onClick={() => void send()} disabled={!input.trim() || busy}
              style={{ width: 30, height: 30, borderRadius: 8, border: "none", display: "flex", alignItems: "center", justifyContent: "center", background: input.trim() && !busy ? "#fff" : "rgba(255,255,255,0.06)", cursor: input.trim() && !busy ? "pointer" : "default", transition: "background 150ms" }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: "rotate(-90deg)" }}>
                <path d="M7 1L7 13M7 1L1 7M7 1L13 7" stroke={input.trim() && !busy ? "#000" : "rgba(255,255,255,0.25)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* CHIPS — hidden once chat starts */}
        {!open && (
          <div style={{ display: "flex", flexWrap: mobile ? "nowrap" : "wrap", gap: 8, justifyContent: mobile ? "flex-start" : "center", marginTop: 14, overflowX: mobile ? "auto" : "visible", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
            {[
              { icon: "🔍", label: "Find a skill for my task", prompt: "Help me find a skill for " },
              { icon: "✏️", label: "Author a new skill", prompt: "I want to build a skill that " },
              { icon: "🚀", label: "Deploy to Claude", prompt: "How do I deploy a skill to Claude?" },
              { icon: "📦", label: "Import from GitHub", prompt: "I want to import a skill from my GitHub repo" },
            ].map(c => (
              <button key={c.label} type="button" onClick={() => chip(c.prompt)}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 100, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)", fontFamily: M, fontSize: 11, cursor: "pointer", transition: "all 150ms", whiteSpace: "nowrap", flexShrink: 0 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.18)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)"; }}
              ><span style={{ fontSize: 13 }}>{c.icon}</span>{c.label}</button>
            ))}
          </div>
        )}
      </section>

      {/* ── CHAT RESULTS (always below input, scrollable) ── */}
      {open && msgs.length > 0 && (
        <section ref={scrollRef} style={{ maxWidth: 720, margin: "0 auto", padding: `14px ${mobile ? 14 : 20}px 24px`, display: "flex", flexDirection: "column", gap: 10 }}>
          {msgs.map((m, i) => (
            <div key={i}>
              {m.role === "user" && (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ maxWidth: mobile ? "88%" : "72%", padding: "9px 14px", borderRadius: "14px 14px 4px 14px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", fontFamily: M, fontSize: 13, color: "rgba(255,255,255,0.80)", lineHeight: 1.5 }}>{m.content}</div>
                </div>
              )}
              {m.role === "assistant" && m.content && (
                <div style={{ maxWidth: mobile ? "92%" : "80%", padding: "9px 14px", borderRadius: "14px 14px 14px 4px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", fontFamily: F, fontStyle: "italic", fontSize: 14, color: "rgba(255,255,255,0.80)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.content}</div>
              )}
              {m.role === "assistant" && !m.content && !m.skills && busy && i === msgs.length - 1 && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: "14px 14px 14px 4px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", fontFamily: F, fontStyle: "italic", fontSize: 14, color: "rgba(255,255,255,0.40)" }}>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "#22d3ee", animation: "sk-spin 0.7s linear infinite" }} />
                  Thinking…
                </div>
              )}
              {/* Compact skill cards */}
              {m.skills && m.skills.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 8, marginTop: 8 }}>
                  {m.skills.map(sk => (
                    <button key={sk.id} type="button" onClick={() => setSelected(sk)}
                      style={{ textAlign: "left", cursor: "pointer", padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)", transition: "all 150ms" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#22d3ee"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.025)"; }}>
                      <div style={{ fontFamily: F, fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 3 }}>{sk.name}</div>
                      <div style={{ fontFamily: M, fontSize: 10, color: "rgba(255,255,255,0.30)", marginBottom: 6 }}>@{sk.author_username}{sk.category_name ? ` · ${sk.category_name}` : ""}</div>
                      <div style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>{sk.description}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* ── FEATURED SKILLS ── */}
      {(!open || msgs.length === 0) && featured.length > 0 && (
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: `${mobile ? 32 : 56}px ${mobile ? 14 : 24}px 0` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
            <div style={{ fontFamily: M, fontSize: 10, fontWeight: 600, letterSpacing: "0.20em", textTransform: "uppercase", color: "rgba(255,255,255,0.20)" }}>FEATURED SKILLS</div>
            <span role="link" tabIndex={0} onClick={() => navigate("/explore")} onMouseEnter={() => preloadRoute["/explore"]()}
              style={{ fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.30)", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.10)", paddingBottom: 1 }}>Browse all →</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {featured.map(sk => (
              <button key={sk.id} type="button" onClick={() => setSelected(sk)}
                style={{ textAlign: "left", cursor: "pointer", padding: "16px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderTop: "2px solid #22d3ee", transition: "all 150ms" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}>
                <div style={{ fontFamily: F, fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 4 }}>{sk.name}</div>
                <div style={{ fontFamily: M, fontSize: 10, color: "rgba(255,255,255,0.25)", marginBottom: 8 }}>@{sk.author_username}{sk.category_name ? ` · ${sk.category_name}` : ""}</div>
                <div style={{ fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.40)", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>{sk.description}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── CATEGORIES ── */}
      {(!open || msgs.length === 0) && (
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: `48px ${mobile ? 14 : 24}px 0` }}>
          <div style={{ fontFamily: M, fontSize: 10, fontWeight: 600, letterSpacing: "0.20em", textTransform: "uppercase", color: "rgba(255,255,255,0.20)", marginBottom: 14 }}>BROWSE BY CATEGORY</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {["Security & compliance", "Backend development", "DevOps & infrastructure", "Agent & orchestration", "Testing & QA", "AI & machine learning", "Media & creative", "Marketing & SEO"].map(cat => (
              <button key={cat} type="button" onClick={() => navigate(`/explore?category=${encodeURIComponent(cat)}`)}
                style={{ padding: "7px 14px", borderRadius: 6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.40)", fontFamily: M, fontSize: 11, cursor: "pointer", transition: "all 150ms" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.40)"; }}>{cat}</button>
            ))}
          </div>
        </section>
      )}

      {/* ── FOOTER ── */}
      <footer style={{ maxWidth: 1100, margin: "0 auto", padding: `${mobile ? 36 : 56}px ${mobile ? 14 : 24}px ${mobile ? 28 : 40}px`, display: "flex", flexDirection: mobile ? "column" : "row", justifyContent: "space-between", alignItems: mobile ? "flex-start" : "center", gap: mobile ? 12 : 0, borderTop: "1px solid rgba(255,255,255,0.04)", marginTop: mobile ? 36 : 56 }}>
        <div style={{ display: "flex", gap: 24 }}>
          {[{ v: "1,091", l: "skills" }, { v: "24", l: "authors" }, { v: "12", l: "categories" }].map(s => (
            <div key={s.l}><span style={{ fontFamily: M, fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.60)" }}>{s.v}</span><span style={{ fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.20)", marginLeft: 6 }}>{s.l}</span></div>
          ))}
        </div>
        <div style={{ fontFamily: M, fontSize: 10, color: "rgba(255,255,255,0.15)" }}>connected to Claude via MCP</div>
      </footer>

      {/* ══ SKILL DETAIL MODAL ══ */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.80)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: mobile ? 16 : 32 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto", background: "#111", border: "1px solid rgba(255,255,255,0.10)", borderTop: "2px solid #22d3ee", borderRadius: 14, padding: mobile ? "20px 18px" : "28px 32px" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <h2 style={{ fontFamily: F, fontWeight: 700, fontSize: mobile ? 20 : 24, letterSpacing: "-0.02em", margin: 0 }}>{selected.name}</h2>
                <div style={{ fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
                  @{selected.author_username}{selected.category_name ? ` · ${selected.category_name}` : ""}{selected.github_license ? ` · ${selected.github_license}` : ""}
                </div>
              </div>
              <button type="button" onClick={() => setSelected(null)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, color: "#fff", padding: "4px 10px", fontFamily: M, fontSize: 11, cursor: "pointer" }}>✕</button>
            </div>

            {/* Description */}
            <p style={{ fontFamily: F, fontStyle: "italic", fontSize: 14, color: "rgba(255,255,255,0.60)", lineHeight: 1.6, margin: "0 0 16px" }}>{selected.description}</p>

            {/* Audience */}
            {selected.audience && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: M, fontSize: 10, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 4 }}>FOR</div>
                <div style={{ fontFamily: F, fontStyle: "italic", fontSize: 13, color: "rgba(255,255,255,0.50)", lineHeight: 1.5 }}>{selected.audience}</div>
              </div>
            )}

            {/* Meta row */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {selected.quality_score && <Tag label={`Quality: ${selected.quality_score}`} />}
              {(selected as unknown as { risk_level?: string }).risk_level && <Tag label={`Risk: ${(selected as unknown as { risk_level: string }).risk_level}`} />}
              {(selected as unknown as { input_type?: string }).input_type && <Tag label={`Input: ${(selected as unknown as { input_type: string }).input_type}`} />}
              {(selected as unknown as { output_type?: string }).output_type && <Tag label={`Output: ${(selected as unknown as { output_type: string }).output_type}`} />}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => { navigate(`/skills/${selected.slug}`); setSelected(null); }}
                style={{ flex: 1, padding: "12px", background: "#fff", color: "#000", border: "none", borderRadius: 8, fontFamily: M, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                View details
              </button>
              <button type="button" onClick={handleDownload} disabled={downloading}
                style={{ padding: "12px 18px", background: "rgba(255,255,255,0.06)", color: downloading ? "rgba(255,255,255,0.40)" : "#fff", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, fontFamily: M, fontSize: 12, fontWeight: 600, cursor: downloading ? "wait" : "pointer" }}>
                {downloading ? "↓ …" : "↓ Download"}
              </button>
            </div>

            {/* MCP hint */}
            <div style={{ marginTop: 14, fontFamily: M, fontSize: 10, color: "rgba(255,255,255,0.25)", lineHeight: 1.5, textAlign: "center" }}>
              Or use via MCP: "Use the {selected.name} skill from skiyu"
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return <span style={{ fontFamily: M, fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.40)" }}>{label}</span>;
}
