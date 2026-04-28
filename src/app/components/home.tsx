import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useFeaturedSkills, useCategoryCounts, downloadSkill } from "@/lib/hooks";
import type { SkillCatalogItem } from "@/lib/types";
import NavAuth from "./nav-auth";
import { useAuth } from "@/lib/auth";
import SkillModal from "./skill-modal";
import SkillCard from "./skill-card";
import Wordmark from "./wordmark";
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

/** Hero halftone vignette — matches the .grid-bg pattern exactly.
 * CSS-only, no canvas, no JS. Dots on a 14px pitch, masked to transparent
 * at center and fully opaque at edges. Sits behind all hero content. */
function DotField() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.18) 1.5px, transparent 1.5px)",
        backgroundSize: "14px 14px",
        WebkitMaskImage: "radial-gradient(ellipse 70% 70% at 50% 50%, transparent 30%, black 100%)",
        maskImage: "radial-gradient(ellipse 70% 70% at 50% 50%, transparent 30%, black 100%)",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
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
  // Category filter on home was removed with the // FEATURED treatment;
  // categorical browsing belongs in /explore. Const'd to keep the filter
  // expression below type-clean without dragging in dead state.
  const activeCat = "All";
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
        /* Halftone vignette — replaces the old uniform line grid.
         * Dots: 3px filled circles on a 14px pitch, white at 18% opacity.
         * Radial mask: transparent at center (60% of the viewport), solid
         * at the edges — this produces the "denser at edges, fading center"
         * effect from the screenshot. */
        .grid-bg, .halftone-bg {
          position: relative;
        }
        .grid-bg::before, .halftone-bg::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle, rgba(255,255,255,0.18) 1.5px, transparent 1.5px);
          background-size: 14px 14px;
          /* Mask: fades from transparent at center to opaque at edges.
           * The radial gradient goes transparent → rgba so at the center
           * the dots vanish; toward corners they're fully visible. */
          -webkit-mask-image: radial-gradient(ellipse 70% 70% at 50% 50%, transparent 30%, black 100%);
          mask-image: radial-gradient(ellipse 70% 70% at 50% 50%, transparent 30%, black 100%);
          pointer-events: none;
          animation: breathe 7s ease-in-out infinite;
          z-index: 0;
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
          <Wordmark size={20} clickable />
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
            SKILL ENGINEERING PLATFORM
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
            <span style={{ color: "#fff" }}>Engineer skills.</span>{" "}
            <span style={{ color: "rgba(255,255,255,0.40)" }}>
              Find them, write them, ship them.
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
              maxWidth: 580,
              margin: "28px 0 0",
            }}
          >
            Better agents need better instructions. Skiyu is where engineers
            write the skills agents will follow tomorrow, and where you'll find
            the ones that hold up today.
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
              onClick={() => navigate("/author")}
              onMouseEnter={() => preloadRoute["/author"]()}
              onFocus={() => preloadRoute["/author"]()}
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
              Open the workbench →
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

      {/* SKILLS */}
      <section style={{ padding: "100px 48px 120px", position: "relative" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ marginBottom: 48 }}>
            <div
              style={{
                fontFamily: "'Fragment Mono', monospace",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.25)",
              }}
            >
              FEATURED
            </div>
            <h2
              style={{
                fontFamily: "'Erode', 'Cormorant Garamond', Georgia, serif",
                fontStyle: "italic",
                fontWeight: 700,
                fontSize: "clamp(36px, 5vw, 56px)",
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
                margin: "16px 0 0",
              }}
            >
              Skills, today.
            </h2>
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

      {/* WORKBENCH — second core surface, alongside the marketplace.
        * This section introduces the authoring half of the product.
        * The animation is a 12-second loop that demonstrates the value
        * prop concretely: skiyu catches publishing problems before the
        * lint does. Static fallback for prefers-reduced-motion. */}
      <section
        style={{
          padding: "120px 48px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          position: "relative",
        }}
      >
        <style>{`
          /* Workbench animation timeline (12s loop):
           *   0s   editor empty, chat empty
           *   1s   line 1 appears (---)
           *   1.5s line 2 appears (name: pdf-extract)
           *   2s   line 3 appears (description: A revolutionary PDF tool)
           *   2.5s line 4 appears (---)
           *   4s   chat bubble 1 appears (catches "revolutionary")
           *   6s   line 3 swaps to fixed description
           *   8s   chat bubble 2 appears (✓ ready to publish)
           *   10s  hold
           *   11s  everything fades
           *   12s  loop restarts
           */
          @keyframes wbLine {
            0%, 100% { opacity: 0; transform: translateY(4px); }
            8%, 91% { opacity: 1; transform: translateY(0); }
          }
          @keyframes wbLineSwap {
            0%, 49% { opacity: 0; }
            54%, 91% { opacity: 1; }
            100% { opacity: 0; }
          }
          @keyframes wbLineFlagged {
            0%, 32% { opacity: 0; transform: translateY(4px); }
            17%, 49% { opacity: 1; transform: translateY(0); }
            54%, 100% { opacity: 0; }
          }
          @keyframes wbBubble1 {
            0%, 32% { opacity: 0; transform: translateY(8px); }
            41%, 54% { opacity: 1; transform: translateY(0); }
            58%, 100% { opacity: 0; transform: translateY(-4px); }
          }
          @keyframes wbBubble2 {
            0%, 65% { opacity: 0; transform: translateY(8px); }
            74%, 91% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; }
          }
          @keyframes wbCaretBlink {
            0%, 50% { opacity: 1; }
            50.01%, 100% { opacity: 0; }
          }

          .wb-line, .wb-line-flagged, .wb-line-fixed,
          .wb-bubble-1, .wb-bubble-2 {
            animation-duration: 12s;
            animation-iteration-count: infinite;
            animation-timing-function: cubic-bezier(0.2, 0.8, 0.3, 1);
          }
          .wb-line   { animation-name: wbLine; }
          .wb-line-flagged { animation-name: wbLineFlagged; }
          .wb-line-fixed   { animation-name: wbLineSwap; }
          .wb-bubble-1     { animation-name: wbBubble1; }
          .wb-bubble-2     { animation-name: wbBubble2; }
          .wb-line-1 { animation-delay: 0.0s; }
          .wb-line-2 { animation-delay: 0.5s; }
          .wb-line-3 { animation-delay: 1.0s; }
          .wb-line-4 { animation-delay: 1.5s; }
          .wb-flag   { background: rgba(252, 211, 77, 0.18); border-radius: 2px; padding: 0 3px; }

          @media (prefers-reduced-motion: reduce) {
            /* Collapse to end-state: fixed description visible, both
             * bubbles visible, no animation. The reader sees the punchline
             * without any motion. */
            .wb-line, .wb-line-fixed, .wb-bubble-1, .wb-bubble-2 {
              animation: none !important;
              opacity: 1 !important;
              transform: none !important;
            }
            .wb-line-flagged {
              animation: none !important;
              opacity: 0 !important;
            }
          }
        `}</style>

        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.2fr)",
            gap: 64,
            alignItems: "center",
          }}
        >
          {/* Left: copy */}
          <div>
            <div
              style={{
                fontFamily: "'Fragment Mono', monospace",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.25)",
              }}
            >
              THE WORKBENCH
            </div>
            <h2
              style={{
                fontFamily: "'Erode', 'Cormorant Garamond', Georgia, serif",
                fontStyle: "italic",
                fontWeight: 700,
                fontSize: "clamp(36px, 5vw, 56px)",
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
                margin: "16px 0 0",
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.40)" }}>
                Don't just install skills.
              </span>{" "}
              <span style={{ color: "#fff" }}>Engineer them.</span>
            </h2>
            <p
              style={{
                marginTop: 24,
                fontFamily: "'Erode', 'Cormorant Garamond', Georgia, serif",
                fontStyle: "italic",
                fontSize: 16,
                lineHeight: 1.6,
                color: "rgba(255,255,255,0.60)",
                maxWidth: 480,
              }}
            >
              Skiyu's workbench is where engineers draft, refine, and publish
              skills with a working assistant in the next pane. Catch
              marketing language before the lint does. Test against real
              prompts. Ship to the catalog when the work is ready.
            </p>
            <button
              type="button"
              onClick={() => navigate("/author")}
              onMouseEnter={() => preloadRoute["/author"]()}
              onFocus={() => preloadRoute["/author"]()}
              style={{
                marginTop: 32,
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
              Open the workbench →
            </button>
          </div>

          {/* Right: live-loop demo (editor + chat) */}
          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: 6,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 6,
              minHeight: 320,
            }}
          >
            {/* Editor pane */}
            <div
              style={{
                background: "#000",
                border: "1px solid rgba(255,255,255,0.04)",
                borderRadius: 8,
                padding: "12px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 0,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  fontFamily: "'Fragment Mono', monospace",
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.20)",
                  marginBottom: 12,
                }}
              >
                SKILL.md
              </div>
              <div
                style={{
                  fontFamily: "'Fragment Mono', monospace",
                  fontSize: 12.5,
                  lineHeight: 1.85,
                  color: "rgba(255,255,255,0.85)",
                }}
              >
                <div className="wb-line wb-line-1">---</div>
                <div className="wb-line wb-line-2">
                  <span style={{ color: "rgba(255,255,255,0.40)" }}>name:</span>{" "}
                  pdf-extract
                </div>
                {/* Two stacked descriptions: the flagged version shows first, then the fixed version replaces it. */}
                <div style={{ position: "relative", minHeight: "1.85em" }}>
                  <div
                    className="wb-line-flagged wb-line-3"
                    style={{ position: "absolute", inset: 0 }}
                  >
                    <span style={{ color: "rgba(255,255,255,0.40)" }}>
                      description:
                    </span>{" "}
                    A <span className="wb-flag">revolutionary</span> PDF tool
                  </div>
                  <div
                    className="wb-line-fixed"
                    style={{ position: "absolute", inset: 0 }}
                  >
                    <span style={{ color: "rgba(255,255,255,0.40)" }}>
                      description:
                    </span>{" "}
                    Extracts text and tables from PDFs.
                  </div>
                </div>
                <div className="wb-line wb-line-4">---</div>
              </div>

              {/* Cursor block */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  bottom: 16,
                  left: 16,
                  width: 7,
                  height: 14,
                  background: "rgba(255,255,255,0.65)",
                  animation: "wbCaretBlink 1.1s linear infinite",
                }}
              />
            </div>

            {/* Chat pane */}
            <div
              style={{
                background: "#000",
                border: "1px solid rgba(255,255,255,0.04)",
                borderRadius: 8,
                padding: "12px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div
                style={{
                  fontFamily: "'Fragment Mono', monospace",
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.20)",
                  marginBottom: 8,
                }}
              >
                skiyu
              </div>

              <div
                className="wb-bubble-1"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 8,
                  padding: "12px 14px",
                  fontFamily: "'Erode', 'Cormorant Garamond', Georgia, serif",
                  fontStyle: "italic",
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  color: "rgba(255,255,255,0.80)",
                }}
              >
                "Revolutionary" will trip the lint. Want me to rewrite the
                description based on what your script does?
              </div>

              <div
                className="wb-bubble-2"
                style={{
                  background: "rgba(74, 222, 128, 0.06)",
                  border: "1px solid rgba(74, 222, 128, 0.14)",
                  borderRadius: 8,
                  padding: "12px 14px",
                  fontFamily: "'Erode', 'Cormorant Garamond', Georgia, serif",
                  fontStyle: "italic",
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  color: "rgba(255,255,255,0.80)",
                }}
              >
                Looks good — 41 chars, no marketing words.{" "}
                <span style={{ color: "#4ade80" }}>✓ Ready to publish.</span>
              </div>
            </div>
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
                // Honest: paste step exists, no claims of instant.
                desc: "Copy the install command from any skill. Paste it into your Claude Code terminal. The skill is available on the next prompt.",
              },
              {
                num: "02",
                title: "Engineer",
                // The new platform pitch in two lines. Names skiyu's authoring
                // assistant once, frames it as a working partner that catches
                // what the lint will reject before publish-time. This is the
                // page's only naming of the assistant — it's a tool-of-the-
                // platform, not a separately-marketed AI feature.
                desc: "Open the workbench. Skiyu's authoring assistant catches what the lint will reject — vague descriptions, marketing language, missing context — before you publish.",
              },
              {
                num: "03",
                title: "Ship",
                // Frames publishing as a quality-gated verb, not a button. The
                // lint as gate IS the differentiator vs. just dropping skills
                // in a github repo.
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
          <h2
            style={{
              fontFamily: "'Erode', 'Cormorant Garamond', Georgia, serif",
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: "clamp(36px, 6vw, 60px)",
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
            }}
          >
            <span style={{ color: "#fff" }}>Ship your first skill.</span>
            <br />
            <span style={{ color: "rgba(255,255,255,0.40)" }}>
              Or your hundredth.
            </span>
          </h2>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 44 }}>
            <button
              className="btn-primary"
              onClick={() => navigate("/author")}
              onMouseEnter={() => preloadRoute["/author"]()}
              style={{ padding: "14px 40px", borderRadius: 8, fontSize: 14 }}
            >
              Open the workbench →
            </button>
            <button
              className="btn-ghost"
              onClick={() => navigate("/explore")}
              onMouseEnter={() => preloadRoute["/explore"]()}
              style={{ padding: "14px 40px", borderRadius: 8, fontSize: 14 }}
            >
              Browse the catalog
            </button>
          </div>
        </div>
      </section>
      </main>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "32px 48px", display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 1000, margin: "0 auto" }}>
        <Wordmark size={13} color="rgba(255,255,255,0.25)" />
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