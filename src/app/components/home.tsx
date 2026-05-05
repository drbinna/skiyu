import {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { useNavigate } from "react-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { preloadRoute } from "../routes";
import NavAuth from "./nav-auth";
import Wordmark from "./wordmark";
import SkillCard from "./skill-card";
import type { SkillCatalogItem } from "@/lib/types";

const F = "'Erode', 'Cormorant Garamond', Georgia, serif";
const M = "'Fragment Mono', 'JetBrains Mono', Menlo, monospace";

// ── Featured skills (loaded once) ────────────────────────────

function useFeaturedSkills() {
  const [skills, setSkills] = useState<SkillCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("v_skill_catalog")
        .select("*")
        .eq("sync_status", "active")
        .order("quality_score", { ascending: false })
        .limit(8);
      if (data) setSkills(data as unknown as SkillCatalogItem[]);
      setLoading(false);
    })();
  }, []);

  return { skills, loading };
}

// ── Chat message types ───────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
}

// ── Main component ───────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { skills: featured, loading: featuredLoading } = useFeaturedSkills();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "56px";
    ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [messages]);

  // ── Send message ────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || chatBusy) return;
    setInput("");
    setChatOpen(true);
    if (textareaRef.current) textareaRef.current.style.height = "56px";

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setChatBusy(true);

    try {
      const sbBase = (supabase as unknown as { supabaseUrl: string }).supabaseUrl;
      const anonKey = (supabase as unknown as { supabaseKey: string }).supabaseKey;
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? anonKey;

      const res = await fetch(`${sbBase}/functions/v1/chat-with-skill`, {
        method: "POST",
        headers: { "content-type": "application/json", apikey: anonKey, authorization: `Bearer ${token}` },
        body: JSON.stringify({
          skill_slug: "skill-composer",
          messages: newMessages.slice(-10),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessages(prev => [...prev, { role: "assistant", content: err.error ?? "Something went wrong." }]);
        setChatBusy(false);
        return;
      }

      // Stream SSE
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let fullText = "";
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

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
            const payload = JSON.parse(line.slice(6));
            if (payload.type === "content_block_delta" && payload.delta?.text) {
              fullText += payload.delta.text;
              setMessages(prev => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: fullText };
                return copy;
              });
            }
          } catch { /**/ }
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Connection error. Try again." }]);
    } finally {
      setChatBusy(false);
    }
  }, [input, messages, chatBusy]);

  // ── Action chip handler ─────────────────────────────────────
  const handleChip = (text: string) => {
    setInput(text);
    setChatOpen(true);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  return (
    <div style={{ background: "#000", color: "#fff", minHeight: "100vh", fontFamily: F }}>
      {/* ── NAV ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100, height: 52,
        padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(0,0,0,0.90)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        <Wordmark size={18} clickable />
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          {(["Explore", "Publish"] as const).map(l => {
            const path = `/${l.toLowerCase()}` as keyof typeof preloadRoute;
            return (
              <span key={l} role="link" tabIndex={0} onClick={() => navigate(path)} onMouseEnter={() => preloadRoute[path]?.()}
                style={{ fontFamily: F, fontStyle: "italic", fontSize: 13, color: "rgba(255,255,255,0.40)", cursor: "pointer" }}>{l}</span>
            );
          })}
          <NavAuth />
        </div>
      </nav>

      {/* ── HERO + CHAT ── */}
      <section style={{
        maxWidth: 720, margin: "0 auto", padding: chatOpen ? "40px 20px 0" : "min(12vh, 120px) 20px 0",
        transition: "padding 400ms cubic-bezier(0.25, 0.8, 0.25, 1)",
      }}>
        {/* Headline — shrinks when chat is open */}
        <h1 style={{
          textAlign: "center",
          fontFamily: F,
          fontWeight: 700,
          fontSize: chatOpen ? "clamp(20px, 3vw, 28px)" : "clamp(32px, 5vw, 52px)",
          letterSpacing: "-0.035em",
          lineHeight: 1.1,
          transition: "font-size 400ms cubic-bezier(0.25, 0.8, 0.25, 1)",
          marginBottom: chatOpen ? 16 : 32,
        }}>
          <span style={{ color: "#fff" }}>What skill do you need?</span>
        </h1>

        {/* Chat messages — shown when conversation starts */}
        {chatOpen && messages.length > 0 && (
          <div ref={chatScrollRef} style={{
            maxHeight: "45vh", overflowY: "auto", marginBottom: 16,
            display: "flex", flexDirection: "column", gap: 10,
            padding: "0 4px",
          }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%",
                padding: "10px 14px",
                borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                background: m.role === "user" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.025)",
                border: `1px solid ${m.role === "user" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)"}`,
                fontFamily: m.role === "user" ? M : F,
                fontStyle: m.role === "assistant" ? "italic" : "normal",
                fontSize: m.role === "user" ? 13 : 14,
                color: "rgba(255,255,255,0.80)",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}>
                {m.content || (chatBusy && i === messages.length - 1 ? "…" : "")}
              </div>
            ))}
          </div>
        )}

        {/* Chat input */}
        <div style={{
          position: "relative",
          background: "rgba(255,255,255,0.03)",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.08)",
          transition: "border-color 200ms",
        }}
          onFocus={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)")}
          onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => { setInput(e.target.value); adjustHeight(); }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
            placeholder="Find a skill, author a new one, or ask anything…"
            rows={1}
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "16px 18px 8px",
              background: "transparent", border: "none", outline: "none",
              color: "#fff", fontFamily: F, fontStyle: "italic", fontSize: 15,
              lineHeight: 1.5, resize: "none",
              minHeight: 56, maxHeight: 180,
              overflow: "hidden",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 12px 10px" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {/* Stats chip */}
              <span style={{
                fontFamily: M, fontSize: 10, color: "rgba(255,255,255,0.20)",
                padding: "4px 8px", borderRadius: 6,
                background: "rgba(255,255,255,0.02)",
              }}>
                1,091 skills
              </span>
            </div>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!input.trim() || chatBusy}
              style={{
                width: 30, height: 30, borderRadius: 8, border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: input.trim() && !chatBusy ? "#fff" : "rgba(255,255,255,0.06)",
                cursor: input.trim() && !chatBusy ? "pointer" : "default",
                transition: "background 150ms",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: "rotate(-90deg)" }}>
                <path d="M7 1L7 13M7 1L1 7M7 1L13 7" stroke={input.trim() && !chatBusy ? "#000" : "rgba(255,255,255,0.25)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Action chips */}
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center",
          marginTop: 16, padding: "0 4px",
        }}>
          {[
            { icon: "🔍", label: "Find a skill for my task", prompt: "Help me find a skill for " },
            { icon: "✏️", label: "Author a new skill", prompt: "I want to build a skill that " },
            { icon: "🚀", label: "Deploy to Claude", prompt: "How do I deploy a skill to Claude?" },
            { icon: "📦", label: "Import from GitHub", prompt: "I want to import a skill from my GitHub repo" },
          ].map(chip => (
            <button
              key={chip.label}
              type="button"
              onClick={() => handleChip(chip.prompt)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "8px 14px", borderRadius: 100,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.45)",
                fontFamily: M, fontSize: 11,
                cursor: "pointer",
                transition: "all 150ms",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.18)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)"; }}
            >
              <span style={{ fontSize: 13 }}>{chip.icon}</span>
              {chip.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── FEATURED SKILLS ── */}
      <section style={{
        maxWidth: 1100, margin: "0 auto",
        padding: chatOpen ? "40px 24px 0" : "80px 24px 0",
        transition: "padding 400ms",
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "baseline",
          marginBottom: 20,
        }}>
          <div style={{
            fontFamily: M, fontSize: 10, fontWeight: 600,
            letterSpacing: "0.20em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.20)",
          }}>
            FEATURED SKILLS
          </div>
          <span
            role="link" tabIndex={0}
            onClick={() => navigate("/explore")}
            onMouseEnter={() => preloadRoute["/explore"]()}
            style={{
              fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.30)",
              cursor: "pointer", textDecoration: "none",
              borderBottom: "1px solid rgba(255,255,255,0.10)",
              paddingBottom: 1,
            }}
          >
            Browse all →
          </span>
        </div>

        {featuredLoading ? (
          <div style={{ fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.20)", padding: "40px 0", textAlign: "center" }}>
            Loading…
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 14,
          }}>
            {featured.map(skill => (
              <SkillCard key={skill.id} skill={skill} userId={user?.id ?? null} />
            ))}
          </div>
        )}
      </section>

      {/* ── CATEGORIES ── */}
      <section style={{
        maxWidth: 1100, margin: "0 auto",
        padding: "48px 24px 0",
      }}>
        <div style={{
          fontFamily: M, fontSize: 10, fontWeight: 600,
          letterSpacing: "0.20em", textTransform: "uppercase",
          color: "rgba(255,255,255,0.20)", marginBottom: 14,
        }}>
          BROWSE BY CATEGORY
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[
            "Security & compliance",
            "Backend development",
            "DevOps & infrastructure",
            "Agent & orchestration",
            "Testing & QA",
            "AI & machine learning",
            "Media & creative",
            "Marketing & SEO",
          ].map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => navigate(`/explore?category=${encodeURIComponent(cat)}`)}
              style={{
                padding: "7px 14px", borderRadius: 6,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.40)",
                fontFamily: M, fontSize: 11,
                cursor: "pointer",
                transition: "all 150ms",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.40)"; }}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* ── FOOTER STATS ── */}
      <footer style={{
        maxWidth: 1100, margin: "0 auto",
        padding: "56px 24px 40px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderTop: "1px solid rgba(255,255,255,0.04)",
        marginTop: 56,
      }}>
        <div style={{ display: "flex", gap: 24 }}>
          {[
            { val: "1,091", label: "skills" },
            { val: "24", label: "authors" },
            { val: "12", label: "categories" },
          ].map(s => (
            <div key={s.label}>
              <span style={{ fontFamily: M, fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.60)" }}>{s.val}</span>
              <span style={{ fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.20)", marginLeft: 6 }}>{s.label}</span>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: M, fontSize: 10, color: "rgba(255,255,255,0.15)" }}>
          connected to Claude via MCP
        </div>
      </footer>
    </div>
  );
}
