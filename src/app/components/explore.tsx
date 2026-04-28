import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useSkills, useCategories, useCategoryCounts } from "@/lib/hooks";
import NavAuth from "./nav-auth";
import { useAuth } from "@/lib/auth";
import SkillModal from "./skill-modal";
import SkillCard from "./skill-card";
import Wordmark from "./wordmark";
import type { SkillCatalogItem } from "@/lib/types";
import { preloadRoute } from "../routes";

// Sort options for the explore catalog. The directory framing means
// freshness wins by default; the rest are honest secondary axes that
// derive from real data we have today (no runtime evidence required).
const SORT_OPTIONS = [
  { id: "updated", label: "Recently updated" },
  { id: "newest", label: "Newest published" },
  { id: "name", label: "Name (A→Z)" },
  { id: "stars", label: "Most starred" },
];

const LICENSE_FILTERS = ["Any", "MIT", "Apache-2.0", "Proprietary"];

const M = "'Fragment Mono', monospace";
const F = "'Erode', serif";

function fmt(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

export default function Explore() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState("updated");
  const [licenseFilter, setLicenseFilter] = useState("Any");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [activeSkill, setActiveSkill] = useState<SkillCatalogItem | null>(null);
  const [page, setPage] = useState(0);
  const [accumulated, setAccumulated] = useState<SkillCatalogItem[]>([]);
  const PAGE_SIZE = 30;
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleDownload = async (e: React.MouseEvent, skillId: string, skillName: string) => {
    e.stopPropagation();
    setDownloadingId(skillId);
    setDownloadError(null);
    const result = await downloadSkill(skillId, skillName, user?.id);
    if (!result.success) {
      setDownloadError(result.error || "Download failed");
      setTimeout(() => setDownloadError(null), 4000);
    }
    setTimeout(() => setDownloadingId(null), 1200);
  };

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Reset pagination + accumulation whenever the filter set changes.
  useEffect(() => {
    setPage(0);
    setAccumulated([]);
  }, [debouncedQuery, cat, sort, licenseFilter]);

  // Fetch from Supabase (paginated, 30 per page)
  const { skills: pageSkills, loading, fetching, count } = useSkills({
    category: cat,
    search: debouncedQuery || undefined,
    sort,
    license: licenseFilter,
    page,
    pageSize: PAGE_SIZE,
  });

  // Accumulate pages: whenever a new page's data arrives, append.
  // Guard against dupes by skill id in case react-query replays.
  useEffect(() => {
    if (pageSkills.length === 0) return;
    setAccumulated((prev) => {
      if (page === 0) return pageSkills;
      const seen = new Set(prev.map((s) => s.id));
      const additions = pageSkills.filter((s) => !seen.has(s.id));
      return additions.length > 0 ? [...prev, ...additions] : prev;
    });
  }, [pageSkills, page]);

  const filtered = accumulated;
  const hasMore = filtered.length < count;
  const { categories: dbCategories } = useCategories();
  const { counts: catCounts, total: totalSkills } = useCategoryCounts();

  // Build category list from DB
  const CATEGORIES = [
    { id: "all", label: "All Skills", count: totalSkills, icon: "" },
    ...dbCategories.map(c => ({
      id: c.slug,
      label: c.name,
      count: catCounts[c.slug] || 0,
      icon: c.icon || "",
    })),
  ];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && (document.activeElement as HTMLElement)?.tagName !== "INPUT") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div style={{ background: "#000", color: "#fff", minHeight: "100vh", fontFamily: F }}>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        ::selection{background:#fff;color:#000}
        input::placeholder{color:rgba(255,255,255,0.2)}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:#000}
        ::-webkit-scrollbar-thumb{background:#222;border-radius:2px}
        .skill-card-grid{transition:all .3s cubic-bezier(.16,1,.3,1);cursor:pointer;position:relative;overflow:hidden}
        .skill-card-grid:hover{transform:translateY(-3px);background:rgba(255,255,255,0.04)!important;border-color:rgba(255,255,255,0.12)!important;box-shadow:0 8px 32px rgba(0,0,0,0.3)}
        .cat-row{transition:all .2s;cursor:pointer;border-radius:6px;padding:7px 10px;display:flex;justify-content:space-between;align-items:center}
        .cat-row:hover{background:rgba(255,255,255,0.05)}
        .filter-btn{transition:all .2s;cursor:pointer;font-family:inherit}
        .filter-btn:hover{border-color:rgba(255,255,255,0.3)!important;color:#fff!important}
        .sort-select{background:transparent;border:1px solid rgba(255,255,255,0.08);color:#fff;font-family:inherit;font-size:12px;padding:6px 10px;border-radius:6px;cursor:pointer;outline:none;-webkit-appearance:none;appearance:none}
        .sort-select option{background:#111;color:#fff}
        .install-btn{transition:all .2s;cursor:pointer;font-family:inherit}
        .install-btn:hover{background:#fff!important;color:#000!important}
        .tag{font-size:10px;padding:2px 7px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.35);font-family:${M};letter-spacing:0.02em;white-space:nowrap}
      `}</style>

      {/* NAV */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100, height: 56, padding: "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Wordmark size={20} clickable />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontFamily: M }}>explore</span>
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
              style={{ cursor: "pointer", color: l.label === "Explore" ? "#fff" : undefined, fontWeight: l.label === "Explore" ? 600 : 400 }}
            >{l.label}</span>
          ))}
        </div>
        <NavAuth />
      </nav>

      {/* Download error toast */}
      {downloadError && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 1000,
          background: "rgba(220,38,38,0.1)",
          border: "1px solid rgba(220,38,38,0.3)",
          borderRadius: 8, padding: "12px 16px",
          fontSize: 13, fontFamily: F,
          color: "rgba(255,200,200,0.9)",
          maxWidth: 320, backdropFilter: "blur(12px)",
          animation: "slideIn 0.2s ease-out",
        }}>
          <style>{`@keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>Download error</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>{downloadError}</div>
        </div>
      )}

      <div style={{ display: "flex", maxWidth: 1200, margin: "0 auto" }}>

        {/* SIDEBAR */}
        <aside style={{
          width: sidebarCollapsed ? 48 : 220, flexShrink: 0,
          borderRight: "1px solid rgba(255,255,255,0.04)",
          padding: sidebarCollapsed ? "20px 8px" : "20px 16px",
          position: "sticky", top: 56, height: "calc(100vh - 56px)", overflowY: "auto",
          transition: "width 0.3s, padding 0.3s",
        }}>
          <div
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{ cursor: "pointer", marginBottom: 16, padding: "4px 0", color: "rgba(255,255,255,0.2)", fontSize: 11, fontFamily: M, letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 6 }}
          >
            <span style={{ fontSize: 14 }}>{sidebarCollapsed ? "→" : "←"}</span>
            {!sidebarCollapsed && "CATEGORIES"}
          </div>

          {!sidebarCollapsed && CATEGORIES.map(c => {
            const color = "#22d3ee";
            const isActive = cat === c.id;
            return (
              <div key={c.id} className="cat-row"
                onClick={() => setCat(c.id)}
                style={{
                  fontSize: 13, fontWeight: isActive ? 700 : 400,
                  color: isActive ? "#fff" : "rgba(255,255,255,0.35)",
                  background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
                  borderLeft: isActive && color ? `2px solid ${color}` : "2px solid transparent",
                  marginBottom: 2,
                }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {color && <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0, opacity: isActive ? 1 : 0.5 }} />}
                  {c.label}
                </span>
                <span style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.15)" }}>{c.count}</span>
              </div>
            );
          })}

          {!sidebarCollapsed && (
            <>
              <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "16px 0" }} />
              <div style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em", marginBottom: 10 }}>LICENSE</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {LICENSE_FILTERS.map(l => (
                  <button key={l} className="filter-btn" onClick={() => setLicenseFilter(l)} style={{
                    padding: "4px 12px", borderRadius: 100, fontSize: 12, border: "1px solid",
                    borderColor: licenseFilter === l ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.08)",
                    background: licenseFilter === l ? "rgba(255,255,255,0.06)" : "transparent",
                    color: licenseFilter === l ? "#fff" : "rgba(255,255,255,0.3)",
                  }}>{l}</button>
                ))}
              </div>
            </>
          )}
        </aside>

        {/* MAIN */}
        <main style={{ flex: 1, minWidth: 0 }}>

          {/* search bar */}
          <div style={{
            position: "sticky", top: 56, zIndex: 50,
            padding: "16px 24px",
            background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                flex: 1, display: "flex", alignItems: "center", gap: 10,
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, padding: "0 14px",
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search skills, authors, descriptions..."
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 14, padding: "10px 0", fontFamily: F }}
                />
                <span style={{ fontSize: 10, fontFamily: M, color: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "2px 6px" }}>/</span>
              </div>
              <select className="sort-select" value={sort} onChange={e => setSort(e.target.value)}>
                {SORT_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>

            {/* active filters + result count */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {cat !== "all" && (
                  <span style={{ fontSize: 11, fontFamily: M, padding: "3px 8px", borderRadius: 4, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 4 }}>
                    {CATEGORIES.find(c => c.id === cat)?.label}
                    <span onClick={() => setCat("all")} style={{ cursor: "pointer", opacity: 0.5 }}>×</span>
                  </span>
                )}
                {licenseFilter !== "Any" && (
                  <span style={{ fontSize: 11, fontFamily: M, padding: "3px 8px", borderRadius: 4, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 4 }}>
                    {licenseFilter}
                    <span onClick={() => setLicenseFilter("Any")} style={{ cursor: "pointer", opacity: 0.5 }}>×</span>
                  </span>
                )}
              </div>
              <span style={{ fontSize: 12, fontFamily: M, color: "rgba(255,255,255,0.2)" }}>
                {loading ? "..." : `${count} ${count === 1 ? "skill" : "skills"}`}
              </span>
            </div>
          </div>

          {/* card grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
            padding: "16px 24px",
          }}>
            {loading ? (
              <div style={{ padding: "80px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.2)", fontFamily: M }}>Loading skills...</div>
              </div>
            ) : filtered.map(s => (
              <SkillCard
                key={s.id}
                skill={s}
                onOpen={setActiveSkill}
                preferModal
                userId={user?.id}
              />
            ))}
          </div>

          {/* Load more */}
          {!loading && filtered.length > 0 && hasMore && (
            <div style={{ padding: "24px", textAlign: "center" }}>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={fetching}
                style={{
                  padding: "10px 28px",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.04)",
                  color: fetching ? "rgba(255,255,255,0.3)" : "#fff",
                  fontSize: 12,
                  fontFamily: M,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  cursor: fetching ? "wait" : "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!fetching) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)";
                }}
                onMouseLeave={(e) => {
                  if (!fetching) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)";
                }}
              >
                {fetching ? "Loading…" : `Load ${Math.min(PAGE_SIZE, count - filtered.length)} more`}
              </button>
              <div style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.2)", marginTop: 10 }}>
                Showing {filtered.length} of ~{count}
              </div>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div style={{ padding: "80px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.1 }}>/</div>
              <div style={{ fontSize: 15, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>No skills match your filters</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.15)", marginTop: 6 }}>Try broadening your search or removing filters</div>
            </div>
          )}

          {/* footer */}
          <div style={{
            padding: "32px 24px", borderTop: "1px solid rgba(255,255,255,0.04)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <Wordmark size={13} clickable color="rgba(255,255,255,0.15)" />
            <span style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.1)" }}>
              Press / to search
            </span>
          </div>
        </main>
      </div>

      <SkillModal skill={activeSkill} onClose={() => setActiveSkill(null)} />
    </div>
  );
}