import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { preloadRoute } from "../routes";
import { supabase } from "@/lib/supabase";
import NavAuth from "./nav-auth";
import Wordmark from "./wordmark";

const F = "'Erode', 'Cormorant Garamond', Georgia, serif";
const M = "'Fragment Mono', 'JetBrains Mono', Menlo, monospace";

// ── Types ──────────────────────────────────────────────────────────

interface Skill {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  audience: string | null;
  does_not_do: string | null;
  github_url: string | null;
  github_license: string | null;
  category_slug: string | null;
  author_username: string | null;
  skill_md_content: string | null;
}

// Infer the input type from the skill's text
function inferInputType(skill: Skill): "url" | "text" | "file" {
  const text =
    `${skill.name} ${skill.description ?? ""} ${skill.skill_md_content ?? ""}`.toLowerCase();
  if (
    text.includes("clone") ||
    text.includes("scrape") ||
    text.includes("website") ||
    text.includes("url") ||
    text.includes("fetch url")
  )
    return "url";
  if (
    text.includes("pdf") ||
    text.includes("csv") ||
    text.includes("file") ||
    text.includes("upload") ||
    text.includes("spreadsheet") ||
    text.includes("docx")
  )
    return "file";
  return "text";
}

// ── Trace event types ──────────────────────────────────────────────

type TraceEvent =
  | { type: "status"; message: string }
  | { type: "skill_loaded"; name: string; description: string | null; has_skill_md: boolean }
  | { type: "sandbox_ready"; message: string }
  | { type: "agent_text"; text: string }
  | { type: "tool_call"; id: string; tool: string; input: Record<string, unknown> }
  | { type: "tool_result"; id: string; tool: string; output: string; duration_ms: number; error: boolean }
  | { type: "artifact_ready"; artifact_type: string; content?: string; filename: string; size_bytes: number }
  | { type: "complete"; summary: string; had_artifact: boolean }
  | { type: "sandbox_killed" }
  | { type: "error"; message: string };

/**
 * /run — Sandbox runtime page.
 *
 * This is where skills actually execute. The agentic loop runs in E2B
 * (real Linux sandbox), and the output is streamed back here live.
 *
 * Distinct from /author (the skill authoring assistant, where you draft
 * and publish skills). /run is for users — /author is for authors.
 */
