import { useState, useEffect, useRef } from "react";

const SKILLS = [
  { name: "PDF Architect", author: "synthwave_dev", installs: "12.4K", rating: 4.9, price: "Free", cat: "Documents" },
  { name: "Code Reviewer Pro", author: "neural_ops", installs: "8.7K", rating: 4.8, price: "$4.99", cat: "Code" },
  { name: "Data Pipeline Gen", author: "flowstate", installs: "6.2K", rating: 4.7, price: "$9.99", cat: "Data" },
  { name: "API Doc Writer", author: "restful_ai", installs: "15.1K", rating: 4.9, price: "Free", cat: "Docs" },
  { name: "SQL Optimizer", author: "query_mind", installs: "4.8K", rating: 4.6, price: "$7.99", cat: "Data" },
  { name: "React Scaffolder", author: "component_lab", installs: "9.3K", rating: 4.8, price: "Free", cat: "Code" },
];

const STATS = [
  { label: "Skills Published", val: 12847, suf: "+" },
  { label: "Engineers Active", val: 48200, suf: "+" },
  { label: "Daily Installs", val: 34500, suf: "" },
  { label: "Revenue Shared", val: 2.4, suf: "M", pre: "$" },
];

function Counter({ target, suffix = "", prefix = "" }) {
  const [n, setN] = useState(0);
  const [vis, setVis] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => e.isIntersecting && setVis(true), { threshold: 0.3 });
    ref.current && o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  useEffect(() => {
    if (!vis) return;
    let cur = 0; const steps = 50, inc = target / steps;
    const t = setInterval(() => { cur += inc; cur >= target ? (setN(target), clearInterval(t)) : setN(Math.floor(cur)); }, 30);
    return () => clearInterval(t);
  }, [vis, target]);
  return <span ref={ref}>{prefix}{target < 100 ? n.toFixed(1) : n.toLocaleString()}{suffix}</span>;
}

function NoiseOverlay() {
  const c = useRef(null);
  useEffect(() => {
    const cv = c.current; if (!cv) return;
    cv.width = 256; cv.height = 256;
    const ctx = cv.getContext("2d");
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
  return <canvas ref={c} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 9999, opacity: 0.4, mixBlendMode: "overlay" }} />;
}

function DotField() {
  const c = useRef(null);
  const mouse = useRef({ x: -1000, y: -1000 });
  useEffect(() => {
    const cv = c.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    let id;
    const resize = () => { cv.width = cv.offsetWidth * 2; cv.height = cv.offsetHeight * 2; };
    resize();
    window.addEventListener("resize", resize);
    const onMove = (e) => {
      const r = cv.getBoundingClientRect();
      mouse.current = { x: (e.clientX - r.left) * 2, y: (e.clientY - r.top) * 2 };
    };
    cv.parentElement.addEventListener("mousemove", onMove);
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
    return () => { cancelAnimationFrame(id); window.removeEventListener("resize", resize); cv.parentElement.removeEventListener("mousemove", onMove); };
  }, []);
  return <canvas ref={c} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />;
}

