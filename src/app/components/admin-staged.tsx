import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import NavAuth from "./nav-auth";
import Wordmark from "./wordmark";

const F = "'Erode', serif";
const M = "'Fragment Mono', monospace";

interface StagedSkill {
  id: string;
  name: string;
  slug: string;
  description: string;
  github_repo: string;
  github_url: string | null;
  skill_folder_path: string;
  github_license: string | null;
  github_stars: number;
  skill_md_content: string | null;
  readme_content: string | null;
  frontmatter: Record<string, unknown> | null;
  instruction_word_count: number | null;
  confidence_score: number | null;
  auto_flags: string[] | null;
  review_status: "pending" | "approved" | "rejected";
  reviewer_notes: string | null;
  created_at: string;
  live_skill_id: string | null;
}

type StatusFilter = "pending" | "approved" | "rejected" | "all";

export default function AdminStaged() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState<StagedSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [repoFilter, setRepoFilter] = useState<string>("all");
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch staged rows. RLS restricts this to admins.
  useEffect(() => {
    if (authLoading) return;
    if (!profile?.is_admin) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("skills_staged")
      .select("*")
      .order("confidence_score", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(err.message);
        } else if (data) {
          setRows(data as unknown as StagedSkill[]);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, profile?.is_admin, busy]);

  const repos = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => s.add(r.github_repo));
    return ["all", ...Array.from(s).sort()];
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.review_status !== statusFilter) return false;
      if (repoFilter !== "all" && r.github_repo !== repoFilter) return false;
      if ((r.confidence_score ?? 0) < minConfidence) return false;
      return true;
    });
  }, [rows, statusFilter, repoFilter, minConfidence]);

  const pendingCount = rows.filter((r) => r.review_status === "pending").length;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedIds(new Set(filtered.filter((r) => r.review_status === "pending").map((r) => r.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function markStatus(ids: string[], status: "approved" | "rejected") {
    if (ids.length === 0) return;
    setBusy(`marking ${ids.length} as ${status}`);
    setError(null);
    try {
      const { error: err } = await supabase
        .from("skills_staged")
        .update({
          review_status: status,
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in("id", ids);
      if (err) throw err;

      if (status === "approved") {
        // Promote each approved row into the live skills table.
        for (const id of ids) {
          const { error: rpcErr } = await supabase.rpc("promote_staged_skill", {
            staged_id: id,
          });
          if (rpcErr) {
            setError(`${ids.length} approved, but promotion failed on one: ${rpcErr.message}`);
            break;
          }
        }
      }
      clearSelection();
    } catch (e: any) {
      setError(e?.message || "Operation failed");
    } finally {
      setBusy(null);
    }
  }

  // ── Gating ──
  if (authLoading) {
    return <Shell><Centered>Loading…</Centered></Shell>;
  }
  if (!user) {
    return (
      <Shell>
        <Centered>
          <div style={{ fontSize: 18, marginBottom: 12, fontFamily: F }}>Sign in required</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 18 }}>
            The review queue is admin-only.
          </div>
          <button onClick={() => navigate("/publish")} style={ghostBtn}>Sign in</button>
        </Centered>
      </Shell>
    );
  }
  if (!profile?.is_admin) {
    return (
      <Shell>
        <Centered>
          <div style={{ fontSize: 18, marginBottom: 12, fontFamily: F }}>Admin only</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
            Your account (@{profile?.github_username}) does not have admin rights.
          </div>
        </Centered>
      </Shell>
    );
  }

  // ── Main UI ──
  return (
    <Shell>
      <div style={{ padding: "24px 48px 80px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <h1 style={{ fontSize: 26, fontFamily: F, fontWeight: 700, letterSpacing: "-0.02em" }}>
            Review queue
          </h1>
          <div style={{ fontSize: 12, fontFamily: M, color: "rgba(255,255,255,0.4)" }}>
            {pendingCount} pending
          </div>
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 20, fontFamily: F, maxWidth: 720 }}>
          Skills wait here until an admin approves them. Approving promotes the row into the live catalog; rejecting hides it permanently.
        </div>

        {/* Filters */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 16 }}>
          <Pills
            options={[
              { id: "pending", label: `Pending (${rows.filter((r) => r.review_status === "pending").length})` },
              { id: "approved", label: `Approved (${rows.filter((r) => r.review_status === "approved").length})` },
              { id: "rejected", label: `Rejected (${rows.filter((r) => r.review_status === "rejected").length})` },
              { id: "all", label: "All" },
            ]}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v as StatusFilter); clearSelection(); }}
          />
          <select value={repoFilter} onChange={(e) => setRepoFilter(e.target.value)} style={selectStyle}>
            {repos.map((r) => (
              <option key={r} value={r} style={{ background: "#111" }}>
                {r === "all" ? "All repos" : r}
              </option>
            ))}
          </select>
          <label style={{ fontSize: 12, fontFamily: M, color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", gap: 8 }}>
            Min confidence
            <input
              type="range" min={0} max={100} step={5}
              value={minConfidence}
              onChange={(e) => setMinConfidence(parseInt(e.target.value))}
              style={{ width: 120 }}
            />
            <span style={{ minWidth: 24 }}>{minConfidence}</span>
          </label>
        </div>

        {/* Bulk actions */}
        {statusFilter === "pending" && (
          <div style={{
            display: "flex", gap: 8, alignItems: "center", marginBottom: 16,
            padding: "10px 14px", background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8,
          }}>
            <span style={{ fontSize: 12, fontFamily: M, color: "rgba(255,255,255,0.5)" }}>
              {selectedIds.size} selected
            </span>
            <button onClick={selectAllFiltered} style={ghostBtn}>Select all visible</button>
            <button onClick={clearSelection} style={ghostBtn}>Clear</button>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => markStatus(Array.from(selectedIds), "rejected")}
              disabled={selectedIds.size === 0 || !!busy}
              style={dangerBtn(selectedIds.size === 0 || !!busy)}
            >
              Reject {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
            </button>
            <button
              onClick={() => markStatus(Array.from(selectedIds), "approved")}
              disabled={selectedIds.size === 0 || !!busy}
              style={primaryBtn(selectedIds.size === 0 || !!busy)}
            >
              Approve {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
            </button>
          </div>
        )}

        {error && (
          <div style={{
            padding: "10px 14px", marginBottom: 16,
            background: "rgba(220,38,38,0.1)",
            border: "1px solid rgba(220,38,38,0.3)",
            borderRadius: 8, fontSize: 13, color: "rgba(255,200,200,0.9)",
          }}>
            {error}
          </div>
        )}

        {loading && <div style={{ color: "rgba(255,255,255,0.3)", fontFamily: M, fontSize: 13 }}>Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: "60px 24px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontFamily: F }}>
            Nothing in this view.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((r) => (
            <StagedRow
              key={r.id}
              row={r}
              selected={selectedIds.has(r.id)}
              expanded={expandedId === r.id}
              onToggleSelect={() => toggleSelect(r.id)}
              onToggleExpand={() => setExpandedId(expandedId === r.id ? null : r.id)}
              onApprove={() => markStatus([r.id], "approved")}
              onReject={() => markStatus([r.id], "rejected")}
              busy={!!busy}
            />
          ))}
        </div>
      </div>
    </Shell>
  );
}

// ── Row component ─────────────────────────────────────────────────

interface RowProps {
  row: StagedSkill;
  selected: boolean;
  expanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}

function StagedRow({ row, selected, expanded, onToggleSelect, onToggleExpand, onApprove, onReject, busy }: RowProps) {
  const confidence = row.confidence_score ?? 0;
  const confColor =
    confidence >= 85 ? "#4ade80" :
    confidence >= 60 ? "#fcd34d" :
    "#fca5a5";
  const statusColor =
    row.review_status === "approved" ? "#4ade80" :
    row.review_status === "rejected" ? "#fca5a5" :
    "#fcd34d";

  return (
    <div style={{
      border: `1px solid ${selected ? "rgba(34,211,238,0.3)" : "rgba(255,255,255,0.06)"}`,
      background: selected ? "rgba(34,211,238,0.03)" : "rgba(255,255,255,0.02)",
      borderRadius: 10,
      overflow: "hidden",
    }}>
      {/* Summary row */}
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        {row.review_status === "pending" && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            style={{ cursor: "pointer", accentColor: "#22d3ee" }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600, fontFamily: F }}>{row.name}</span>
            <span style={{
              fontSize: 10, fontFamily: M, padding: "1px 6px", borderRadius: 4,
              background: `${confColor}1F`, color: confColor, fontWeight: 600,
            }}>
              {confidence}
            </span>
            <span style={{
              fontSize: 10, fontFamily: M, padding: "1px 6px", borderRadius: 4,
              background: `${statusColor}1F`, color: statusColor, textTransform: "uppercase" as const,
            }}>
              {row.review_status}
            </span>
            {(row.auto_flags || []).map((f) => (
              <span key={f} style={{
                fontSize: 10, fontFamily: M, padding: "1px 6px", borderRadius: 4,
                background: "rgba(245,158,11,0.12)", color: "#fcd34d",
              }}>⚠ {f}</span>
            ))}
          </div>
          <div style={{ fontSize: 12, fontFamily: M, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {row.github_repo} / {row.skill_folder_path}
            {" · "}
            ★ {row.github_stars}
            {" · "}
            {row.github_license || "no license"}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontFamily: F, marginTop: 4, lineHeight: 1.5 }}>
            {row.description}
          </div>
        </div>
        <button onClick={onToggleExpand} style={ghostBtn}>
          {expanded ? "Hide" : "Inspect"}
        </button>
        {row.review_status === "pending" && (
          <>
            <button onClick={onReject} disabled={busy} style={dangerBtn(busy)}>Reject</button>
            <button onClick={onApprove} disabled={busy} style={primaryBtn(busy)}>Approve</button>
          </>
        )}
      </div>

      {/* Expanded: side-by-side listing ↔ SKILL.md */}
      {expanded && (
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0,
        }}>
          <section style={{ padding: 16, borderRight: "1px solid rgba(255,255,255,0.06)" }}>
            <SectionTitle>Proposed listing</SectionTitle>
            <KV label="slug" value={row.slug} />
            <KV label="description" value={row.description} multiline />
            <KV label="word count" value={String(row.instruction_word_count ?? "—")} />
            <KV label="frontmatter" value={JSON.stringify(row.frontmatter ?? {}, null, 2)} multiline mono />
            {row.github_url && (
              <a href={row.github_url} target="_blank" rel="noopener noreferrer"
                 style={{ fontSize: 12, color: "#22d3ee", fontFamily: M, display: "inline-block", marginTop: 8 }}>
                open on github ↗
              </a>
            )}
          </section>
          <section style={{ padding: 16 }}>
            <SectionTitle>SKILL.md</SectionTitle>
            <pre style={{
              fontSize: 12, fontFamily: M, lineHeight: 1.6,
              color: "rgba(255,255,255,0.7)",
              background: "rgba(0,0,0,0.3)", padding: 12, borderRadius: 6,
              maxHeight: 480, overflow: "auto", whiteSpace: "pre-wrap",
            }}>
              {row.skill_md_content || "(no SKILL.md content stored)"}
            </pre>
          </section>
        </div>
      )}
    </div>
  );
}