export default function Run() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const slug = (searchParams.get("skill") ?? "").trim() || null;

  const [skill, setSkill] = useState<Skill | null>(null);
  const [skillLoading, setSkillLoading] = useState(false);
  const [skillError, setSkillError] = useState<string | null>(null);

  const [inputValue, setInputValue] = useState("");
  const [running, setRunning] = useState(false);
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [artifact, setArtifact] = useState<{
    type: string;
    content?: string;
    filename: string;
    size_bytes: number;
  } | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"input" | "running" | "done">("input");

  const traceScrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Load skill ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    if (!slug) { setSkill(null); return; }
    setSkillLoading(true);
    setSkillError(null);

    (async () => {
      const { data, error } = await supabase
        .from("v_skill_catalog")
        .select("id, slug, name, description, audience, does_not_do, github_url, github_license, category_slug, author_username, updated_at")
        .eq("slug", slug)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        setSkillError("Skill not found.");
        setSkillLoading(false);
        return;
      }

      const { data: extra } = await supabase
        .from("skills")
        .select("skill_md_content")
        .eq("id", data.id)
        .maybeSingle();

      if (cancelled) return;
      setSkill({ ...(data as Omit<Skill, "skill_md_content">), skill_md_content: extra?.skill_md_content ?? null });
      setSkillLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    if (skill) document.title = `${skill.name} — run / skiyu`;
    else document.title = "run / skiyu";
    return () => { document.title = "skiyu"; };
  }, [skill]);

  // Auto-scroll trace
  useEffect(() => {
    const el = traceScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [trace]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // ── Run the skill ─────────────────────────────────────────────
  const handleRun = useCallback(async () => {
    if (!skill || !inputValue.trim() || running) return;
    setRunning(true);
    setPhase("running");
    setTrace([]);
    setArtifact(null);
    setRunError(null);

    const inputType = inferInputType(skill);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const sbBase = (supabase as unknown as { supabaseUrl: string }).supabaseUrl;
      const anonKey = (supabase as unknown as { supabaseKey: string }).supabaseKey;
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? anonKey;

      const res = await fetch(`${sbBase}/functions/v1/run-skill-agent`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: anonKey,
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          skill_slug: skill.slug,
          input_type: inputType,
          input_value: inputValue.trim(),
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        let msg = `Error ${res.status}`;
        try { const j = await res.json(); if (j.error) msg = j.error; } catch { /**/ }
        throw new Error(msg);
      }

      if (!res.body) throw new Error("No response body");
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
            setTrace(prev => [...prev, payload]);

            if (payload.type === "artifact_ready") {
              setArtifact({
                type: payload.artifact_type,
                content: payload.content,
                filename: payload.filename,
                size_bytes: payload.size_bytes,
              });
            }
            if (payload.type === "complete" || payload.type === "error") {
              setPhase("done");
            }
          } catch { /**/ }
        }
      }
      setPhase("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      if (!msg.toLowerCase().includes("abort")) {
        setRunError(msg);
        setTrace(prev => [...prev, { type: "error", message: msg }]);
      }
      setPhase("done");
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [skill, inputValue, running]);

  const handleStop = () => {
    abortRef.current?.abort();
    setRunning(false);
    setPhase("done");
  };

  const handleReset = () => {
    abortRef.current?.abort();
    setRunning(false);
    setPhase("input");
    setTrace([]);
    setArtifact(null);
    setRunError(null);
    setInputValue("");
  };

  const inputType = skill ? inferInputType(skill) : "text";

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div style={{ background: "#000", color: "#fff", minHeight: "100vh", fontFamily: F, display: "flex", flexDirection: "column" }}>
      {/* NAV */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100, height: 56,
        padding: "0 24px", display: "flex", alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Wordmark size={20} clickable />
          <span style={{ fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.40)" }}>
            {skill ? `run · ${skill.slug}` : "run"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          {([{ label: "Explore", path: "/explore" }, { label: "Author", path: "/author" }, { label: "Docs", path: "/docs" }] as { label: string; path: keyof typeof preloadRoute }[]).map(l => (
            <span key={l.label} role="link" tabIndex={0}
              onClick={() => navigate(l.path)}
              onMouseEnter={() => preloadRoute[l.path]?.()}
              style={{ fontFamily: F, fontStyle: "italic", fontSize: 13, color: "rgba(255,255,255,0.40)", cursor: "pointer" }}>
              {l.label}
            </span>
          ))}
        </div>
        <NavAuth />
      </nav>

      {/* BODY */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {!slug ? (
          <NoSkillState navigate={navigate} />
        ) : skillLoading ? (
          <Centered>Loading {slug}…</Centered>
        ) : skillError ? (
          <Centered error>
            {skillError}
            <div style={{ marginTop: 12 }}>
              <Link to="/explore" style={{ fontFamily: M, fontSize: 12, color: "#fff", textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.2)" }}>
                ← browse skills
              </Link>
            </div>
          </Centered>
        ) : skill ? (
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "minmax(0,340px) minmax(0,1fr)", minHeight: 0 }}>
            {/* LEFT: skill info */}
            <SkillPane skill={skill} inputType={inputType} inputValue={inputValue} onInputChange={setInputValue}
              onRun={handleRun} running={running} phase={phase} onReset={handleReset} onStop={handleStop}
              onFormSubmit={(e: FormEvent) => { e.preventDefault(); void handleRun(); }}
              onTextareaKey={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleRun(); }
              }} />
            {/* RIGHT: trace + artifact */}
            <RuntimePane trace={trace} artifact={artifact} phase={phase} running={running} runError={runError} traceScrollRef={traceScrollRef} />
          </div>
        ) : null}
      </main>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function Centered({ children, error }: { children: React.ReactNode; error?: boolean }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 48, textAlign: "center", fontFamily: M, fontSize: 13, color: error ? "#fca5a5" : "rgba(255,255,255,0.40)" }}>
      {children}
    </div>
  );
}

