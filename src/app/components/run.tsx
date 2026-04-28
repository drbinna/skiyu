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

function inferInputType(skill: Skill): "url" | "text" | "file" {
  const t = `${skill.name} ${skill.description ?? ""}`.toLowerCase();
  // Only infer URL mode for skills explicitly about fetching/cloning websites.
  // Using the skill_md_content here too would be too aggressive — "url" appears
  // in many security/config skill descriptions that aren't web-fetching skills.
  if (t.includes("clone") || t.includes("scrape") || (t.includes("website") && !t.includes("audit"))) return "url";
  if (t.includes("pdf") || t.includes("csv") || t.includes("upload") || t.includes("spreadsheet")) return "file";
  return "text";
}

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
    type: string; content?: string; filename: string; size_bytes: number;
  } | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"input" | "running" | "done">("input");

  const traceRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load skill
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
      if (error || !data) { setSkillError("Skill not found."); setSkillLoading(false); return; }
      const { data: extra } = await supabase.from("skills").select("skill_md_content").eq("id", data.id).maybeSingle();
      if (cancelled) return;
      setSkill({ ...(data as Omit<Skill, "skill_md_content">), skill_md_content: extra?.skill_md_content ?? null });
      setSkillLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    document.title = skill ? `${skill.name} — run / skiyu` : "run / skiyu";
    return () => { document.title = "skiyu"; };
  }, [skill]);

  // Auto-scroll trace
  useEffect(() => {
    const el = traceRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [trace]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const handleRun = useCallback(async () => {
    if (!skill || !inputValue.trim() || running) return;
    setRunning(true);
    setPhase("running");
    setTrace([]);
    setArtifact(null);
    setRunError(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const sbBase = (supabase as unknown as { supabaseUrl: string }).supabaseUrl;
      const anonKey = (supabase as unknown as { supabaseKey: string }).supabaseKey;
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? anonKey;

      const res = await fetch(`${sbBase}/functions/v1/run-skill-agent`, {
        method: "POST",
        headers: { "content-type": "application/json", apikey: anonKey, authorization: `Bearer ${token}` },
        body: JSON.stringify({ skill_slug: skill.slug, input_type: inferInputType(skill), input_value: inputValue.trim() }),
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
              setArtifact({ type: payload.artifact_type, content: payload.content, filename: payload.filename, size_bytes: payload.size_bytes });
            }
            if (payload.type === "complete" || payload.type === "error") setPhase("done");
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

  const handleStop = () => { abortRef.current?.abort(); setRunning(false); setPhase("done"); };
  const handleReset = () => {
    abortRef.current?.abort(); setRunning(false); setPhase("input");
    setTrace([]); setArtifact(null); setRunError(null); setInputValue("");
  };

  const inputType = skill ? inferInputType(skill) : "url";

  return (
    <div style={{ background: "#000", color: "#fff", height: "100vh", fontFamily: F, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* NAV */}
      <nav style={{ flexShrink: 0, height: 52, padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.90)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Wordmark size={18} clickable />
          <span style={{ fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
            {skill ? `run · ${skill.slug}` : "run"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
          {(["Explore", "Author", "Docs"] as const).map(l => {
            const path = `/${l.toLowerCase()}` as keyof typeof preloadRoute;
            return (
              <span key={l} role="link" tabIndex={0} onClick={() => navigate(path)} onMouseEnter={() => preloadRoute[path]?.()}
                style={{ fontFamily: F, fontStyle: "italic", fontSize: 13, color: "rgba(255,255,255,0.40)", cursor: "pointer" }}>{l}</span>
            );
          })}
        </div>
        <NavAuth />
      </nav>

      {/* BODY */}
      <main style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
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
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "380px 1fr", minHeight: 0, overflow: "hidden" }}>
            {/* ── LEFT: skill info + input + trace ── */}
            <aside style={{ borderRight: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.01)", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
              {/* Skill header + input — fixed height */}
              <div style={{ flexShrink: 0, padding: "20px 18px 14px" }}>
                <div style={{ fontFamily: M, fontSize: 10, fontWeight: 600, letterSpacing: "0.20em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>SKILL</div>
                <h1 style={{ margin: "8px 0 0", fontFamily: F, fontStyle: "italic", fontWeight: 700, fontSize: 21, letterSpacing: "-0.025em", lineHeight: 1.1 }}>{skill.name}</h1>
                <div style={{ marginTop: 5, fontFamily: M, fontSize: 10, color: "rgba(255,255,255,0.40)", display: "flex", flexWrap: "wrap", gap: 5 }}>
                  <span>@{skill.author_username ?? "skiyu"}</span>
                  {skill.category_slug && <><span style={{ color: "rgba(255,255,255,0.20)" }}>·</span><span>{skill.category_slug}</span></>}
                  <span style={{ color: "rgba(255,255,255,0.20)" }}>·</span>
                  <span>{skill.github_license || "MIT"}</span>
                </div>
                {skill.description && (
                  <p style={{ margin: "10px 0 0", fontFamily: F, fontStyle: "italic", fontSize: 12.5, lineHeight: 1.5, color: "rgba(255,255,255,0.60)" }}>{skill.description}</p>
                )}

                {/* Input + Run */}
                <form onSubmit={(e: FormEvent) => { e.preventDefault(); void handleRun(); }} style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontFamily: M, fontSize: 9, fontWeight: 600, letterSpacing: "0.20em", textTransform: "uppercase", color: "rgba(255,255,255,0.30)" }}>
                    {inputType === "url" ? "WEBSITE URL" : "INPUT"}
                  </div>
                  {inputType === "url" ? (
                    <input type="url" value={inputValue} onChange={e => setInputValue(e.target.value)}
                      placeholder="https://example.com" disabled={running}
                      style={{ padding: "9px 11px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, color: "#fff", fontFamily: M, fontSize: 12, outline: "none", width: "100%", boxSizing: "border-box" }} />
                  ) : (
                    <textarea value={inputValue} onChange={e => setInputValue(e.target.value)}
                      onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleRun(); } }}
                      placeholder="Describe what you want..." rows={3} disabled={running}
                      style={{ padding: "9px 11px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, color: "#fff", fontFamily: F, fontStyle: "italic", fontSize: 13, lineHeight: 1.5, outline: "none", resize: "vertical", width: "100%", boxSizing: "border-box" }} />
                  )}
                  {phase === "running" ? (
                    <button type="button" onClick={handleStop}
                      style={{ padding: "10px", background: "rgba(220,38,38,0.12)", color: "#fca5a5", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 6, fontFamily: M, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                      Stop
                    </button>
                  ) : phase === "done" ? (
                    <button type="button" onClick={handleReset}
                      style={{ padding: "10px", background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, fontFamily: M, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                      Run again
                    </button>
                  ) : (
                    <button type="submit" disabled={!inputValue.trim()}
                      style={{ padding: "10px", background: inputValue.trim() ? "#fff" : "rgba(255,255,255,0.10)", color: inputValue.trim() ? "#000" : "rgba(255,255,255,0.40)", border: "none", borderRadius: 6, fontFamily: M, fontSize: 11, fontWeight: 600, cursor: inputValue.trim() ? "pointer" : "not-allowed", transition: "background 150ms" }}>
                      Run skill →
                    </button>
                  )}
                </form>
              </div>

              {/* Trace — scrollable, fills remaining space */}
              <div ref={traceRef} style={{ flex: 1, overflowY: "auto", padding: "0 18px 18px", minHeight: 0, borderTop: phase !== "input" ? "1px solid rgba(255,255,255,0.05)" : undefined, paddingTop: phase !== "input" ? 12 : 0 }}>
                {phase === "input" ? (
                  // Show SKILL.md preview when idle
                  skill.skill_md_content ? (
                    <div style={{ marginTop: 4 }}>
                      <div style={{ fontFamily: M, fontSize: 9, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)", marginBottom: 6 }}>SKILL.md</div>
                      <pre style={{ fontFamily: M, fontSize: 10, lineHeight: 1.5, color: "rgba(255,255,255,0.38)", whiteSpace: "pre-wrap", wordBreak: "break-word", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 6, padding: "10px 12px", maxHeight: 200, overflow: "auto", margin: 0 }}>
                        {skill.skill_md_content.slice(0, 800)}{skill.skill_md_content.length > 800 ? "\n\n…" : ""}
                      </pre>
                      {skill.github_url && (
                        <a href={skill.github_url} target="_blank" rel="noopener noreferrer"
                          style={{ display: "inline-block", marginTop: 8, fontFamily: M, fontSize: 10, color: "rgba(255,255,255,0.40)", textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.10)", paddingBottom: 1 }}>
                          source ↗
                        </a>
                      )}
                    </div>
                  ) : null
                ) : (
                  // Live trace
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {trace.map((ev, i) => <TraceItem key={i} event={ev} />)}
                    {running && trace.length === 0 && (
                      <div style={{ fontFamily: M, fontSize: 11, color: "rgba(255,255,255,0.30)" }}>Connecting to sandbox…</div>
                    )}
                  </div>
                )}
              </div>
            </aside>

            {/* ── RIGHT: artifact output — fills full height ── */}
            <div style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
              {!artifact ? (
                // Empty/running state
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 40px", textAlign: "center", background: "rgba(255,255,255,0.005)" }}>
                  <div style={{ fontFamily: M, fontSize: 10, fontWeight: 600, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.15)", marginBottom: 14 }}>OUTPUT</div>
                  {phase === "input" ? (
                    <p style={{ fontFamily: F, fontStyle: "italic", fontSize: 17, color: "rgba(255,255,255,0.28)", maxWidth: 420, lineHeight: 1.6 }}>
                      {skill.description
                        ? `Provide input on the left and click "Run skill" — the output will appear here.`
                        : `Run skill →`}
                    </p>
                  ) : running ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                      <div style={{
                        width: 36, height: 36,
                        border: "2px solid rgba(255,255,255,0.08)",
                        borderTopColor: "rgba(255,255,255,0.55)",
                        borderRadius: "50%",
                        animation: "spin 0.9s linear infinite",
                      }} />
                      <p style={{ fontFamily: M, fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Running in sandbox…</p>
                      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                  ) : (
                    <p style={{ fontFamily: F, fontStyle: "italic", fontSize: 16, color: "rgba(255,255,255,0.35)", maxWidth: 380, lineHeight: 1.55 }}>
                      Run complete — no output file was produced. Check the trace for details.
                    </p>
                  )}
                </div>
              ) : (
                // Artifact — fills full right panel
                <>
                  <div style={{ flexShrink: 0, padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.4)" }}>
                    <div style={{ fontFamily: M, fontSize: 10, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.40)" }}>
                      OUTPUT · {artifact.filename.toUpperCase()} · {(artifact.size_bytes / 1024).toFixed(0)} KB
                    </div>
                    {artifact.type === "html" && artifact.content && (
                      <button type="button"
                        onClick={() => {
                          const blob = new Blob([artifact.content!], { type: "text/html" });
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(blob);
                          a.download = artifact.filename;
                          a.click();
                        }}
                        style={{ fontFamily: M, fontSize: 10, fontWeight: 600, color: "#fff", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 5, padding: "5px 12px", cursor: "pointer" }}>
                        ↓ Download
                      </button>
                    )}
                  </div>
                  <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
                    {artifact.type === "html" && artifact.content ? (
                      <iframe
                        srcDoc={artifact.content}
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                        style={{ width: "100%", height: "100%", border: "none", background: "#fff", display: "block" }}
                        title="Skill output"
                      />
                    ) : artifact.type === "image" && artifact.content ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 32, height: "100%", boxSizing: "border-box" }}>
                        <img src={`data:image/png;base64,${artifact.content}`} alt="Output" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 6 }} />
                      </div>
                    ) : (
                      <pre style={{ padding: 24, fontFamily: M, fontSize: 12, lineHeight: 1.6, color: "rgba(255,255,255,0.80)", overflowY: "auto", margin: 0, height: "100%", boxSizing: "border-box" }}>
                        {artifact.content?.slice(0, 10000)}
                      </pre>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

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

function TraceItem({ event: ev }: { event: TraceEvent }) {
  const [expanded, setExpanded] = useState(false);

  if (ev.type === "status") {
    return <div style={{ fontFamily: M, fontSize: 10, color: "rgba(255,255,255,0.32)", letterSpacing: "0.04em" }}>→ {ev.message}</div>;
  }
  if (ev.type === "sandbox_ready") {
    return <div style={{ fontFamily: M, fontSize: 10, color: "#4ade80", letterSpacing: "0.04em" }}>✓ Sandbox ready</div>;
  }
  if (ev.type === "skill_loaded") {
    return <div style={{ fontFamily: M, fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: "0.04em" }}>✓ Loaded: {ev.name}</div>;
  }
  if (ev.type === "agent_text") {
    return (
      <div style={{ fontFamily: F, fontStyle: "italic", fontSize: 12.5, lineHeight: 1.5, color: "rgba(255,255,255,0.75)", padding: "8px 10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 5, whiteSpace: "pre-wrap" }}>
        {ev.text.slice(0, 400)}{ev.text.length > 400 ? "…" : ""}
      </div>
    );
  }
  if (ev.type === "tool_call") {
    const input = ev.input as Record<string, string>;
    const preview = ev.tool === "bash" ? truncate(input.command ?? "", 60)
      : ev.tool === "write_file" ? `→ ${input.path}`
      : ev.tool === "read_file" ? `← ${input.path}`
      : ev.tool;
    return (
      <button type="button" onClick={() => setExpanded(p => !p)}
        style={{ textAlign: "left", padding: "6px 10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 5, cursor: "pointer", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontFamily: M, fontSize: 9, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(255,255,255,0.38)", flexShrink: 0 }}>{ev.tool}</span>
          <span style={{ fontFamily: M, fontSize: 10, color: "rgba(255,255,255,0.65)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview}</span>
          <span style={{ marginLeft: "auto", fontFamily: M, fontSize: 9, color: "rgba(255,255,255,0.22)", flexShrink: 0 }}>{expanded ? "▲" : "▼"}</span>
        </div>
        {expanded && (
          <pre style={{ marginTop: 6, fontFamily: M, fontSize: 10, lineHeight: 1.5, color: "rgba(255,255,255,0.60)", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 160, overflow: "auto" }}>
            {ev.tool === "bash" ? input.command : ev.tool === "write_file" ? truncate(input.content, 500) : input.path}
          </pre>
        )}
      </button>
    );
  }
  if (ev.type === "tool_result") {
    return (
      <div style={{ padding: "5px 10px 7px", background: ev.error ? "rgba(220,38,38,0.05)" : "rgba(74,222,128,0.03)", border: `1px solid ${ev.error ? "rgba(220,38,38,0.15)" : "rgba(74,222,128,0.10)"}`, borderRadius: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: ev.output && ev.output !== "(no output)" ? 3 : 0 }}>
          <span style={{ fontFamily: M, fontSize: 9, color: ev.error ? "#fca5a5" : "#4ade80", fontWeight: 600 }}>{ev.error ? "✗" : "✓"} {ev.tool}</span>
          <span style={{ fontFamily: M, fontSize: 9, color: "rgba(255,255,255,0.22)" }}>{ev.duration_ms}ms</span>
        </div>
        {ev.output && ev.output !== "(no output)" && (
          <pre style={{ fontFamily: M, fontSize: 10, lineHeight: 1.5, color: "rgba(255,255,255,0.60)", whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, maxHeight: 120, overflow: "auto" }}>
            {truncate(ev.output, 400)}
          </pre>
        )}
      </div>
    );
  }
  if (ev.type === "artifact_ready") {
    return (
      <div style={{ padding: "6px 10px", background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.18)", borderRadius: 5, fontFamily: M, fontSize: 10, color: "#4ade80", fontWeight: 600 }}>
        ✓ Output ready — {ev.filename} ({(ev.size_bytes / 1024).toFixed(0)} KB)
      </div>
    );
  }
  if (ev.type === "complete") {
    return <div style={{ padding: "6px 10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 5, fontFamily: M, fontSize: 10, color: "rgba(255,255,255,0.45)" }}>✓ Run complete</div>;
  }
  if (ev.type === "error") {
    return (
      <div style={{ padding: "8px 10px", background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.20)", borderRadius: 5, fontFamily: M, fontSize: 11, color: "#fca5a5" }}>
        ✗ {ev.message}
      </div>
    );
  }
  return null;
}

function truncate(s: string, max: number): string {
  return s && s.length > max ? s.slice(0, max) + "…" : (s ?? "");
}