// ── Presentation helpers ──────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#000", color: "#fff", minHeight: "100vh", fontFamily: F }}>
      <nav style={{
        position: "sticky", top: 0, zIndex: 100, height: 56, padding: "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Wordmark size={20} clickable />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontFamily: M }}>admin · staged</span>
        </div>
        <NavAuth />
      </nav>
      <main id="main-content">{children}</main>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "120px 24px", textAlign: "center", maxWidth: 440, margin: "0 auto" }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontFamily: M, letterSpacing: "0.1em",
      textTransform: "uppercase", color: "rgba(255,255,255,0.35)",
      marginBottom: 10,
    }}>{children}</div>
  );
}

function KV({ label, value, multiline, mono }: { label: string; value: string; multiline?: boolean; mono?: boolean }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontFamily: M, color: "rgba(255,255,255,0.3)", marginBottom: 3, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
        {label}
      </div>
      {multiline ? (
        <pre style={{
          fontSize: 12, fontFamily: mono ? M : F, color: "rgba(255,255,255,0.75)",
          whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.5, margin: 0,
        }}>{value}</pre>
      ) : (
        <div style={{ fontSize: 13, fontFamily: F, color: "rgba(255,255,255,0.75)" }}>{value}</div>
      )}
    </div>
  );
}

