import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useFeaturedSkills, downloadSkill } from "@/lib/hooks";
import type { SkillCatalogItem } from "@/lib/types";
import NavAuth from "./nav-auth";
import { useAuth } from "@/lib/auth";
import SkillModal from "./skill-modal";

function NoiseOverlay() {
  const c = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = c.current; if (!cv) return;
    cv.width = 256; cv.height = 256;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const draw = () => {
      const img = ctx.createImageData(256, 256);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i+1] = img.data[i+2] = v;
        img.data[i+3] = 12;
      }
      ctx.putImageData(img, 0, 0);
      requestAnimationFrame(draw);
    };
    draw();
  }, []);
  return <canvas ref={c} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0, opacity: 0.3, mixBlendMode: "overlay" }} />;
}

function DotField() {
  const c = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -1000, y: -1000 });
  useEffect(() => {
    const cv = c.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let id: number;
    const resize = () => { cv.width = cv.offsetWidth * 2; cv.height = cv.offsetHeight * 2; };
    resize();
    window.addEventListener("resize", resize);
    const onMove = (e: MouseEvent) => {
      const r = cv.getBoundingClientRect();
      mouse.current = { x: (e.clientX - r.left) * 2, y: (e.clientY - r.top) * 2 };
    };
    cv.parentElement?.addEventListener("mousemove", onMove);
    const draw = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      const sp = 40, rad = 240;
      for (let x = sp; x < cv.width; x += sp) {
        for (let y = sp; y < cv.height; y += sp) {
          const dx = x - mouse.current.x, dy = y - mouse.current.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          const prox = Math.max(0, 1 - dist / rad);
          const size = 1 + prox * 3;
          const alpha = 0.06 + prox * 0.55;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${alpha})`;
          ctx.fill();
        }
      }
      id = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(id); window.removeEventListener("resize", resize); cv.parentElement?.removeEventListener("mousemove", onMove); };
  }, []);
  return <canvas ref={c} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />;
}

function MorphBlob({ size = 400, top, left, opacity = 0.04 }: { size?: number; top: string; left: string; opacity?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0, id: number;
    const el = ref.current; if (!el) return;
    const animate = () => {
      frame += 0.008;
      const r1 = 42 + Math.sin(frame) * 8;
      const r2 = 58 + Math.cos(frame * 1.3) * 6;
      const r3 = 45 + Math.sin(frame * 0.7) * 10;
      const r4 = 52 + Math.cos(frame * 1.1) * 7;
      el.style.borderRadius = `${r1}% ${100-r1}% ${r2}% ${100-r2}% / ${r3}% ${r4}% ${100-r4}% ${100-r3}%`;
      id = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(id);
  }, []);
  return <div ref={ref} style={{
    position: "absolute", top, left, width: size, height: size,
    background: `radial-gradient(circle, rgba(255,255,255,${opacity}) 0%, transparent 70%)`,
    filter: "blur(60px)", pointerEvents: "none",
  }} />;
}

export default function Home() {
  const [activeCat, setActiveCat] = useState("All");
  const [query, setQuery] = useState("");
  const [scrollY, setScrollY] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [activeSkill, setActiveSkill] = useState<SkillCatalogItem | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const { skills: allSkills, loading: skillsLoading } = useFeaturedSkills(12);

  const handleDownload = async (e: React.MouseEvent, skillId: string, skillName: string) => {
    e.stopPropagation();
    setDownloadingId(skillId);
    await downloadSkill(skillId, skillName, user?.id);
    setTimeout(() => setDownloadingId(null), 1200);
  };

  useEffect(() => {
    const fn = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const filtered = allSkills.filter((s: SkillCatalogItem) =>
    (activeCat === "All" || s.category_name === activeCat) &&
    (!query || s.name.toLowerCase().includes(query.toLowerCase()))
  );

  function fmt(n: number) {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return n.toString();
  }

  return (
    <div style={{ background: "#000", color: "#fff", minHeight: "100vh", fontFamily: "'Erode', serif", overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Fragment+Mono&display=swap" rel="stylesheet" />
      <NoiseOverlay />
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(50px); filter: blur(8px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes expandLine { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes breathe { 0%, 100% { opacity: 0.03; } 50% { opacity: 0.06; } }
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes floatSlow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes rollIn { 
          from { opacity: 0; transform: translateY(100%) rotateX(-80deg); filter: blur(6px); } 
          to { opacity: 1; transform: translateY(0) rotateX(0deg); filter: blur(0); } 
        }
        .roll-in span { display: inline-block; animation: rollIn 0.8s cubic-bezier(0.16,1,0.3,1) both; }
        .e1 { animation: fadeSlideUp 1s cubic-bezier(0.16,1,0.3,1) 0.1s both; }
        .e2 { animation: fadeSlideUp 1s cubic-bezier(0.16,1,0.3,1) 0.3s both; }
        .e3 { animation: fadeSlideUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.55s both; }
        .e4 { animation: fadeSlideUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.75s both; }
        .e5 { animation: fadeSlideUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.95s both; }
        .grid-bg::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 80px 80px;
          animation: breathe 5s ease-in-out infinite;
          pointer-events: none;
        }
        .skill-card { position: relative; transition: all 0.5s cubic-bezier(0.16,1,0.3,1); overflow: hidden; }
        .skill-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent); opacity: 0; transition: opacity 0.5s; }
        .skill-card:hover { transform: translateY(-8px); }
        .skill-card:hover::before { opacity: 1; }
        .btn-primary { position: relative; overflow: hidden; background: #fff; color: #000; border: none; font-weight: 700; cursor: pointer; font-family: inherit; transition: all 0.3s cubic-bezier(0.16,1,0.3,1); }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(255,255,255,0.15); }
        .btn-ghost { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #fff; cursor: pointer; font-family: inherit; font-weight: 600; transition: all 0.3s; }
        .btn-ghost:hover { border-color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.04); }
        .nav-item { color: rgba(255,255,255,0.45); transition: color 0.3s; cursor: pointer; position: relative; font-weight: 500; }
        .nav-item::after { content: ''; position: absolute; bottom: -3px; left: 0; width: 0; height: 1px; background: #fff; transition: width 0.3s cubic-bezier(0.16,1,0.3,1); }
        .nav-item:hover { color: #fff; }
        .nav-item:hover::after { width: 100%; }
        .cat-pill { cursor: pointer; transition: all 0.3s; font-family: inherit; }
        .cat-pill:hover { background: rgba(255,255,255,0.08) !important; color: #fff !important; }
        .marquee-track { animation: marquee 30s linear infinite; display: flex; gap: 64px; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #000; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        input::placeholder { color: rgba(255,255,255,0.25); }
      `}</style>

      {/* NAV */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "0 48px", height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: scrollY > 60 ? "rgba(0,0,0,0.7)" : "transparent",
        backdropFilter: scrollY > 60 ? "blur(24px) saturate(1.8)" : "none",
        borderBottom: scrollY > 60 ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
        transition: "all 0.5s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          <span
            onClick={() => navigate("/")}
            style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.5px", cursor: "pointer", fontFamily: "'Erode', serif" }}
          >/ skiyu</span>
        </div>
        <div style={{ display: "flex", gap: 36, fontSize: 13 }}>
          {[
            { label: "Explore", path: "/explore" },
            { label: "Publish", path: "/publish" },
            { label: "Docs", path: "/docs" },
          ].map(l => (
            <span key={l.label} className="nav-item" onClick={() => navigate(l.path)}>{l.label}</span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <NavAuth />
        </div>
      </nav>

      {/* HERO */}
      <section style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "140px 24px 100px" }}>
        <DotField />
        <MorphBlob size={600} top="-5%" left="-10%" opacity={0.05} />
        <MorphBlob size={450} top="40%" left="65%" opacity={0.035} />
        <div style={{ position: "relative", zIndex: 2, maxWidth: 800 }}>
          <div className="e1" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 28, fontFamily: "'Fragment Mono', monospace" }}>
            The #1 Marketplace for Claude Agent Skills
          </div>
          <h1 className="e2" style={{ fontSize: "clamp(48px, 8vw, 96px)", fontWeight: 700, lineHeight: 0.95, letterSpacing: "-0.04em" }}>
            <span style={{ color: "rgba(255,255,255,0.15)" }}>/</span> skill engineering<br /><span style={{ fontStyle: "italic", fontWeight: 400 }}>made easy</span><span style={{ color: "rgba(255,255,255,0.15)" }}>.</span>
          </h1>
          <div className="e3" style={{ width: 60, height: 1, background: "rgba(255,255,255,0.3)", margin: "32px auto", animation: "expandLine 1s cubic-bezier(0.16,1,0.3,1) 0.6s both", transformOrigin: "center" }} />
          <p className="e3" style={{ fontSize: 17, color: "rgba(255,255,255,0.4)", lineHeight: 1.7, maxWidth: 480, margin: "0 auto", fontWeight: 400 }}>
            / skiyu lets you discover, install, and share Claude skills that power the next generation of workflows.
          </p>
          <div className="e3 roll-in" style={{ marginTop: 16, perspective: 600 }}>
            {"Welcome to / skiyu.".split(" ").map((word, i) => (
              <span key={i} style={{ animationDelay: `${0.8 + i * 0.1}s`, marginRight: 6, color: "rgba(255,255,255,0.25)", fontSize: 15, fontWeight: 400 }}>
                {word}
              </span>
            ))}
          </div>
          <div className="e4" style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 44 }}>
            <button className="btn-primary" onClick={() => navigate("/explore")} style={{ padding: "14px 36px", borderRadius: 8, fontSize: 14 }}>Explore Skills</button>
            <button className="btn-ghost" style={{ padding: "14px 36px", borderRadius: 8, fontSize: 14 }}>Publish Yours</button>
          </div>
          <div className="e5" style={{ marginTop: 48, maxWidth: 520, margin: "48px auto 0", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "4px 6px 4px 18px", transition: "border-color 0.3s" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input type="text" placeholder={`Search ${allSkills.length}+ skills...`} value={query} onChange={e => setQuery(e.target.value)} style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 14, padding: "12px 12px", fontFamily: "inherit" }} />
              <button className="btn-primary" style={{ padding: "9px 18px", borderRadius: 7, fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase" }}>Search</button>
            </div>
          </div>
          <div className="e5" style={{ marginTop: 28, maxWidth: 440, margin: "28px auto 0", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "14px 18px", textAlign: "left", fontFamily: "'Fragment Mono', monospace", fontSize: 12.5, background: "rgba(255,255,255,0.02)" }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {[0.15, 0.1, 0.1].map((o, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: 4, background: `rgba(255,255,255,${o})` }} />)}
            </div>
            <div><span style={{ color: "rgba(255,255,255,0.3)" }}>$</span> <span style={{ color: "rgba(255,255,255,0.6)" }}>/ skiyu install</span> <span style={{ color: "rgba(255,255,255,0.9)" }}>@synthwave/pdf-architect</span></div>
            <div style={{ marginTop: 6, color: "rgba(255,255,255,0.4)" }}><span style={{ color: "rgba(255,255,255,0.6)" }}>✓</span> Installed v2.4.1 — skill active in Claude</div>
          </div>
        </div>
        <div style={{ position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, animation: "floatSlow 3s ease-in-out infinite" }}>
          <span style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.15)", fontFamily: "'Fragment Mono', monospace" }}>Scroll</span>
          <div style={{ width: 1, height: 24, background: "linear-gradient(to bottom, rgba(255,255,255,0.2), transparent)" }} />
        </div>
      </section>

      {/* MARQUEE */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "16px 0", overflow: "hidden", whiteSpace: "nowrap" }}>
        <div className="marquee-track" style={{ fontSize: 12, fontFamily: "'Fragment Mono', monospace", color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {Array(2).fill(null).map((_, k) => (
            <div key={k} style={{ display: "flex", gap: 64, flexShrink: 0 }}>
              {["Document Generation", "Code Analysis", "Data Transform", "DevOps", "Research", "Creative", "Legal", "Medical", "Finance", "Security", "Testing", "API Design"].map(t => <span key={t+k}>{t}</span>)}
            </div>
          ))}
        </div>
      </div>

      {/* SKILLS */}
      <section style={{ padding: "80px 48px 120px", position: "relative" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 20 }}>Trending This Week</h2>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
              {["All", ...Array.from(new Set(allSkills.map(s => s.category_name).filter(Boolean)))].map(c => (
                <button key={c} className="cat-pill" onClick={() => setActiveCat(c)} style={{
                  padding: "6px 16px", borderRadius: 100, fontSize: 12, fontWeight: 500,
                  border: activeCat === c ? "1px solid rgba(255,255,255,0.3)" : "1px solid rgba(255,255,255,0.06)",
                  background: activeCat === c ? "rgba(255,255,255,0.06)" : "transparent",
                  color: activeCat === c ? "#fff" : "rgba(255,255,255,0.35)",
                }}>{c}</button>
              ))}
            </div>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 12,
          }}>
            {filtered.map((sk: SkillCatalogItem) => {
              const color = "#22d3ee";
              const needsAudit = sk.quality_tier === "needs_audit";
              return (
                <div key={sk.id} className="skill-card-grid"
                role="button"
                tabIndex={0}
                onClick={() => setActiveSkill(sk)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveSkill(sk);
                  }
                }}
                style={{
                  background: needsAudit ? "rgba(245,158,11,0.04)" : "rgba(255,255,255,0.02)",
                  border: needsAudit
                    ? "1px solid rgba(245,158,11,0.2)"
                    : "1px solid rgba(255,255,255,0.06)",
                  borderTop: needsAudit
                    ? "2px solid rgba(245,158,11,0.5)"
                    : `2px solid ${color}`,
                  borderRadius: 10,
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 160,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  opacity: needsAudit ? 0.7 : 1,
                }}
                onMouseEnter={(e) => {
                  if (needsAudit) return;
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)";
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                }}
                onMouseLeave={(e) => {
                  if (needsAudit) return;
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)";
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
                }}>
                  {/* top: name + license */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Erode', serif", letterSpacing: "-0.01em" }}>{sk.name}</span>
                      {needsAudit && (
                        <span style={{
                          fontSize: 9, fontFamily: "'Fragment Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase" as const,
                          padding: "2px 6px", borderRadius: 4,
                          background: "rgba(245,158,11,0.15)",
                          color: "#fcd34d",
                          whiteSpace: "nowrap",
                        }}>⚠ audit</span>
                      )}
                    </div>
                    <span style={{
                      fontSize: 11, fontFamily: "'Fragment Mono', monospace", fontWeight: 600,
                      padding: "3px 10px", borderRadius: 100,
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.3)",
                      flexShrink: 0, marginLeft: 8,
                    }}>{sk.github_license || "N/A"}</span>
                  </div>

                  {/* author */}
                  <div style={{ fontSize: 11, fontFamily: "'Fragment Mono', monospace", color: "rgba(255,255,255,0.2)", marginTop: 4 }}>
                    @{sk.author_username} · ★ {sk.github_stars || 0}
                  </div>

                  {/* description */}
                  <div style={{
                    fontSize: 13, fontFamily: "'Erode', serif", color: "rgba(255,255,255,0.35)", lineHeight: 1.5,
                    marginTop: 12, overflow: "hidden",
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
                  }}>{sk.description}</div>

                  <div style={{ flex: 1 }} />

                  {/* footer: stats + category + download */}
                  <div style={{
                    borderTop: "1px solid rgba(255,255,255,0.04)",
                    paddingTop: 12, marginTop: 16,
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                  }}>
                    <span style={{ fontSize: 11, fontFamily: "'Fragment Mono', monospace", color: "rgba(255,255,255,0.25)" }}>
                      ★ {sk.avg_rating || "—"} · ↓ {fmt(sk.download_count || 0)}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{
                        fontSize: 10, fontFamily: "'Fragment Mono', monospace", letterSpacing: "0.04em", textTransform: "uppercase" as const,
                        padding: "2px 8px", borderRadius: 4,
                        background: `${color}1F`,
                        color: color,
                      }}>{sk.category_name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (needsAudit) return;
                          handleDownload(e, sk.id, sk.name);
                        }}
                        disabled={downloadingId === sk.id || needsAudit}
                        style={{
                          background: needsAudit
                            ? "rgba(255,255,255,0.02)"
                            : downloadingId === sk.id ? "#fff" : "rgba(255,255,255,0.06)",
                          color: needsAudit
                            ? "rgba(255,255,255,0.25)"
                            : downloadingId === sk.id ? "#000" : "#fff",
                          border: "1px solid rgba(255,255,255,0.08)",
                          padding: "4px 10px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontFamily: "'Fragment Mono', monospace",
                          fontWeight: 600,
                          cursor: needsAudit || downloadingId === sk.id ? "not-allowed" : "pointer",
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          if (!needsAudit && downloadingId !== sk.id) {
                            (e.currentTarget as HTMLButtonElement).style.background = "#fff";
                            (e.currentTarget as HTMLButtonElement).style.color = "#000";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!needsAudit && downloadingId !== sk.id) {
                            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
                            (e.currentTarget as HTMLButtonElement).style.color = "#fff";
                          }
                        }}
                      >{needsAudit ? "audit" : downloadingId === sk.id ? "↓ Preparing…" : "↓ Get"}</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ textAlign: "center", marginTop: 48 }}>
            <button className="btn-ghost" onClick={() => navigate("/explore")} style={{ padding: "12px 36px", borderRadius: 8, fontSize: 13, letterSpacing: "0.04em" }}>Browse All Skills →</button>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding: "100px 48px", borderTop: "1px solid rgba(255,255,255,0.05)", position: "relative", zIndex: 1 }} className="grid-bg">
        <div style={{ maxWidth: 1000, margin: "0 auto", position: "relative", zIndex: 2 }}>
          <div style={{ marginBottom: 64, textAlign: "center" }}>
            <div style={{ fontSize: 11, fontFamily: "'Fragment Mono', monospace", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>Workflow</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
            {[
              { num: "01", title: "Install", desc: "One command. Instant power-up. Your Claude agent gains new capabilities in seconds — no config, no setup." },
              { num: "02", title: "Collaborate", desc: "Fork any skill. Ship improvements. Built-in version control, pull requests, and co-maintainer workflows." },
              { num: "03", title: "Publish", desc: "Share your skills with the community. Built-in validation, versioning, and a global marketplace with 12K+ engineers." },
            ].map(s => (
              <div key={s.num} style={{ position: "relative" }}>
                <div style={{ fontSize: 72, fontWeight: 700, color: "rgba(255,255,255,0.15)", lineHeight: 1, marginBottom: -20, fontFamily: "'Fragment Mono', monospace" }}>{s.num}</div>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, position: "relative", color: "#ffffff" }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: 1.8, fontWeight: 400 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "140px 48px", textAlign: "center", position: "relative" }}>
        <MorphBlob size={500} top="-20%" left="35%" opacity={0.04} />
        <div style={{ position: "relative", zIndex: 2 }}>
          <h2 style={{ fontSize: "clamp(36px, 6vw, 60px)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.05 }}>
            Ship your first skill<br /><span style={{ fontStyle: "italic", fontWeight: 400, color: "rgba(255,255,255,0.4)" }}>with / skiyu</span>
          </h2>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 44 }}>
            <button className="btn-primary" style={{ padding: "14px 40px", borderRadius: 8, fontSize: 14 }}>Start Building — Free</button>
            <button className="btn-ghost" style={{ padding: "14px 40px", borderRadius: 8, fontSize: 14 }}>Read the Docs</button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "32px 48px", display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 1000, margin: "0 auto" }}>
        <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "'Erode', serif", opacity: 0.25 }}>/ skiyu</span>
        <div style={{ display: "flex", gap: 28, fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
          {["Privacy", "Terms", "Status", "GitHub", "Discord"].map(l => (
            <span key={l} style={{ cursor: "pointer", transition: "color 0.3s" }} onMouseEnter={e => (e.target as HTMLSpanElement).style.color = "rgba(255,255,255,0.6)"} onMouseLeave={e => (e.target as HTMLSpanElement).style.color = "rgba(255,255,255,0.2)"}>{l}</span>
          ))}
        </div>
      </footer>

      <SkillModal skill={activeSkill} onClose={() => setActiveSkill(null)} />
    </div>
  );
}