import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useFeaturedSkills, useCategoryCounts, downloadSkill } from "@/lib/hooks";
import type { SkillCatalogItem } from "@/lib/types";
import NavAuth from "./nav-auth";
import { useAuth } from "@/lib/auth";
import SkillModal from "./skill-modal";
import SkillCard from "./skill-card";
import { preloadRoute } from "../routes";

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
  const { counts: catalogCounts, total: catalogTotal } = useCategoryCounts();

  // Hero stats — derived, not hard-coded.
  // Skills: full catalog count from useCategoryCounts (loaded once, cached).
  //   Falls back to the featured slice while loading.
  // Publishers: unique authors visible across the featured skills. Imperfect
  //   but cheap; a dedicated count would need another query, and the hero
  //   stat is glanced at, not audited.
  // Categories: count of category buckets the catalog spans.
  const skillsCount = catalogTotal || allSkills.length;
  const publisherCount = new Set(
    allSkills.map((s) => s.author_username).filter(Boolean),
  ).size;
  const categoryCount = Object.keys(catalogCounts).filter(
    (k) => k !== "uncategorized",
  ).length;

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
            { label: "Explore", path: "/explore" as const },
            { label: "Publish", path: "/publish" as const },
            { label: "Docs", path: "/docs" as const },
          ].map(l => (
            <span
              key={l.label}
              className="nav-item"
              onClick={() => navigate(l.path)}
              onMouseEnter={() => preloadRoute[l.path]?.()}
              onFocus={() => preloadRoute[l.path]?.()}
            >{l.label}</span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <NavAuth />
        </div>
      </nav>

      <main id="main-content">
      {/* HERO — typography-only landing per design-system handoff
        * skiyu-discovery-install.html. Pure type on the dot-grid backdrop
        * with a radial vignette to focus the eye. No graphics, no mock
        * terminals, no runtime references — skiyu is a curated marketplace,
        * not an observability platform. */}
      <section
        style={{
          position: "relative",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          padding: "120px 48px 80px",
        }}
      >
        <DotField />
        {/* Radial vignette darkens edges, focuses center column */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 80% 60% at 50% 40%, transparent, rgba(0,0,0,0.7))",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
        <div
          style={{
            position: "relative",
            zIndex: 2,
            maxWidth: 1100,
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div
            className="e1"
            style={{
              fontFamily: "'Fragment Mono', monospace",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.25)",
            }}
          >
            // skill engineering platform
          </div>
          <h1
            className="e2"
            style={{
              fontFamily: "'Erode', 'Cormorant Garamond', Georgia, serif",
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: "clamp(48px, 8vw, 88px)",
              letterSpacing: "-0.04em",
              lineHeight: 0.95,
              margin: "24px 0 0",
              maxWidth: 1100,
            }}
          >
            <span style={{ color: "#fff" }}>Skills, written well.</span>{" "}
            <span style={{ color: "rgba(255,255,255,0.40)" }}>
              Found, forked, or shipped from scratch.
            </span>
          </h1>
          <p
            className="e3"
            style={{
              fontFamily: "'Erode', 'Cormorant Garamond', Georgia, serif",
              fontStyle: "italic",
              fontSize: 17,
              lineHeight: 1.55,
              color: "rgba(255,255,255,0.60)",
              maxWidth: 560,
              margin: "28px 0 0",
            }}
          >
            Skiyu is where people who care about their craft publish skills
            others can use. Every skill comes with an author, a license, and
            a one-line install. Browse what's there, or write your own.
          </p>
          <div
            className="e4"
            style={{ display: "flex", gap: 12, marginTop: 36, flexWrap: "wrap" }}
          >
            <button
              type="button"
              onClick={() => navigate("/explore")}
              onMouseEnter={() => preloadRoute["/explore"]()}
              onFocus={() => preloadRoute["/explore"]()}
              style={{
                padding: "14px 28px",
                background: "#fff",
                color: "#000",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 6,
                fontFamily: "'Fragment Mono', monospace",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.04em",
                cursor: "pointer",
              }}
            >
              Browse skills
            </button>
            <button
              type="button"
              onClick={() => navigate("/publish")}
              onMouseEnter={() => preloadRoute["/publish"]()}
              onFocus={() => preloadRoute["/publish"]()}
              style={{
                padding: "14px 28px",
                background: "rgba(255,255,255,0.04)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 6,
                fontFamily: "'Fragment Mono', monospace",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.04em",
                cursor: "pointer",
              }}
            >
              Start writing
            </button>
          </div>
          <div
            className="e5"
            style={{
              marginTop: 24,
              fontFamily: "'Fragment Mono', monospace",
              fontStyle: "italic",
              fontSize: 13,
              color: "rgba(255,255,255,0.40)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {skillsCount.toLocaleString()} skills · {publisherCount} publishers · {categoryCount} categories
          </div>
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
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}>
            {filtered.map((sk: SkillCatalogItem) => (
              <SkillCard
                key={sk.id}
                skill={sk}
                onOpen={setActiveSkill}
                preferModal
                userId={user?.id}
              />
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 48 }}>
            <button className="btn-ghost" onClick={() => navigate("/explore")} onMouseEnter={() => preloadRoute["/explore"]()} onFocus={() => preloadRoute["/explore"]()} style={{ padding: "12px 36px", borderRadius: 8, fontSize: 13, letterSpacing: "0.04em" }}>Browse All Skills →</button>
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
              {
                num: "01",
                title: "Install",
                // Honest version: there's a paste step. We don't pretend it's instant.
                desc: "Copy the install command from any skill. Paste it into your Claude Code terminal. The skill is available on the next prompt.",
              },
              {
                num: "02",
                title: "Inspect",
                // Replaces the fictional "Collaborate" panel. Forking, version control,
                // and PRs aren't built. Reading the source is — every skill links to its
                // GitHub repo, and the source is the documentation.
                desc: "Every skill is open source. The card links straight to the repo. Read what the skill does before you install it — the source is the documentation.",
              },
              {
                num: "03",
                title: "Publish",
                // Describes the real review pipeline (skills_staged + admin Review Queue).
                // Drops the "12K+ engineers" claim — actual count is 24 attributed authors,
                // mostly from scrapes, not signups.
                desc: "Submit your skill from a GitHub repo. Skiyu lints it against a public quality bar — frontmatter, license, description rigor — and reviews before it lands in the catalog.",
              },
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
            <button
              className="btn-primary"
              onClick={() => navigate("/publish")}
              onMouseEnter={() => preloadRoute["/publish"]()}
              style={{ padding: "14px 40px", borderRadius: 8, fontSize: 14 }}
            >
              Publish a skill
            </button>
            <button
              className="btn-ghost"
              onClick={() => navigate("/docs")}
              onMouseEnter={() => preloadRoute["/docs"]()}
              style={{ padding: "14px 40px", borderRadius: 8, fontSize: 14 }}
            >
              Read the docs
            </button>
          </div>
        </div>
      </section>
      </main>

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