function Pills<T extends string>({
  options, value, onChange,
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          style={{
            padding: "6px 12px", borderRadius: 100, fontSize: 12, fontWeight: 500,
            fontFamily: M,
            border: value === o.id ? "1px solid rgba(255,255,255,0.3)" : "1px solid rgba(255,255,255,0.06)",
            background: value === o.id ? "rgba(255,255,255,0.06)" : "transparent",
            color: value === o.id ? "#fff" : "rgba(255,255,255,0.4)",
            cursor: "pointer",
          }}
        >{o.label}</button>
      ))}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#fff", outline: "none", fontFamily: M,
  fontSize: 12, padding: "6px 10px", borderRadius: 6, cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.8)",
  padding: "6px 12px", borderRadius: 6, fontSize: 12, fontFamily: M, fontWeight: 500,
  cursor: "pointer",
};

const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  background: disabled ? "rgba(255,255,255,0.06)" : "#fff",
  color: disabled ? "rgba(255,255,255,0.25)" : "#000",
  border: "1px solid rgba(255,255,255,0.12)",
  padding: "6px 14px", borderRadius: 6, fontSize: 12, fontFamily: M, fontWeight: 600,
  cursor: disabled ? "not-allowed" : "pointer",
});

const dangerBtn = (disabled: boolean): React.CSSProperties => ({
  background: disabled ? "rgba(255,255,255,0.04)" : "rgba(220,38,38,0.12)",
  color: disabled ? "rgba(255,255,255,0.25)" : "#fca5a5",
  border: `1px solid ${disabled ? "rgba(255,255,255,0.08)" : "rgba(220,38,38,0.3)"}`,
  padding: "6px 12px", borderRadius: 6, fontSize: 12, fontFamily: M, fontWeight: 500,
  cursor: disabled ? "not-allowed" : "pointer",
});
