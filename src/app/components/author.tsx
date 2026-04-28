import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import NavAuth from "./nav-auth";
import Wordmark from "./wordmark";
import { preloadRoute } from "../routes";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

const F = "'Erode', 'Cormorant Garamond', Georgia, serif";
const M = "'Fragment Mono', 'JetBrains Mono', Menlo, monospace";

interface Skill {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  audience: string | null;
  does_not_do: string | null;
  github_url: string | null;
  github_repo: string | null;
  github_license: string | null;
  category_slug: string | null;
  author_username: string | null;
  updated_at: string | null;
  skill_md_content: string | null;
}

type Message =
  | { id: string; role: "user"; content: string }
  | {
      id: string;
      role: "assistant";
      content: string;
      // Streaming flag — true while tokens are still arriving.
      streaming: boolean;
    };

/**
 * Workbench v1.
 *
 * Two-pane surface where users run any skill from the catalog. Skill
 * arrives via ?skill=<slug> — that's how the card's "Run skill" button
 * deep-links here. The left pane shows the SKILL.md so users can read
 * what they're running; the right pane is the chat that streams responses
 * from the chat-with-skill edge function.
 *
 * The chat surface is branded "skiyu". Per the locked-in positioning,
 * the underlying model isn't named on the front-end. Disclosure goes
 * in legal docs later.
 */
