import { useState, useEffect, useRef } from "react";

const CATEGORIES = [
  { id: "all", label: "All Skills", count: 12847 },
  { id: "documents", label: "Documents", count: 2341 },
  { id: "code", label: "Code Analysis", count: 3102 },
  { id: "data", label: "Data & ETL", count: 1876 },
  { id: "devops", label: "DevOps", count: 982 },
  { id: "research", label: "Research", count: 1450 },
  { id: "creative", label: "Creative", count: 890 },
  { id: "legal", label: "Legal", count: 412 },
  { id: "finance", label: "Finance", count: 678 },
  { id: "testing", label: "Testing & QA", count: 534 },
  { id: "api", label: "API Design", count: 582 },
];

const SKILLS_DB = [
  { name: "PDF Architect", author: "synthwave_dev", installs: 12400, rating: 4.9, reviews: 342, price: "Free", cat: "documents", updated: "2d ago", version: "2.4.1", desc: "Generate, merge, split, watermark, and fill PDF forms with a single skill.", license: "MIT", size: "24KB" },
  { name: "Code Reviewer Pro", author: "neural_ops", installs: 8700, rating: 4.8, reviews: 218, price: "$4.99", cat: "code", updated: "5d ago", version: "3.1.0", desc: "Automated code review with style enforcement, bug detection, and PR-ready comments.", license: "Proprietary", size: "18KB" },
  { name: "Data Pipeline Gen", author: "flowstate", installs: 6200, rating: 4.7, reviews: 156, price: "$9.99", cat: "data", updated: "1w ago", version: "1.8.2", desc: "Generate ETL pipelines from natural language descriptions. Supports Airflow, Dagster, Prefect.", license: "Apache-2.0", size: "42KB" },
  { name: "API Doc Writer", author: "restful_ai", installs: 15100, rating: 4.9, reviews: 487, price: "Free", cat: "api", updated: "3d ago", version: "4.0.0", desc: "Auto-generate OpenAPI specs, SDK docs, and interactive API references from code.", license: "MIT", size: "31KB" },
  { name: "SQL Optimizer", author: "query_mind", installs: 4800, rating: 4.6, reviews: 134, price: "$7.99", cat: "data", updated: "2w ago", version: "2.2.0", desc: "Analyze slow queries, suggest indexes, rewrite for performance. Postgres, MySQL, SQLite.", license: "Proprietary", size: "15KB" },
  { name: "React Scaffolder", author: "component_lab", installs: 9300, rating: 4.8, reviews: 267, price: "Free", cat: "code", updated: "1d ago", version: "5.2.1", desc: "Scaffold React components, hooks, tests, and Storybook stories from descriptions.", license: "MIT", size: "28KB" },
  { name: "Contract Analyzer", author: "legal_ai", installs: 3200, rating: 4.5, reviews: 89, price: "$14.99", cat: "legal", updated: "4d ago", version: "1.3.0", desc: "Extract clauses, flag risks, compare against templates. NDA, SaaS, employment contracts.", license: "Proprietary", size: "52KB" },
  { name: "Test Suite Builder", author: "qa_forge", installs: 5600, rating: 4.7, reviews: 178, price: "Free", cat: "testing", updated: "6d ago", version: "2.0.4", desc: "Generate comprehensive test suites from function signatures. Jest, Pytest, Vitest.", license: "MIT", size: "19KB" },
  { name: "Slide Deck Maker", author: "deck_smith", installs: 7800, rating: 4.6, reviews: 203, price: "$5.99", cat: "documents", updated: "1w ago", version: "3.0.1", desc: "Create PPTX presentations from outlines with consistent branding and layouts.", license: "Proprietary", size: "67KB" },
  { name: "k8s Deployer", author: "cloud_native", installs: 4100, rating: 4.8, reviews: 112, price: "Free", cat: "devops", updated: "3d ago", version: "1.5.0", desc: "Generate Kubernetes manifests, Helm charts, and Kustomize configs from app descriptions.", license: "Apache-2.0", size: "35KB" },
  { name: "Research Digest", author: "arxiv_reader", installs: 6700, rating: 4.7, reviews: 198, price: "Free", cat: "research", updated: "2d ago", version: "2.1.0", desc: "Summarize arXiv papers, extract key findings, generate literature review sections.", license: "MIT", size: "22KB" },
  { name: "Brand Copy Gen", author: "wordcraft", installs: 3900, rating: 4.4, reviews: 95, price: "$6.99", cat: "creative", updated: "1w ago", version: "1.7.3", desc: "Generate on-brand marketing copy, taglines, and social posts with tone control.", license: "Proprietary", size: "14KB" },
  { name: "Excel Automator", author: "spreadsheet_ai", installs: 11200, rating: 4.8, reviews: 356, price: "Free", cat: "data", updated: "4d ago", version: "3.3.0", desc: "Build complex XLSX workbooks with formulas, charts, pivot tables, and macros.", license: "MIT", size: "45KB" },
  { name: "Terraform Writer", author: "infra_code", installs: 5400, rating: 4.7, reviews: 167, price: "$8.99", cat: "devops", updated: "5d ago", version: "2.0.0", desc: "Generate Terraform modules for AWS, GCP, Azure from infrastructure descriptions.", license: "Apache-2.0", size: "38KB" },
  { name: "Docx Formatter", author: "doc_pro", installs: 8900, rating: 4.6, reviews: 245, price: "Free", cat: "documents", updated: "1d ago", version: "4.1.2", desc: "Create professional Word documents with headers, TOC, page numbers, and letterheads.", license: "MIT", size: "33KB" },
  { name: "Financial Model", author: "quant_build", installs: 2800, rating: 4.5, reviews: 76, price: "$19.99", cat: "finance", updated: "2w ago", version: "1.1.0", desc: "Build DCF models, forecast P&L, generate investor-ready financial projections.", license: "Proprietary", size: "58KB" },
];

