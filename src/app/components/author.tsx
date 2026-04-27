import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import NavAuth from "./nav-auth";
import { preloadRoute } from "../routes";
import { supabase } from "@/lib/supabase";

const F = "'Erode', 'Cormorant Garamond', Georgia, serif";
const M = "'Fragment Mono', 'JetBrains Mono', Menlo, monospace";

/**
 * /author — placeholder for the workbench. The workbench itself is the
 * next major build; this page exists so the home page's CTAs have a real
 * destination instead of 404ing. Honest about state, collects email
 * signups so we have a notify-me list when the real surface ships.
 */
export default function Author() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // ?skill=<slug> — populated when the user clicked "Run skill" on a card.
  // Today the page is a placeholder, so we don't actually load the skill;
  // we just acknowledge it in the banner so the click feels intentional,
  // and we tag the email signup with the slug so we know which skills
  // people are most asking to run.
  const skillSlug = (searchParams.get("skill") ?? "").trim() || null;
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Enter a valid email.");
      return;
    }
    setStatus("saving");
    setError(null);

    const { error: insertError } = await supabase
      .from("workbench_signups")
      .insert({
        email: email.trim().toLowerCase(),
        // Tag the source with the requested slug when present so we can
        // sort the notify-me list by which skills were clicked from.
        source: skillSlug ? `run:${skillSlug}` : "author_page",
      });

    if (insertError) {
      // Duplicate email is fine — silently treat as success.
      if (insertError.code === "23505") {
        setStatus("saved");
        return;
      }
      setStatus("error");
      setError("Couldn't save. Try again in a moment.");
      return;
    }
    setStatus("saved");
  }

  return (
    <div
      style={{
        background: "#000",
        color: "#fff",
        minHeight: "100vh",
        fontFamily: F,
      }}
    >
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          height: 56,
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(0, 0, 0, 0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate("/");
            }}
            style={{
              color: "#fff",
              textDecoration: "none",
              fontSize: 17,
              fontWeight: 700,
              fontFamily: F,
              fontStyle: "italic",
              letterSpacing: "-0.5px",
            }}
          >
            / skiyu
          </a>
          <span
            style={{
              fontSize: 12,
              color: "rgba(255, 255, 255, 0.40)",
              fontFamily: M,
            }}
          >
            /author
          </span>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          {[
            { label: "Explore", path: "/explore" as const },
            { label: "Publish", path: "/publish" as const },
            { label: "Docs", path: "/docs" as const },
          ].map((l) => (
            <span
              key={l.label}
              role="link"
              tabIndex={0}
              onClick={() => navigate(l.path)}
              onMouseEnter={() => preloadRoute[l.path]?.()}
              onFocus={() => preloadRoute[l.path]?.()}
              style={{
                fontFamily: F,
                fontStyle: "italic",
                fontSize: 13,
                fontWeight: 400,
                color: "rgba(255, 255, 255, 0.40)",
                cursor: "pointer",
              }}
            >
              {l.label}
            </span>
          ))}
        </div>
        <NavAuth />
      </nav>

      <main
        id="main-content"
        style={{
          maxWidth: 700,
          margin: "0 auto",
          padding: "120px 32px 80px",
        }}
      >
        {skillSlug ? (
          <div
            style={{
              padding: "14px 18px",
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 8,
              marginBottom: 32,
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontFamily: M,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(255, 255, 255, 0.40)",
              }}
            >
              run requested
            </span>
            <span
              style={{
                fontFamily: F,
                fontStyle: "italic",
                fontSize: 14,
                color: "rgba(255, 255, 255, 0.80)",
              }}
            >
              {skillSlug}
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontFamily: M,
                fontSize: 11,
                color: "rgba(255, 255, 255, 0.40)",
              }}
            >
              <a
                href={`/skills/${skillSlug}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/skills/${skillSlug}`);
                }}
                style={{
                  color: "#fff",
                  textDecoration: "none",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.10)",
                }}
              >
                view skill →
              </a>
            </span>
          </div>
        ) : null}

        <div
          style={{
            fontFamily: M,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "rgba(255, 255, 255, 0.25)",
          }}
        >
          // the workbench — in progress
        </div>

        <h1
          style={{
            fontFamily: F,
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: "clamp(40px, 6vw, 64px)",
            letterSpacing: "-0.04em",
            lineHeight: 1.0,
            margin: "20px 0 0",
          }}
        >
          {skillSlug ? (
            <>
              <span style={{ color: "#fff" }}>The workbench will</span>{" "}
              <span style={{ color: "rgba(255, 255, 255, 0.40)" }}>
                run this here.
              </span>
            </>
          ) : (
            <>
              <span style={{ color: "#fff" }}>Where skills</span>{" "}
              <span style={{ color: "rgba(255, 255, 255, 0.40)" }}>
                get engineered.
              </span>
            </>
          )}
        </h1>

        <p
          style={{
            marginTop: 28,
            fontFamily: F,
            fontStyle: "italic",
            fontSize: 17,
            lineHeight: 1.6,
            color: "rgba(255, 255, 255, 0.60)",
            maxWidth: 560,
          }}
        >
          {skillSlug
            ? `Once the workbench is live, clicking "Run skill" will load ${skillSlug}'s SKILL.md, accept your input, and stream the output here — usually inside a minute. We're building that loop now.`
            : `The workbench is where you'll draft, refine, and publish skills with skiyu's authoring assistant alongside. Catch marketing language before the lint does. Test against real prompts. Ship to the catalog when the work is ready.`}
        </p>

        <p
          style={{
            marginTop: 16,
            fontFamily: F,
            fontStyle: "italic",
            fontSize: 17,
            lineHeight: 1.6,
            color: "rgba(255, 255, 255, 0.60)",
            maxWidth: 560,
          }}
        >
          {skillSlug
            ? "Drop your email and we'll let you know when this skill is runnable here."
            : "We're building it now. Drop your email and we'll tell you when it's ready."}
        </p>

        <form
          onSubmit={handleSubmit}
          style={{
            marginTop: 36,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "stretch",
            maxWidth: 520,
          }}
        >
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === "saving" || status === "saved"}
            aria-label="Email address"
            style={{
              flex: "1 1 240px",
              minWidth: 0,
              padding: "12px 16px",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.10)",
              borderRadius: 6,
              color: "#fff",
              fontFamily: M,
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={status === "saving" || status === "saved"}
            style={{
              padding: "12px 24px",
              background: status === "saved" ? "rgba(74, 222, 128, 0.12)" : "#fff",
              color: status === "saved" ? "#4ade80" : "#000",
              border:
                status === "saved"
                  ? "1px solid rgba(74, 222, 128, 0.30)"
                  : "1px solid rgba(255, 255, 255, 0.10)",
              borderRadius: 6,
              fontFamily: M,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.04em",
              cursor: status === "saving" || status === "saved" ? "default" : "pointer",
              transition: "background 150ms cubic-bezier(0.2, 0.8, 0.3, 1)",
            }}
          >
            {status === "saved"
              ? "✓ We'll be in touch"
              : status === "saving"
                ? "Saving…"
                : "Notify me"}
          </button>
        </form>

        {error && (
          <div
            style={{
              marginTop: 12,
              fontFamily: M,
              fontSize: 12,
              color: "#fca5a5",
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            marginTop: 60,
            paddingTop: 32,
            borderTop: "1px solid rgba(255, 255, 255, 0.06)",
            fontFamily: F,
            fontStyle: "italic",
            fontSize: 14,
            color: "rgba(255, 255, 255, 0.40)",
          }}
        >
          In the meantime —{" "}
          <a
            href="/explore"
            onClick={(e) => {
              e.preventDefault();
              navigate("/explore");
            }}
            onMouseEnter={() => preloadRoute["/explore"]?.()}
            style={{
              color: "#fff",
              textDecoration: "none",
              borderBottom: "1px solid rgba(255, 255, 255, 0.10)",
            }}
          >
            browse what others have shipped
          </a>
          , or{" "}
          <a
            href="/publish"
            onClick={(e) => {
              e.preventDefault();
              navigate("/publish");
            }}
            onMouseEnter={() => preloadRoute["/publish"]?.()}
            style={{
              color: "#fff",
              textDecoration: "none",
              borderBottom: "1px solid rgba(255, 255, 255, 0.10)",
            }}
          >
            submit a skill from a GitHub repo
          </a>
          .
        </div>
      </main>
    </div>
  );
}