function MorphBlob({ size = 400, top, left, opacity = 0.04 }) {
  const ref = useRef(null);
  useEffect(() => {
    let frame = 0, id;
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

export default function App() {
  const [activeCat, setActiveCat] = useState("All");
  const [query, setQuery] = useState("");
  const [scrollY, setScrollY] = useState(0);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    const fn = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const filtered = SKILLS.filter(s =>
    (activeCat === "All" || s.cat === activeCat) &&
    (!query || s.name.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div style={{ background: "#000", color: "#fff", minHeight: "100vh", fontFamily: "'Instrument Sans', sans-serif", overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700&family=Fragment+Mono&display=swap" rel="stylesheet" />
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
        .e1 { animation: fadeSlideUp 1s cubic-bezier(0.16,1,0.3,1) 0.1s both; }
        .e2 { animation: fadeSlideUp 1s cubic-bezier(0.16,1,0.3,1) 0.3s both; }
        .e3 { animation: fadeSlideUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.55s both; }
        .e4 { animation: fadeSlideUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.75s both; }
        .e5 { animation: fadeSlideUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.95s both; }
        .grid-bg {
          background-image: linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 80px 80px; animation: breathe 5s ease-in-out infinite;
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
          <svg width="80" height="22" viewBox="0 0 80 22" style={{ display: "block" }}>
            <line x1="4" y1="19" x2="13" y2="3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
            <text x="19" y="18" fontFamily="'Syne', sans-serif" fontSize="17" fontWeight="700" fill="#fff" letterSpacing="-0.5">skiyu</text>
          </svg>
        </div>
        <div style={{ display: "flex", gap: 36, fontSize: 13 }}>
          {["Explore", "Publish", "Docs", "Pricing"].map(l => <span key={l} className="nav-item">{l}</span>)}
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className="nav-item" style={{ fontSize: 13 }}>Sign in</span>
          <button className="btn-primary" style={{ padding: "7px 18px", borderRadius: 6, fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase" }}>Get Started</button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "140px 24px 100px" }}>
        <DotField />
        <MorphBlob size={600} top="-5%" left="-10%" opacity={0.05} />
        <MorphBlob size={450} top="40%" left="65%" opacity={0.035} />
        <div style={{ position: "relative", zIndex: 2, maxWidth: 800 }}>
          <div className="e1" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 28, fontFamily: "'Fragment Mono', monospace" }}>
            The Marketplace for Claude Skills
          </div>
          <h1 className="e2" style={{ fontSize: "clamp(48px, 8vw, 96px)", fontWeight: 700, lineHeight: 0.95, letterSpacing: "-0.04em" }}>
            Build<span style={{ color: "rgba(255,255,255,0.15)" }}>.</span> Share<span style={{ color: "rgba(255,255,255,0.15)" }}>.</span>
            <br /><span style={{ fontStyle: "italic", fontWeight: 400 }}>Monetize</span><span style={{ color: "rgba(255,255,255,0.15)" }}>.</span>
          </h1>
          <div className="e3" style={{ width: 60, height: 1, background: "rgba(255,255,255,0.3)", margin: "32px auto", animation: "expandLine 1s cubic-bezier(0.16,1,0.3,1) 0.6s both", transformOrigin: "center" }} />
          <p className="e3" style={{ fontSize: 17, color: "rgba(255,255,255,0.4)", lineHeight: 1.7, maxWidth: 480, margin: "0 auto", fontWeight: 400 }}>
            The open marketplace where AI engineers discover, fork, and sell Claude skills that power the next generation of workflows. Welcome to Skiyu.
          </p>
          <div className="e4" style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 44 }}>
            <button className="btn-primary" style={{ padding: "14px 36px", borderRadius: 8, fontSize: 14 }}>Explore Skills</button>
            <button className="btn-ghost" style={{ padding: "14px 36px", borderRadius: 8, fontSize: 14 }}>Publish Yours</button>
          </div>
          <div className="e5" style={{ marginTop: 48, maxWidth: 520, margin: "48px auto 0", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "4px 6px 4px 18px", transition: "border-color 0.3s" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input type="text" placeholder="Search 12,847 skills..." value={query} onChange={e => setQuery(e.target.value)} style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 14, padding: "12px 12px", fontFamily: "inherit" }} />
              <button className="btn-primary" style={{ padding: "9px 18px", borderRadius: 7, fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase" }}>Search</button>
            </div>
          </div>
          <div className="e5" style={{ marginTop: 28, maxWidth: 440, margin: "28px auto 0", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "14px 18px", textAlign: "left", fontFamily: "'Fragment Mono', monospace", fontSize: 12.5, background: "rgba(255,255,255,0.02)" }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {[0.15, 0.1, 0.1].map((o, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: 4, background: `rgba(255,255,255,${o})` }} />)}
            </div>
            <div><span style={{ color: "rgba(255,255,255,0.3)" }}>$</span> <span style={{ color: "rgba(255,255,255,0.6)" }}>skiyu install</span> <span style={{ color: "rgba(255,255,255,0.9)" }}>@synthwave/pdf-architect</span></div>
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
        <div className="marquee-track" style={{ fontSize: 12, fontFamily: "'Fragment Mono', monospace", color: "rgba(255,255,255,0.12)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {Array(2).fill(null).map((_, k) => (
            <div key={k} style={{ display: "flex", gap: 64, flexShrink: 0 }}>
              {["Document Generation", "Code Analysis", "Data Transform", "DevOps", "Research", "Creative", "Legal", "Medical", "Finance", "Security", "Testing", "API Design"].map(t => <span key={t+k}>{t}</span>)}
            </div>
          ))}
        </div>
      </div>

      {/* STATS */}
      <section style={{ padding: "100px 48px" }} className="grid-bg">
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: "rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden" }}>
          {STATS.map(s => (
            <div key={s.label} style={{ textAlign: "center", padding: "40px 16px", background: "#000" }}>
              <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.04em" }}>
                <Counter target={s.val} suffix={s.suf} prefix={s.pre || ""} />
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 10, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: "'Fragment Mono', monospace" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SKILLS */}
      <section style={{ padding: "80px 48px 120px", position: "relative" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 48 }}>
            <div>
              <div style={{ fontSize: 11, fontFamily: "'Fragment Mono', monospace", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>Curated</div>
              <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em" }}>Trending This Week</h2>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {["All", "Documents", "Code", "Data"].map(c => (
                <button key={c} className="cat-pill" onClick={() => setActiveCat(c)} style={{
                  padding: "6px 16px", borderRadius: 100, fontSize: 12, fontWeight: 500,
                  border: activeCat === c ? "1px solid rgba(255,255,255,0.3)" : "1px solid rgba(255,255,255,0.06)",
                  background: activeCat === c ? "rgba(255,255,255,0.06)" : "transparent",
                  color: activeCat === c ? "#fff" : "rgba(255,255,255,0.35)",
                }}>{c}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: "rgba(255,255,255,0.04)", borderRadius: 16, overflow: "hidden" }}>
            {filtered.map((sk, i) => (
              <div key={sk.name} className="skill-card" onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} style={{ padding: 28, background: hovered === i ? "rgba(255,255,255,0.03)" : "#000", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.03)" }}>{sk.name[0]}</div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontFamily: "'Fragment Mono', monospace" }}>{sk.price}</span>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 4 }}>{sk.name}</h3>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontFamily: "'Fragment Mono', monospace" }}>@{sk.author}</div>
                <div style={{ display: "flex", gap: 16, marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.05)", fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "'Fragment Mono', monospace" }}>
                  <span>★ {sk.rating}</span><span>↓ {sk.installs}</span>
                  <span style={{ marginLeft: "auto", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 10 }}>{sk.cat}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 48 }}>
            <button className="btn-ghost" style={{ padding: "12px 36px", borderRadius: 8, fontSize: 13, letterSpacing: "0.04em" }}>Browse All Skills →</button>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding: "100px 48px", borderTop: "1px solid rgba(255,255,255,0.05)" }} className="grid-bg">
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ marginBottom: 64 }}>
            <div style={{ fontSize: 11, fontFamily: "'Fragment Mono', monospace", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>Workflow</div>
            <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em" }}>Three Modes, One Platform</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
            {[
              { num: "01", title: "Install", desc: "Browse, search, one-click install. Your Claude gains new capabilities in seconds. Pin versions or track latest." },
              { num: "02", title: "Collaborate", desc: "Fork any skill. Edit in the web IDE. Submit a pull request. Built-in diff viewer, issue tracking, co-maintainers." },
              { num: "03", title: "Monetize", desc: "Set your price. Publish globally. 85% revenue share. Stripe payouts. Enterprise licensing built in." },
            ].map(s => (
              <div key={s.num} style={{ position: "relative" }}>
                <div style={{ fontSize: 72, fontWeight: 700, color: "rgba(255,255,255,0.03)", lineHeight: 1, marginBottom: -20, fontFamily: "'Fragment Mono', monospace" }}>{s.num}</div>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, position: "relative" }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", lineHeight: 1.8, fontWeight: 400 }}>{s.desc}</p>
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
            Ship your first skill<br /><span style={{ fontStyle: "italic", fontWeight: 400, color: "rgba(255,255,255,0.4)" }}>in minutes, not months.</span>
          </h2>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 44 }}>
            <button className="btn-primary" style={{ padding: "14px 40px", borderRadius: 8, fontSize: 14 }}>Start Building — Free</button>
            <button className="btn-ghost" style={{ padding: "14px 40px", borderRadius: 8, fontSize: 14 }}>Read the Docs</button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "32px 48px", display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 1000, margin: "0 auto" }}>
        <svg width="60" height="16" viewBox="0 0 60 16" style={{ display: "block", opacity: 0.25 }}>
          <line x1="3" y1="14" x2="9" y2="2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
          <text x="14" y="13" fontFamily="'Syne', sans-serif" fontSize="12" fontWeight="600" fill="#fff" letterSpacing="-0.3">skiyu</text>
        </svg>
        <div style={{ display: "flex", gap: 28, fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
          {["Privacy", "Terms", "Status", "GitHub", "Discord"].map(l => (
            <span key={l} style={{ cursor: "pointer", transition: "color 0.3s" }} onMouseEnter={e => e.target.style.color = "rgba(255,255,255,0.6)"} onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.2)"}>{l}</span>
          ))}
        </div>
      </footer>
    </div>
  );
}
