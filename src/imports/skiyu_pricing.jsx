import { useState } from "react";

const M = "'IBM Plex Mono', monospace";
const S = "'Syne', sans-serif";

const PLANS = [
  {
    id: "daily",
    label: "Day Pass",
    price: 2.99,
    period: "/ day",
    credits: 50,
    desc: "Quick burst for a single skill build",
    features: ["50 creation credits", "Skill Studio access", "1 sandbox test run", "Community support"],
  },
  {
    id: "weekly",
    label: "Weekly",
    price: 9.99,
    period: "/ week",
    credits: 200,
    desc: "For active builders shipping every week",
    features: ["200 creation credits", "Skill Studio access", "10 sandbox test runs", "Priority validation queue", "Community support"],
  },
  {
    id: "monthly",
    label: "Monthly",
    price: 29.99,
    period: "/ month",
    credits: 1000,
    desc: "Most popular — serious creators ship here",
    features: ["1,000 creation credits", "Skill Studio access", "Unlimited sandbox testing", "Priority validation queue", "Analytics dashboard", "Email support"],
    accent: true,
    badge: "Most popular",
  },
  {
    id: "yearly",
    label: "Yearly",
    price: 249.99,
    period: "/ year",
    credits: 15000,
    desc: "Best value — 25% savings for committed builders",
    features: ["15,000 creation credits", "Skill Studio access", "Unlimited sandbox testing", "Priority validation queue", "Advanced analytics", "Priority support", "Early access to new features", "Publisher verified badge"],
    badge: "Best value",
  },
];

const CREDIT_COSTS = [
  { action: "Generate a SKILL.md with Skill Studio", cost: 10 },
  { action: "AI-assisted script generation", cost: 8 },
  { action: "Run test suite in sandbox", cost: 3 },
  { action: "Auto-evolve iteration (per cycle)", cost: 5 },
  { action: "Quality score check", cost: 2 },
  { action: "Package validation & publish", cost: 1 },
];

const FAQ = [
  { q: "What are creation credits?", a: "Credits are the currency for building skills on /skiyu. Each creation action — generating a SKILL.md, running tests, AI-assisted scripting — costs a set number of credits. You buy credits through a package that fits your pace." },
  { q: "Do consumers need credits?", a: "No. Browsing and searching the marketplace is free. When you buy a skill, you pay the price set by the creator — no platform surcharge on top. Credits are only for building and publishing skills using creation tools." },
  { q: "Can I publish skills without credits?", a: "Yes. If you write your SKILL.md and scripts manually (outside of Skill Studio), the final validation and publish step costs just 1 credit. You can also upload pre-built .skill packages for free." },
  { q: "Do unused credits roll over?", a: "Credits from weekly and monthly packages expire at the end of the billing period. Yearly package credits roll over for up to 3 months. Day Pass credits expire after 24 hours." },
  { q: "How do skill purchases work for buyers?", a: "Buyers pay once and own the skill permanently, including all future updates from the publisher. The purchase price is set by the skill creator. There are no recurring fees for buyers." },
  { q: "Do publishers pay a commission on sales?", a: "No. There is no take rate, no platform commission, and no listing fee. Publishers keep 100% of their skill revenue minus standard Stripe processing fees (~2.9% + $0.30 per transaction)." },
  { q: "Can I buy extra credits outside my plan?", a: "Yes. You can purchase credit top-ups at any time at $0.05 per credit. Top-up credits never expire." },
  { q: "What happens when I run out of credits?", a: "You can still browse, install skills, and manage your published skills. You just can't use creation tools (Skill Studio, sandbox testing, auto-evolve) until you top up or your next billing cycle starts." },
];