function NoSkillState({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 32px", textAlign: "center" }}>
      <div style={{ fontFamily: M, fontSize: 11, fontWeight: 600, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>SKILL RUNTIME</div>
      <h1 style={{ fontFamily: F, fontStyle: "italic", fontWeight: 700, fontSize: "clamp(36px,5vw,56px)", letterSpacing: "-0.04em", lineHeight: 1.05, margin: "16px 0 0", maxWidth: 700 }}>
        <span style={{ color: "#fff" }}>Pick a skill.</span>{" "}
        <span style={{ color: "rgba(255,255,255,0.40)" }}>Run it for real.</span>
      </h1>
      <p style={{ marginTop: 20, fontFamily: F, fontStyle: "italic", fontSize: 16, lineHeight: 1.55, color: "rgba(255,255,255,0.60)", maxWidth: 520 }}>
        The skill runtime executes any skill from the catalog in a real isolated sandbox. Click "Run skill" on any card.
      </p>
      <button type="button" onClick={() => navigate("/explore")} onMouseEnter={() => preloadRoute["/explore"]()}
        style={{ marginTop: 28, padding: "12px 24px", background: "#fff", color: "#000", border: "none", borderRadius: 6, fontFamily: M, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", cursor: "pointer" }}>
        Browse the catalog
      </button>
    </div>
  );
}

function SkillPane({
  skill, inputType, inputValue, onInputChange, onRun, running, phase, onReset, onStop, onFormSubmit, onTextareaKey,
}: {
  skill: Skill;
  inputType: "url" | "text" | "file";
  inputValue: string;
  onInputChange: (v: string) => void;
  onRun: () => void;
  running: boolean;
  phase: "input" | "running" | "done";
  onReset: () => void;
  onStop: () => void;
  onFormSubmit: (e: FormEvent) => void;
  onTextareaKey: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <aside style={{ borderRight: "1px solid rgba(255,255,255,0.06)", padding: "24px 24px 32px", overflow: "auto", background: "rgba(255,255,255,0.01)", display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={{ fontFamily: M, fontSize: 11, fontWeight: 600, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>SKILL</div>
      <h1 style={{ marginTop: 10, fontFamily: F, fontStyle: "italic", fontWeight: 700, fontSize: 26, letterSpacing: "-0.025em", lineHeight: 1.1 }}>{skill.name}</h1>
      <div style={{ marginTop: 6, fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.40)", display: "flex", flexWrap: "wrap", gap: 6 }}>
        <span>@{skill.author_username ?? "skiyu"}</span>
        {skill.category_slug && <><span style={{ color: "rgba(255,255,255,0.20)" }}>·</span><span>{skill.category_slug}</span></>}
        <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
        <span>{skill.github_license || "MIT"}</span>
      </div>
      {skill.description && (
        <p style={{ marginTop: 16, fontFamily: F, fontStyle: "italic", fontSize: 13.5, lineHeight: 1.5, color: "rgba(255,255,255,0.65)" }}>{skill.description}</p>
      )}

      {/* INPUT SURFACE */}
      <form onSubmit={onFormSubmit} style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontFamily: M, fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.30)" }}>
          {inputType === "url" ? "WEBSITE URL" : inputType === "file" ? "ATTACH FILE" : "INPUT"}
        </div>

        {inputType === "url" && (
          <input
            type="url"
            value={inputValue}
            onChange={e => onInputChange(e.target.value)}
            placeholder="https://stripe.com/pricing"
            disabled={running}
            style={{ padding: "11px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, color: "#fff", fontFamily: M, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" }}
          />
        )}

        {inputType === "text" && (
          <textarea
            value={inputValue}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={onTextareaKey}
            placeholder={`Describe what you want ${skill.name} to do…`}
            rows={4}
            disabled={running}
            style={{ padding: "11px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, color: "#fff", fontFamily: F, fontStyle: "italic", fontSize: 14, lineHeight: 1.5, outline: "none", resize: "vertical", width: "100%", boxSizing: "border-box" }}
          />
        )}

        {inputType === "file" && (
          <div style={{ padding: "20px 16px", background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 6, textAlign: "center", fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.40)" }}>
            File upload coming soon — use text input for now
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          {phase === "running" ? (
            <button type="button" onClick={onStop}
              style={{ flex: 1, padding: "12px", background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, fontFamily: M, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", cursor: "pointer" }}>
              Stop
            </button>
          ) : phase === "done" ? (
            <button type="button" onClick={onReset}
              style={{ flex: 1, padding: "12px", background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, fontFamily: M, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", cursor: "pointer" }}>
              Run again
            </button>
          ) : (
            <button type="submit" disabled={!inputValue.trim()}
              style={{ flex: 1, padding: "12px", background: inputValue.trim() ? "#fff" : "rgba(255,255,255,0.10)", color: inputValue.trim() ? "#000" : "rgba(255,255,255,0.40)", border: "none", borderRadius: 6, fontFamily: M, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", cursor: inputValue.trim() ? "pointer" : "not-allowed", transition: "background 150ms" }}>
              Run skill →
            </button>
          )}
        </div>
      </form>

      {/* SKILL.md preview */}
      {skill.skill_md_content && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontFamily: M, fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 8 }}>SKILL.md</div>
          <pre style={{ fontFamily: M, fontSize: 10.5, lineHeight: 1.55, color: "rgba(255,255,255,0.45)", whiteSpace: "pre-wrap", wordBreak: "break-word", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 6, padding: "12px 14px", maxHeight: 220, overflow: "auto" }}>
            {skill.skill_md_content.slice(0, 1500)}{skill.skill_md_content.length > 1500 ? "\n\n…" : ""}
          </pre>
        </div>
      )}

      {skill.github_url && (
        <a href={skill.github_url} target="_blank" rel="noopener noreferrer"
          style={{ display: "inline-block", marginTop: 14, fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.50)", textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.10)", paddingBottom: 2 }}>
          source ↗
        </a>
      )}
    </aside>
  );
}

function RuntimePane({
  trace, artifact, phase, running, runError, traceScrollRef,
}: {
  trace: TraceEvent[];
  artifact: { type: string; content?: string; filename: string; size_bytes: number } | null;
  phase: "input" | "running" | "done";
  running: boolean;
  runError: string | null;
  traceScrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Empty input state */}
      {phase === "input" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 40px", textAlign: "center" }}>
          <div style={{ fontFamily: M, fontSize: 11, fontWeight: 600, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.20)" }}>EXECUTION TRACE</div>
          <p style={{ marginTop: 14, fontFamily: F, fontStyle: "italic", fontSize: 16, color: "rgba(255,255,255,0.35)", maxWidth: 440, lineHeight: 1.55 }}>
            Provide a URL on the left and hit "Run skill" — you'll see the sandbox execute each step in real time here.
          </p>
        </div>
      )}

      {/* Running / done: trace */}
      {(phase === "running" || phase === "done") && (
        <>
          <div ref={traceScrollRef} style={{ flex: artifact ? "0 0 auto" : 1, maxHeight: artifact ? 260 : undefined, overflowY: "auto", padding: "24px 32px" }}>
            <TraceLog trace={trace} running={running} />
          </div>

          {/* Artifact */}
          {artifact && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", borderTop: "1px solid rgba(255,255,255,0.06)", minHeight: 0 }}>
              <div style={{ padding: "10px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontFamily: M, fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>
                  OUTPUT · {artifact.filename} · {(artifact.size_bytes / 1024).toFixed(0)} KB
                </div>
                {artifact.type === "html" && artifact.content && (
                  <button
                    type="button"
                    onClick={() => {
                      const blob = new Blob([artifact.content!], { type: "text/html" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = artifact.filename;
                      a.click();
                    }}
                    style={{ fontFamily: M, fontSize: 11, fontWeight: 600, color: "#fff", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 5, padding: "5px 12px", cursor: "pointer" }}>
                    ↓ Download
                  </button>
                )}
              </div>
              <ArtifactRenderer artifact={artifact} />
            </div>
          )}
        </>
      )}
    </section>
  );
}

function TraceLog({ trace, running }: { trace: TraceEvent[]; running: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 760, margin: "0 auto", width: "100%" }}>
      {trace.map((ev, i) => <TraceItem key={i} event={ev} />)}
      {running && trace.length === 0 && (
        <div style={{ fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.30)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ animation: "ski-cursor-blink 1s linear infinite", display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#fff", opacity: 0.7 }} />
          Connecting to sandbox…
        </div>
      )}
    </div>
  );
}

function TraceItem({ event: ev }: { event: TraceEvent }) {
  const [expanded, setExpanded] = useState(false);

  if (ev.type === "status") {
    return (
      <div style={{ fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.04em" }}>
        → {ev.message}
      </div>
    );
  }

  if (ev.type === "sandbox_ready") {
    return (
      <div style={{ fontFamily: M, fontSize: 11, color: "#4ade80", letterSpacing: "0.04em" }}>
        ✓ Sandbox ready
      </div>
    );
  }

  if (ev.type === "skill_loaded") {
    return (
      <div style={{ fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.50)", letterSpacing: "0.04em" }}>
        ✓ Loaded: {ev.name} {ev.has_skill_md ? "" : "(using description only)"}
      </div>
    );
  }

  if (ev.type === "agent_text") {
    return (
      <div style={{ fontFamily: F, fontStyle: "italic", fontSize: 14, lineHeight: 1.55, color: "rgba(255,255,255,0.80)", padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, whiteSpace: "pre-wrap" }}>
        {ev.text}
      </div>
    );
  }

  if (ev.type === "tool_call") {
    const label = ev.tool === "bash"
      ? truncate((ev.input as { command: string }).command, 80)
      : ev.tool === "write_file"
      ? `write ${(ev.input as { path: string }).path}`
      : ev.tool === "read_file"
      ? `read ${(ev.input as { path: string }).path}`
      : ev.tool;

    return (
      <button type="button" onClick={() => setExpanded(p => !p)}
        style={{ textAlign: "left", padding: "8px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, cursor: "pointer", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: M, fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.40)", flexShrink: 0 }}>{ev.tool}</span>
          <span style={{ fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.70)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
          <span style={{ marginLeft: "auto", fontFamily: M, fontSize: 10, color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>{expanded ? "▲" : "▼"}</span>
        </div>
        {expanded && ev.tool === "bash" && (
          <pre style={{ marginTop: 8, fontFamily: M, fontSize: 11, lineHeight: 1.5, color: "rgba(255,255,255,0.65)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {(ev.input as { command: string }).command}
          </pre>
        )}
        {expanded && ev.tool === "write_file" && (
          <pre style={{ marginTop: 8, fontFamily: M, fontSize: 11, lineHeight: 1.5, color: "rgba(255,255,255,0.65)", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 200, overflow: "auto" }}>
            {truncate((ev.input as { content: string }).content, 1000)}
          </pre>
        )}
      </button>
    );
  }

  if (ev.type === "tool_result") {
    const color = ev.error ? "#fca5a5" : "#4ade80";
    return (
      <div style={{ padding: "6px 12px 8px", background: ev.error ? "rgba(220,38,38,0.05)" : "rgba(74,222,128,0.04)", border: `1px solid ${ev.error ? "rgba(220,38,38,0.15)" : "rgba(74,222,128,0.12)"}`, borderRadius: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: ev.output ? 4 : 0 }}>
          <span style={{ fontFamily: M, fontSize: 10, color, fontWeight: 600 }}>{ev.error ? "✗" : "✓"} {ev.tool}</span>
          <span style={{ fontFamily: M, fontSize: 10, color: "rgba(255,255,255,0.25)" }}>{ev.duration_ms}ms</span>
        </div>
        {ev.output && ev.output !== "(no output)" && (
          <pre style={{ fontFamily: M, fontSize: 11, lineHeight: 1.5, color: "rgba(255,255,255,0.65)", whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
            {truncate(ev.output, 600)}
          </pre>
        )}
      </div>
    );
  }

  if (ev.type === "artifact_ready") {
    return (
      <div style={{ padding: "8px 12px", background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.20)", borderRadius: 6, fontFamily: M, fontSize: 11, color: "#4ade80", fontWeight: 600 }}>
        ✓ Output ready — {ev.filename} ({(ev.size_bytes / 1024).toFixed(0)} KB)
      </div>
    );
  }

  if (ev.type === "complete") {
    return (
      <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.50)" }}>
        ✓ Run complete
      </div>
    );
  }

  if (ev.type === "error") {
    return (
      <div style={{ padding: "10px 14px", background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.20)", borderRadius: 6, fontFamily: M, fontSize: 12, color: "#fca5a5" }}>
        ✗ {ev.message}
      </div>
    );
  }

  return null;
}

function ArtifactRenderer({ artifact }: {
  artifact: { type: string; content?: string; filename: string; size_bytes: number };
}) {
  if (artifact.type === "html" && artifact.content) {
    return (
      <iframe
        srcDoc={artifact.content}
        sandbox="allow-same-origin allow-scripts"
        style={{ flex: 1, border: "none", background: "#fff", width: "100%", minHeight: 400 }}
        title="Skill output"
      />
    );
  }

  if (artifact.type === "image" && artifact.content) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <img src={`data:image/png;base64,${artifact.content}`} alt="Output" style={{ maxWidth: "100%", maxHeight: 500, borderRadius: 6 }} />
      </div>
    );
  }

  if (artifact.type === "json" && artifact.content) {
    try {
      const parsed = JSON.stringify(JSON.parse(artifact.content), null, 2);
      return (
        <pre style={{ flex: 1, padding: 24, fontFamily: M, fontSize: 12, lineHeight: 1.6, color: "rgba(255,255,255,0.80)", overflowY: "auto", margin: 0, whiteSpace: "pre-wrap" }}>
          {parsed}
        </pre>
      );
    } catch { /**/ }
  }

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, textAlign: "center", fontFamily: M, fontSize: 13, color: "rgba(255,255,255,0.40)" }}>
      Output: {artifact.filename} ({(artifact.size_bytes / 1024).toFixed(0)} KB)
    </div>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}