const SORT_OPTIONS = [
  { id: "relevance", label: "Relevance" },
  { id: "installs", label: "Most installed" },
  { id: "rating", label: "Highest rated" },
  { id: "updated", label: "Recently updated" },
  { id: "name", label: "Name A-Z" },
];

const PRICE_FILTERS = ["Any", "Free", "Paid"];
const LICENSE_FILTERS = ["Any", "MIT", "Apache-2.0", "Proprietary"];

function fmt(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

function Stars({ rating }) {
  return (
    <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
      {"★".repeat(Math.floor(rating))}
      <span style={{ color: "rgba(255,255,255,0.15)" }}>{"★".repeat(5 - Math.floor(rating))}</span>
      <span style={{ marginLeft: 4 }}>{rating}</span>
    </span>
  );
}

export default function Explore() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState("relevance");
  const [priceFilter, setPriceFilter] = useState("Any");
  const [licenseFilter, setLicenseFilter] = useState("Any");
  const [hovered, setHovered] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "/" && document.activeElement.tagName !== "INPUT") { e.preventDefault(); inputRef.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = SKILLS_DB
    .filter(s => cat === "all" || s.cat === cat)
    .filter(s => !query || s.name.toLowerCase().includes(query.toLowerCase()) || s.desc.toLowerCase().includes(query.toLowerCase()) || s.author.toLowerCase().includes(query.toLowerCase()))
    .filter(s => priceFilter === "Any" || (priceFilter === "Free" ? s.price === "Free" : s.price !== "Free"))
    .filter(s => licenseFilter === "Any" || s.license === licenseFilter)
    .sort((a, b) => {
      if (sort === "installs") return b.installs - a.installs;
      if (sort === "rating") return b.rating - a.rating;
      if (sort === "name") return a.name.localeCompare(b.name);
      return 0;
    });

  const M = "'IBM Plex Mono', monospace";
  const S = "'Syne', sans-serif";

  return (
    <div style={{ background: "#000", color: "#fff", minHeight: "100vh", fontFamily: S }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        ::selection{background:#fff;color:#000}
        input::placeholder{color:rgba(255,255,255,0.2)}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:#000}
        ::-webkit-scrollbar-thumb{background:#222;border-radius:2px}
        .row-item{transition:background .2s;cursor:pointer;position:relative}
        .row-item:hover{background:rgba(255,255,255,0.03)!important}
        .row-item::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:rgba(255,255,255,0.04)}
        .cat-row{transition:all .2s;cursor:pointer;border-radius:6px;padding:7px 10px;display:flex;justify-content:space-between;align-items:center}
        .cat-row:hover{background:rgba(255,255,255,0.05)}
        .filter-btn{transition:all .2s;cursor:pointer;font-family:inherit}
        .filter-btn:hover{border-color:rgba(255,255,255,0.3)!important;color:#fff!important}
        .sort-select{background:transparent;border:1px solid rgba(255,255,255,0.08);color:#fff;font-family:inherit;font-size:12px;padding:6px 10px;border-radius:6px;cursor:pointer;outline:none;-webkit-appearance:none;appearance:none}
        .sort-select option{background:#111;color:#fff}
        .install-btn{transition:all .2s;cursor:pointer;font-family:inherit}
        .install-btn:hover{background:#fff!important;color:#000!important}
        .tag{font-size:10px;padding:2px 7px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.35);font-family:'IBM Plex Mono',monospace;letter-spacing:0.02em;white-space:nowrap}
      `}</style>

      {/* ── NAV ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100, height: 56, padding: "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="70" height="18" viewBox="0 0 70 18" style={{ display: "block" }}>
            <line x1="3" y1="16" x2="11" y2="2" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            <text x="16" y="15" fontFamily="'Syne', sans-serif" fontSize="15" fontWeight="700" fill="#fff" letterSpacing="-0.4">skiyu</text>
          </svg>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontFamily: M }}>/explore</span>
        </div>
        <div style={{ display: "flex", gap: 20, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
          {["Explore", "Publish", "Docs", "Pricing"].map(l => (
            <span key={l} style={{ cursor: "pointer", color: l === "Explore" ? "#fff" : undefined, fontWeight: l === "Explore" ? 600 : 400 }}>{l}</span>
          ))}
        </div>
        <button className="install-btn" style={{
          background: "rgba(255,255,255,0.08)", color: "#fff", border: "none",
          padding: "6px 16px", borderRadius: 6, fontSize: 12, fontWeight: 600,
        }}>Sign in</button>
      </nav>

      <div style={{ display: "flex", maxWidth: 1200, margin: "0 auto" }}>

        {/* ── SIDEBAR ── */}
        <aside style={{
          width: sidebarCollapsed ? 48 : 220, flexShrink: 0,
          borderRight: "1px solid rgba(255,255,255,0.04)",
          padding: sidebarCollapsed ? "20px 8px" : "20px 16px",
          position: "sticky", top: 56, height: "calc(100vh - 56px)", overflowY: "auto",
          transition: "width 0.3s, padding 0.3s",
        }}>
          {/* collapse toggle */}
          <div
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{ cursor: "pointer", marginBottom: 16, padding: "4px 0", color: "rgba(255,255,255,0.2)", fontSize: 11, fontFamily: M, letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 6 }}
          >
            <span style={{ fontSize: 14 }}>{sidebarCollapsed ? "→" : "←"}</span>
            {!sidebarCollapsed && "CATEGORIES"}
          </div>

          {!sidebarCollapsed && CATEGORIES.map(c => (
            <div key={c.id} className="cat-row"
              onClick={() => setCat(c.id)}
              style={{
                fontSize: 13, fontWeight: cat === c.id ? 700 : 400,
                color: cat === c.id ? "#fff" : "rgba(255,255,255,0.35)",
                background: cat === c.id ? "rgba(255,255,255,0.06)" : "transparent",
                marginBottom: 2,
              }}>
              <span>{c.label}</span>
              <span style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.15)" }}>{c.count}</span>
            </div>
          ))}

          {!sidebarCollapsed && (
            <>
              <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "16px 0" }} />
              <div style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em", marginBottom: 10 }}>PRICE</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                {PRICE_FILTERS.map(p => (
                  <button key={p} className="filter-btn" onClick={() => setPriceFilter(p)} style={{
                    padding: "4px 12px", borderRadius: 100, fontSize: 12, border: "1px solid",
                    borderColor: priceFilter === p ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.08)",
                    background: priceFilter === p ? "rgba(255,255,255,0.06)" : "transparent",
                    color: priceFilter === p ? "#fff" : "rgba(255,255,255,0.3)",
                  }}>{p}</button>
                ))}
              </div>
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

        {/* ── MAIN ── */}
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
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search skills, authors, descriptions..."
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 14, padding: "10px 0", fontFamily: S }}
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
                {priceFilter !== "Any" && (
                  <span style={{ fontSize: 11, fontFamily: M, padding: "3px 8px", borderRadius: 4, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 4 }}>
                    {priceFilter}
                    <span onClick={() => setPriceFilter("Any")} style={{ cursor: "pointer", opacity: 0.5 }}>×</span>
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
                {filtered.length} {filtered.length === 1 ? "skill" : "skills"}
              </span>
            </div>
          </div>

          {/* column headers */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 100px 90px 80px 80px 90px",
            padding: "10px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            fontSize: 10, fontFamily: M, color: "rgba(255,255,255,0.2)",
            letterSpacing: "0.08em", textTransform: "uppercase",
          }}>
            <span>Skill</span>
            <span style={{ textAlign: "right" }}>Installs</span>
            <span style={{ textAlign: "right" }}>Rating</span>
            <span style={{ textAlign: "right" }}>Price</span>
            <span style={{ textAlign: "right" }}>Size</span>
            <span style={{ textAlign: "right" }}>Updated</span>
          </div>

          {/* skill rows */}
          {filtered.map((s, i) => (
            <div key={s.name} className="row-item"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 100px 90px 80px 80px 90px",
                padding: "14px 24px",
                alignItems: "center",
              }}>
              {/* name + meta */}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em" }}>{s.name}</span>
                  <span style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.15)" }}>v{s.version}</span>
                  <span className="tag">{s.license}</span>
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.desc}
                </div>
                <div style={{ marginTop: 4, fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.15)" }}>
                  @{s.author}
                </div>
              </div>

              {/* installs */}
              <div style={{ textAlign: "right", fontSize: 13, fontFamily: M, color: "rgba(255,255,255,0.5)" }}>
                {fmt(s.installs)}
              </div>

              {/* rating */}
              <div style={{ textAlign: "right" }}>
                <Stars rating={s.rating} />
              </div>

              {/* price */}
              <div style={{ textAlign: "right", fontSize: 13, fontFamily: M, fontWeight: 600, color: s.price === "Free" ? "rgba(255,255,255,0.3)" : "#fff" }}>
                {s.price}
              </div>

              {/* size */}
              <div style={{ textAlign: "right", fontSize: 12, fontFamily: M, color: "rgba(255,255,255,0.2)" }}>
                {s.size}
              </div>

              {/* updated */}
              <div style={{ textAlign: "right", fontSize: 12, fontFamily: M, color: "rgba(255,255,255,0.2)" }}>
                {s.updated}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
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
            <svg width="50" height="14" viewBox="0 0 50 14" style={{ opacity: 0.15 }}>
              <line x1="2" y1="12" x2="8" y2="2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
              <text x="12" y="12" fontFamily="'Syne', sans-serif" fontSize="11" fontWeight="600" fill="#fff" letterSpacing="-0.2">skiyu</text>
            </svg>
            <span style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.1)" }}>
              Press / to search
            </span>
          </div>
        </main>
      </div>
    </div>
  );
}