export default function Pricing() {
  const [showFaq, setShowFaq] = useState(null);
  const [hoveredPlan, setHoveredPlan] = useState(null);

  return (
    <div style={{ background: "#000", color: "#fff", minHeight: "100vh", fontFamily: S }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        ::selection{background:#fff;color:#000}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:#000}
        ::-webkit-scrollbar-thumb{background:#222;border-radius:2px}
        .nav-link{transition:color .2s;cursor:pointer}
        .nav-link:hover{color:#fff!important}
        .plan-card{transition:all .35s cubic-bezier(.16,1,.3,1);cursor:pointer;position:relative;overflow:hidden}
        .plan-card::after{content:'';position:absolute;bottom:0;left:0;width:0;height:1px;background:#fff;transition:width .4s cubic-bezier(.16,1,.3,1)}
        .plan-card:hover::after{width:100%}
        .plan-card:hover{transform:translateY(-3px);background:rgba(255,255,255,0.03)!important}
        .faq-item{cursor:pointer;transition:background .2s}
        .faq-item:hover{background:rgba(255,255,255,0.02)!important}
        .cta-w{transition:all .25s;cursor:pointer;font-family:'Syne',sans-serif}
        .cta-w:hover{background:#fff!important;color:#000!important}
        .cta-o{transition:all .25s;cursor:pointer;font-family:'Syne',sans-serif}
        .cta-o:hover{border-color:rgba(255,255,255,0.35)!important;background:rgba(255,255,255,0.04)!important}
      `}</style>

      {/* NAV */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100, height: 56, padding: "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="70" height="18" viewBox="0 0 70 18" style={{ display: "block" }}>
            <line x1="3" y1="16" x2="11" y2="2" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            <text x="16" y="15" fontFamily="'Syne', sans-serif" fontSize="15" fontWeight="700" fill="#fff" letterSpacing="-0.4">skiyu</text>
          </svg>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontFamily: M }}>/pricing</span>
        </div>
        <div style={{ display: "flex", gap: 20, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
          {["Explore", "Publish", "Docs", "Pricing"].map(l => (
            <span key={l} className="nav-link" style={{ color: l === "Pricing" ? "#fff" : undefined, fontWeight: l === "Pricing" ? 600 : 400 }}>{l}</span>
          ))}
        </div>
        <button className="cta-w" style={{
          background: "rgba(255,255,255,0.08)", color: "#fff", border: "none",
          padding: "7px 18px", borderRadius: 6, fontSize: 12, fontWeight: 700,
        }}>Get Started</button>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px" }}>

        {/* HERO */}
        <div style={{ textAlign: "center", padding: "72px 0 20px" }}>
          <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05 }}>
            Buy skills. Build skills.<br />Simple as that.
          </h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.35)", marginTop: 16, maxWidth: 520, margin: "16px auto 0", lineHeight: 1.7 }}>
            Explore thousands of skills for free. Buy the ones you need — one-time, no subscriptions. Creators choose a credit package to power the tools that build, test, and publish skills.
          </p>
        </div>

        {/* THREE ROLES */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1,
          background: "rgba(255,255,255,0.06)", borderRadius: 14, overflow: "hidden",
          margin: "48px 0",
        }}>
          {[
            { role: "Consumers", price: "Free to explore", desc: "Browse, search, and try free skills at no cost. Pay only for premium skills you choose — one-time, yours forever.", icon: "↓" },
            { role: "Publishers", price: "Free to list", desc: "List and sell skills with zero commission. Keep 100% of your revenue. No take rate.", icon: "↑" },
            { role: "Creators", price: "Credit packages", desc: "Use Skill Studio, AI tools, and sandboxes to build skills. Pay for what you use.", icon: "/" },
          ].map(r => (
            <div key={r.role} style={{ background: "#000", padding: "28px 24px" }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, color: "rgba(255,255,255,0.3)", marginBottom: 16, fontFamily: M,
              }}>{r.icon}</div>
              <div style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{r.role}</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{r.price}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>{r.desc}</div>
            </div>
          ))}
        </div>

        {/* CREATOR PACKAGES HEADING */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.2)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>
            Creator packages
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Pick your pace
          </h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", marginTop: 8 }}>
            Every package unlocks Skill Studio, sandbox testing, and AI-assisted building.
          </p>
        </div>

        {/* PLAN CARDS */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1,
          background: "rgba(255,255,255,0.06)", borderRadius: 14, overflow: "hidden",
          marginBottom: 48,
        }}>
          {PLANS.map((plan, i) => (
            <div key={plan.id} className="plan-card"
              onMouseEnter={() => setHoveredPlan(i)}
              onMouseLeave={() => setHoveredPlan(null)}
              style={{
                background: plan.accent ? "rgba(255,255,255,0.025)" : "#000",
                padding: "28px 20px",
                display: "flex", flexDirection: "column",
              }}>
              {plan.badge ? (
                <div style={{
                  fontSize: 10, fontFamily: M, fontWeight: 600,
                  padding: "3px 8px", borderRadius: 4, marginBottom: 12,
                  border: `1px solid ${plan.accent ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)"}`,
                  color: plan.accent ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.4)",
                  alignSelf: "flex-start", letterSpacing: "0.04em",
                }}>{plan.badge}</div>
              ) : <div style={{ height: 26, marginBottom: 12 }} />}

              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{plan.label}</div>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em" }}>${plan.price}</span>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.2)", fontFamily: M }}> {plan.period}</span>
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", lineHeight: 1.5, marginBottom: 20 }}>{plan.desc}</div>

              <div style={{
                padding: "10px 12px", borderRadius: 8, marginBottom: 16,
                background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)",
                textAlign: "center",
              }}>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{plan.credits.toLocaleString()}</div>
                <div style={{ fontSize: 10, fontFamily: M, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>credits</div>
              </div>

              <div style={{ flex: 1 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                    <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, marginTop: 1, flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>

              <button className={plan.accent ? "cta-w" : "cta-o"} style={{
                marginTop: 20, width: "100%", padding: "10px 0", borderRadius: 8,
                fontSize: 12, fontWeight: 700,
                background: plan.accent ? "#fff" : "transparent",
                color: plan.accent ? "#000" : "rgba(255,255,255,0.5)",
                border: plan.accent ? "none" : "1px solid rgba(255,255,255,0.08)",
              }}>Get started</button>
            </div>
          ))}
        </div>

        {/* CREDIT COSTS TABLE */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.2)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>
            What credits buy
          </div>
          <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 100px",
              padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)",
              fontSize: 10, fontFamily: M, color: "rgba(255,255,255,0.15)",
              letterSpacing: "0.08em", textTransform: "uppercase",
            }}>
              <span>Action</span>
              <span style={{ textAlign: "right" }}>Credits</span>
            </div>
            {CREDIT_COSTS.map((c, i) => (
              <div key={c.action} style={{
                display: "grid", gridTemplateColumns: "1fr 100px",
                padding: "12px 16px", alignItems: "center",
                borderBottom: i < CREDIT_COSTS.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
              }}>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{c.action}</span>
                <span style={{ fontSize: 14, fontFamily: M, fontWeight: 600, textAlign: "right" }}>{c.cost}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.15)", fontFamily: M }}>
            Need more? Top-up credits at $0.05 each — they never expire.
          </div>
        </div>

        {/* 0% COMMISSION CALLOUT */}
        <div style={{
          border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14,
          padding: "36px 32px", marginBottom: 48, textAlign: "center",
          background: "rgba(255,255,255,0.015)",
        }}>
          <div style={{ fontSize: 56, fontWeight: 800, marginBottom: 4, lineHeight: 1 }}>
            0<span style={{ fontSize: 28, color: "rgba(255,255,255,0.3)" }}>%</span>
          </div>
          <div style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.2)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>
            Commission on skill sales
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", maxWidth: 440, margin: "0 auto", lineHeight: 1.7 }}>
            Sell your skills and keep every dollar. No take rate, no listing fee, no revenue share. The only deduction is Stripe processing (~2.9% + $0.30).
          </div>
        </div>

        {/* ENTERPRISE */}
        <div style={{
          border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14,
          padding: "28px 32px", marginBottom: 48,
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Enterprise</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.7, maxWidth: 440 }}>
              Private skill catalogs, SSO, team credit pools, volume pricing, and dedicated support for organizations with 10+ creators.
            </div>
          </div>
          <button className="cta-o" style={{
            background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.12)",
            padding: "10px 24px", borderRadius: 8, fontSize: 13, fontWeight: 600, flexShrink: 0,
          }}>Contact Sales</button>
        </div>

        {/* FAQ */}
        <div style={{ marginBottom: 72 }}>
          <div style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.2)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 20 }}>
            Frequently asked questions
          </div>
          {FAQ.map((f, i) => (
            <div key={i} className="faq-item" onClick={() => setShowFaq(showFaq === i ? null : i)}
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", padding: "14px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: showFaq === i ? "#fff" : "rgba(255,255,255,0.5)" }}>{f.q}</span>
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.12)", fontFamily: M, flexShrink: 0, marginLeft: 16 }}>
                  {showFaq === i ? "−" : "+"}
                </span>
              </div>
              {showFaq === i && (
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.7, marginTop: 10, paddingRight: 40 }}>{f.a}</div>
              )}
            </div>
          ))}
        </div>

        {/* BOTTOM CTA */}
        <div style={{ textAlign: "center", paddingBottom: 72 }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 10 }}>Start building for free</h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.25)", marginBottom: 24 }}>Explore the marketplace for free. Pay only for skills and creation tools you choose.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button className="cta-w" style={{ background: "#fff", color: "#000", border: "none", padding: "12px 32px", borderRadius: 8, fontSize: 14, fontWeight: 700 }}>Create Account</button>
            <button className="cta-o" style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", padding: "12px 32px", borderRadius: 8, fontSize: 14, fontWeight: 600 }}>Explore Skills</button>
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", padding: "24px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <svg width="50" height="14" viewBox="0 0 50 14" style={{ opacity: 0.12 }}>
            <line x1="2" y1="12" x2="8" y2="2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
            <text x="12" y="12" fontFamily="'Syne', sans-serif" fontSize="11" fontWeight="600" fill="#fff" letterSpacing="-0.2">skiyu</text>
          </svg>
          <div style={{ display: "flex", gap: 20, fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.1)" }}>
            {["Privacy", "Terms", "Status", "GitHub"].map(l => <span key={l} style={{ cursor: "pointer" }}>{l}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}