export default function Author() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const slug = (searchParams.get("skill") ?? "").trim() || null;

  const [skill, setSkill] = useState<Skill | null>(null);
  const [skillLoading, setSkillLoading] = useState(false);
  const [skillError, setSkillError] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Load the skill on mount / slug change ──────────────────
  useEffect(() => {
    let cancelled = false;
    if (!slug) {
      setSkill(null);
      return;
    }
    setSkillLoading(true);
    setSkillError(null);
    (async () => {
      const { data, error } = await supabase
        .from("v_skill_catalog")
        .select(
          "id, slug, name, description, audience, does_not_do, github_url, github_repo, github_license, category_slug, author_username, updated_at",
        )
        .eq("slug", slug)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setSkillError("Skill not found in the catalog.");
        setSkill(null);
        setSkillLoading(false);
        return;
      }
      // Pull skill_md_content separately from the underlying skills table —
      // the catalog view doesn't expose it.
      const { data: extra } = await supabase
        .from("skills")
        .select("skill_md_content")
        .eq("id", data.id)
        .maybeSingle();
      if (cancelled) return;
      setSkill({
        ...(data as Omit<Skill, "skill_md_content">),
        skill_md_content: extra?.skill_md_content ?? null,
      });
      setSkillLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (skill) document.title = `${skill.name} — workbench · skiyu`;
    else document.title = "workbench · skiyu";
    return () => {
      document.title = "skiyu";
    };
  }, [skill]);

  useEffect(() => {
    const el = messageScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (skill && !chatBusy) inputRef.current?.focus();
  }, [skill, chatBusy]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // ── Send a message ─────────────────────────────────────────
  const handleSend = useCallback(
    async (text: string) => {
      if (!skill || !text.trim() || chatBusy) return;
      const userMsg: Message = {
        id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: "user",
        content: text.trim(),
      };
      const assistantId = `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const assistantMsg: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setChatBusy(true);
      setChatError(null);

      const payloadMessages = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: userMsg.content },
      ];

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const sbBase = (supabase as unknown as { supabaseUrl: string }).supabaseUrl;
        const anonKey = (supabase as unknown as { supabaseKey: string }).supabaseKey;
        // Use signed-in session token when available (bumps user to higher
        // quota). Fall back to anon for unauthenticated runs.
        const { data: sess } = await supabase.auth.getSession();
        const accessToken = sess.session?.access_token ?? anonKey;

        const res = await fetch(`${sbBase}/functions/v1/chat-with-skill`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            apikey: anonKey,
            authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            skill_slug: skill.slug,
            messages: payloadMessages,
            run_id: runId,
          }),
          signal: ctrl.signal,
        });

        if (!res.ok) {
          let errMsg = `Workbench error (${res.status})`;
          try {
            const j = await res.json();
            if (j?.error) errMsg = j.error;
          } catch {
            /* keep default */
          }
          throw new Error(errMsg);
        }
        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let sseBuf = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          sseBuf += decoder.decode(value, { stream: true });
          const events = sseBuf.split("\n\n");
          sseBuf = events.pop() ?? "";
          for (const ev of events) {
            const dataLine = ev.split("\n").find((l) => l.startsWith("data: "));
            if (!dataLine) continue;
            try {
              const payload = JSON.parse(dataLine.slice(6));
              if (payload.type === "run_started" && payload.run_id) {
                setRunId(payload.run_id as string);
              } else if (
                payload.type === "content_block_delta" &&
                payload.delta?.type === "text_delta"
              ) {
                const text = String(payload.delta.text ?? "");
                if (text) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId && m.role === "assistant"
                        ? { ...m, content: m.content + text }
                        : m,
                    ),
                  );
                }
              } else if (payload.type === "error") {
                throw new Error(payload.message || "Stream error");
              }
            } catch (parseErr) {
              if (parseErr instanceof Error && parseErr.message === "Stream error") {
                throw parseErr;
              }
              continue;
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && m.role === "assistant"
              ? { ...m, streaming: false }
              : m,
          ),
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Something went wrong. Try again.";
        if (!msg.toLowerCase().includes("abort")) {
          setChatError(msg);
        }
        setMessages((prev) =>
          prev
            .map((m) =>
              m.id === assistantId && m.role === "assistant"
                ? { ...m, streaming: false }
                : m,
            )
            .filter(
              (m) =>
                !(m.id === assistantId && m.role === "assistant" && m.content === ""),
            ),
        );
      } finally {
        setChatBusy(false);
        abortRef.current = null;
      }
    },
    [skill, chatBusy, messages, runId],
  );

  const onFormSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      void handleSend(input);
    },
    [handleSend, input],
  );

  const onTextareaKey = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend(input);
      }
    },
    [handleSend, input],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setChatBusy(false);
  }, []);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setRunId(null);
    setChatError(null);
    setInput("");
    setChatBusy(false);
    inputRef.current?.focus();
  }, []);

  // ── Render ─────────────────────────────────────────────────
  return (
    <div
      style={{
        background: "#000",
        color: "#fff",
        minHeight: "100vh",
        fontFamily: F,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Nav navigate={navigate} skill={skill} />

      <main
        id="main-content"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {!slug ? (
          <NoSkillState navigate={navigate} />
        ) : skillLoading ? (
          <CenteredText>Loading {slug}…</CenteredText>
        ) : skillError ? (
          <CenteredText error>
            {skillError}
            <div style={{ marginTop: 16 }}>
              <Link
                to="/explore"
                onMouseEnter={() => preloadRoute["/explore"]()}
                style={{
                  fontFamily: M,
                  fontSize: 12,
                  color: "#fff",
                  textDecoration: "none",
                  borderBottom: "1px solid rgba(255,255,255,0.2)",
                  paddingBottom: 2,
                }}
              >
                ← back to skills
              </Link>
            </div>
          </CenteredText>
        ) : skill ? (
          <Workbench
            skill={skill}
            messages={messages}
            input={input}
            chatBusy={chatBusy}
            chatError={chatError}
            messageScrollRef={messageScrollRef}
            inputRef={inputRef}
            onInputChange={setInput}
            onFormSubmit={onFormSubmit}
            onTextareaKey={onTextareaKey}
            onStop={handleStop}
            onReset={handleReset}
            onExampleClick={(t) => void handleSend(t)}
            user={user}
          />
        ) : null}
      </main>
    </div>
  );
}

// ── Sub-views ──────────────────────────────────────────────────────

function Nav({
  navigate,
  skill,
}: {
  navigate: ReturnType<typeof useNavigate>;
  skill: Skill | null;
}) {
  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        height: 56,
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Wordmark size={20} clickable />
        <span
          style={{
            fontSize: 12,
            color: "rgba(255, 255, 255, 0.40)",
            fontFamily: M,
          }}
        >
          {skill ? `workbench · ${skill.slug}` : "workbench"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
        {[
          { label: "Explore", path: "/explore" as const },
          { label: "Publish", path: "/publish" as const },
          { label: "Docs", path: "/docs" as const },
        ].map((l) => (
          <span
            key={l.label}
            role="link"
            tabIndex={0}
            onClick={() => navigate(l.path)}
            onMouseEnter={() => preloadRoute[l.path]?.()}
            onFocus={() => preloadRoute[l.path]?.()}
            style={{
              fontFamily: F,
              fontStyle: "italic",
              fontSize: 13,
              fontWeight: 400,
              color: "rgba(255, 255, 255, 0.40)",
              cursor: "pointer",
            }}
          >
            {l.label}
          </span>
        ))}
      </div>
      <NavAuth />
    </nav>
  );
}

function CenteredText({
  children,
  error,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 48,
        textAlign: "center",
        fontFamily: M,
        fontSize: 13,
        color: error ? "#fca5a5" : "rgba(255, 255, 255, 0.40)",
      }}
    >
      {children}
    </div>
  );
}

function NoSkillState({
  navigate,
}: {
  navigate: ReturnType<typeof useNavigate>;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 32px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: M,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "rgba(255, 255, 255, 0.25)",
        }}
      >
        THE WORKBENCH
      </div>
      <h1
        style={{
          fontFamily: F,
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: "clamp(36px, 5vw, 56px)",
          letterSpacing: "-0.04em",
          lineHeight: 1.05,
          margin: "16px 0 0",
          maxWidth: 700,
        }}
      >
        <span style={{ color: "#fff" }}>Pick a skill.</span>{" "}
        <span style={{ color: "rgba(255, 255, 255, 0.40)" }}>
          Run it here.
        </span>
      </h1>
      <p
        style={{
          marginTop: 20,
          fontFamily: F,
          fontStyle: "italic",
          fontSize: 16,
          lineHeight: 1.55,
          color: "rgba(255, 255, 255, 0.60)",
          maxWidth: 520,
        }}
      >
        The workbench loads any skill from the catalog and runs it
        interactively. Click "Run skill" on any card and you'll land back
        here with the skill loaded and ready.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
        <button
          type="button"
          onClick={() => navigate("/explore")}
          onMouseEnter={() => preloadRoute["/explore"]()}
          style={{
            padding: "12px 24px",
            background: "#fff",
            color: "#000",
            border: "1px solid rgba(255, 255, 255, 0.10)",
            borderRadius: 6,
            fontFamily: M,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.04em",
            cursor: "pointer",
          }}
        >
          Browse the catalog
        </button>
      </div>
    </div>
  );
}

function Workbench({
  skill,
  messages,
  input,
  chatBusy,
  chatError,
  messageScrollRef,
  inputRef,
  onInputChange,
  onFormSubmit,
  onTextareaKey,
  onStop,
  onReset,
  onExampleClick,
  user,
}: {
  skill: Skill;
  messages: Message[];
  input: string;
  chatBusy: boolean;
  chatError: string | null;
  messageScrollRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onInputChange: (v: string) => void;
  onFormSubmit: (e: FormEvent) => void;
  onTextareaKey: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onStop: () => void;
  onReset: () => void;
  onExampleClick: (text: string) => void;
  user: { id: string } | null;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "minmax(0, 360px) minmax(0, 1fr)",
        minHeight: 0,
      }}
    >
      <SkillPane skill={skill} />
      <ChatPane
        skill={skill}
        messages={messages}
        input={input}
        chatBusy={chatBusy}
        chatError={chatError}
        messageScrollRef={messageScrollRef}
        inputRef={inputRef}
        onInputChange={onInputChange}
        onFormSubmit={onFormSubmit}
        onTextareaKey={onTextareaKey}
        onStop={onStop}
        onReset={onReset}
        onExampleClick={onExampleClick}
        signedIn={!!user}
      />
    </div>
  );
}

function SkillPane({ skill }: { skill: Skill }) {
  return (
    <aside
      style={{
        borderRight: "1px solid rgba(255, 255, 255, 0.06)",
        padding: "24px 24px 32px",
        overflow: "auto",
        background: "rgba(255, 255, 255, 0.01)",
      }}
    >
      <div
        style={{
          fontFamily: M,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "rgba(255, 255, 255, 0.25)",
        }}
      >
        SKILL LOADED
      </div>
      <h1
        style={{
          marginTop: 12,
          fontFamily: F,
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: 28,
          letterSpacing: "-0.025em",
          lineHeight: 1.1,
        }}
      >
        {skill.name}
      </h1>
      <div
        style={{
          marginTop: 6,
          fontFamily: M,
          fontSize: 11,
          color: "rgba(255, 255, 255, 0.40)",
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        <span>@{skill.author_username ?? "anon"}</span>
        {skill.category_slug && (
          <>
            <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
            <span>{skill.category_slug}</span>
          </>
        )}
        <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
        <span>{skill.github_license || "no license"}</span>
      </div>

      {skill.description && (
        <p
          style={{
            marginTop: 18,
            fontFamily: F,
            fontStyle: "italic",
            fontSize: 14,
            lineHeight: 1.5,
            color: "rgba(255, 255, 255, 0.65)",
          }}
        >
          {skill.description}
        </p>
      )}

      {skill.audience && (
        <div style={{ marginTop: 20 }}>
          <Kicker>FOR</Kicker>
          <p
            style={{
              marginTop: 6,
              fontFamily: F,
              fontStyle: "italic",
              fontSize: 13,
              lineHeight: 1.5,
              color: "rgba(255, 255, 255, 0.55)",
            }}
          >
            {skill.audience}
          </p>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <Kicker>SKILL.md</Kicker>
        <pre
          style={{
            marginTop: 8,
            fontFamily: M,
            fontSize: 11,
            lineHeight: 1.55,
            color: "rgba(255, 255, 255, 0.55)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid rgba(255, 255, 255, 0.04)",
            borderRadius: 6,
            padding: "12px 14px",
            maxHeight: 360,
            overflow: "auto",
          }}
        >
          {skill.skill_md_content
            ? skill.skill_md_content.length > 4000
              ? skill.skill_md_content.slice(0, 4000) + "\n\n…"
              : skill.skill_md_content
            : "Loading skill content from source…\n\n(The first run for a skill takes a moment longer while we cache its SKILL.md.)"}
        </pre>
      </div>

      {skill.github_url && (
        <a
          href={skill.github_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            marginTop: 18,
            fontFamily: M,
            fontSize: 12,
            color: "rgba(255, 255, 255, 0.60)",
            textDecoration: "none",
            borderBottom: "1px solid rgba(255, 255, 255, 0.10)",
            paddingBottom: 2,
          }}
        >
          source ↗
        </a>
      )}
    </aside>
  );
}

function ChatPane({
  skill,
  messages,
  input,
  chatBusy,
  chatError,
  messageScrollRef,
  inputRef,
  onInputChange,
  onFormSubmit,
  onTextareaKey,
  onStop,
  onReset,
  onExampleClick,
  signedIn,
}: {
  skill: Skill;
  messages: Message[];
  input: string;
  chatBusy: boolean;
  chatError: string | null;
  messageScrollRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onInputChange: (v: string) => void;
  onFormSubmit: (e: FormEvent) => void;
  onTextareaKey: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onStop: () => void;
  onReset: () => void;
  onExampleClick: (text: string) => void;
  signedIn: boolean;
}) {
  const examplePrompts = buildExamplePrompts(skill);
  const isEmpty = messages.length === 0;
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div
        ref={messageScrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "32px 32px 24px",
        }}
      >
        {isEmpty ? (
          <div style={{ maxWidth: 640, margin: "0 auto", paddingTop: 24 }}>
            <Kicker>READY</Kicker>
            <h2
              style={{
                marginTop: 12,
                fontFamily: F,
                fontStyle: "italic",
                fontWeight: 700,
                fontSize: 32,
                letterSpacing: "-0.025em",
                lineHeight: 1.1,
              }}
            >
              Try {skill.name}.
            </h2>
            <p
              style={{
                marginTop: 16,
                fontFamily: F,
                fontStyle: "italic",
                fontSize: 15,
                lineHeight: 1.55,
                color: "rgba(255, 255, 255, 0.55)",
                maxWidth: 540,
              }}
            >
              Type your input below — the skill will be applied to it. Or
              start with one of the examples.
            </p>
            <div
              style={{
                marginTop: 24,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {examplePrompts.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onExampleClick(p)}
                  style={{
                    textAlign: "left",
                    padding: "12px 16px",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    borderRadius: 6,
                    color: "rgba(255, 255, 255, 0.75)",
                    fontFamily: F,
                    fontStyle: "italic",
                    fontSize: 14,
                    lineHeight: 1.5,
                    cursor: "pointer",
                    transition:
                      "background 150ms cubic-bezier(0.2,0.8,0.3,1), border-color 150ms cubic-bezier(0.2,0.8,0.3,1)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      "rgba(255,255,255,0.05)";
                    e.currentTarget.style.borderColor =
                      "rgba(255,255,255,0.10)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      "rgba(255,255,255,0.02)";
                    e.currentTarget.style.borderColor =
                      "rgba(255,255,255,0.06)";
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {chatError && (
              <div
                style={{
                  margin: "16px 0",
                  padding: "12px 14px",
                  background: "rgba(220, 38, 38, 0.06)",
                  border: "1px solid rgba(220, 38, 38, 0.20)",
                  borderRadius: 6,
                  fontFamily: M,
                  fontSize: 12,
                  color: "#fca5a5",
                }}
              >
                {chatError}
              </div>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          padding: "16px 32px 24px",
          borderTop: "1px solid rgba(255, 255, 255, 0.06)",
          background: "rgba(0, 0, 0, 0.4)",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <form
            onSubmit={onFormSubmit}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-end",
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={onTextareaKey}
              placeholder={
                chatBusy
                  ? "skiyu is responding…"
                  : `Ask ${skill.name} something — Enter to send, Shift+Enter for new line`
              }
              rows={1}
              disabled={chatBusy}
              style={{
                flex: 1,
                minHeight: 44,
                maxHeight: 200,
                padding: "12px 14px",
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.10)",
                borderRadius: 6,
                color: "#fff",
                fontFamily: F,
                fontStyle: "italic",
                fontSize: 15,
                lineHeight: 1.5,
                resize: "none",
                outline: "none",
              }}
            />
            {chatBusy ? (
              <button
                type="button"
                onClick={onStop}
                style={{
                  padding: "0 20px",
                  height: 44,
                  background: "rgba(255, 255, 255, 0.04)",
                  color: "#fff",
                  border: "1px solid rgba(255, 255, 255, 0.10)",
                  borderRadius: 6,
                  fontFamily: M,
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  cursor: "pointer",
                }}
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                style={{
                  padding: "0 24px",
                  height: 44,
                  background: input.trim() ? "#fff" : "rgba(255,255,255,0.10)",
                  color: input.trim() ? "#000" : "rgba(255,255,255,0.40)",
                  border: "1px solid rgba(255, 255, 255, 0.10)",
                  borderRadius: 6,
                  fontFamily: M,
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  cursor: input.trim() ? "pointer" : "not-allowed",
                  transition: "background 150ms cubic-bezier(0.2,0.8,0.3,1)",
                }}
              >
                Send
              </button>
            )}
          </form>
          <div
            style={{
              marginTop: 10,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontFamily: M,
              fontSize: 11,
              color: "rgba(255, 255, 255, 0.30)",
            }}
          >
            <span>
              {signedIn
                ? "30 messages/day"
                : "5 messages/day · sign in for more"}
            </span>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={onReset}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "rgba(255, 255, 255, 0.40)",
                  fontFamily: M,
                  fontSize: 11,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                clear
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        margin: "20px 0",
      }}
    >
      <div
        style={{
          maxWidth: "85%",
          padding: "12px 16px",
          background: isUser
            ? "rgba(255, 255, 255, 0.06)"
            : "rgba(255, 255, 255, 0.02)",
          border: isUser
            ? "1px solid rgba(255, 255, 255, 0.10)"
            : "1px solid rgba(255, 255, 255, 0.06)",
          borderRadius: 8,
          fontFamily: F,
          fontSize: 15,
          lineHeight: 1.55,
          color: "rgba(255, 255, 255, 0.90)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontStyle: isUser ? "normal" : "italic",
        }}
      >
        {!isUser && (
          <div
            style={{
              fontFamily: M,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(255, 255, 255, 0.30)",
              marginBottom: 6,
              fontStyle: "normal",
            }}
          >
            skiyu
          </div>
        )}
        {message.content}
        {!isUser && message.role === "assistant" && message.streaming && (
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 14,
              marginLeft: 4,
              background: "rgba(255, 255, 255, 0.65)",
              verticalAlign: "text-bottom",
              animation: "ski-cursor-blink 1.1s linear infinite",
            }}
          />
        )}
      </div>
    </div>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: M,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: "rgba(255, 255, 255, 0.25)",
      }}
    >
      {children}
    </span>
  );
}

// ── Helpers ─────────────────────────────────────────────────────

/** Build sensible example prompts from what we know about the skill.
 *  Falls back to generic prompts when no specific signal is available.
 *  These prime the empty-state with concrete, copy-pasteable starts so
 *  visitors don't bounce off a blank chat. */
function buildExamplePrompts(skill: Skill): string[] {
  const text = `${skill.name} ${skill.description ?? ""} ${skill.category_slug ?? ""}`.toLowerCase();
  const out: string[] = [];

  if (text.includes("pdf")) {
    out.push("Here's a PDF excerpt: '...invoice for $1,240.50 due 5/15...'. Extract the key fields.");
  }
  if (text.includes("sql") || text.includes("query")) {
    out.push("Explain this query: SELECT u.name, COUNT(o.id) FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.id");
  }
  if (text.includes("test") || text.includes("playwright") || text.includes("qa")) {
    out.push("Write a test that verifies a login flow works end-to-end.");
  }
  if (text.includes("doc") || text.includes("write") || text.includes("blog")) {
    out.push("Draft a 200-word announcement for a new TypeScript SDK release.");
  }
  if (text.includes("review") || text.includes("audit") || text.includes("security")) {
    out.push("Review this code: function login(u, p) { return u === 'admin' && p === '1234'; }");
  }
  if (text.includes("excel") || text.includes("spreadsheet") || text.includes("csv")) {
    out.push("Convert this CSV to a summary table: name,age\\nAlice,30\\nBob,25\\nCharlie,35");
  }
  if (text.includes("email") || text.includes("template")) {
    out.push("Draft a follow-up email after a sales demo with a SaaS startup.");
  }

  // Always include a generic "what can you do" prompt at the bottom.
  out.push(`What kinds of inputs work best for ${skill.name}?`);

  // Cap at 3 to keep the empty state uncluttered.
  return out.slice(0, 3);
}
