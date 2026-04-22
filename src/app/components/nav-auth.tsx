import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";

const M = "'Fragment Mono', monospace";
const F = "'Erode', serif";

export default function NavAuth() {
  const { user, profile, loading, signInWithGitHub, signOut, claimableSkills } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (loading) {
    return <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.04)" }} />;
  }

  if (!user) {
    return (
      <button
        onClick={signInWithGitHub}
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#fff",
          padding: "7px 16px",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          fontFamily: F,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          transition: "all 0.2s",
        }}
        onMouseEnter={e => {
          (e.target as HTMLElement).style.background = "rgba(255,255,255,0.1)";
          (e.target as HTMLElement).style.borderColor = "rgba(255,255,255,0.2)";
        }}
        onMouseLeave={e => {
          (e.target as HTMLElement).style.background = "rgba(255,255,255,0.06)";
          (e.target as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)";
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
        Sign in
      </button>
    );
  }

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "4px 8px",
          borderRadius: 8,
          transition: "background 0.2s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt=""
            style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }}
          />
        ) : (
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)",
          }}>
            {(profile?.display_name || "U")[0].toUpperCase()}
          </div>
        )}
        {claimableSkills.length > 0 && (
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "#22d3ee",
            position: "absolute", top: 4, right: 4,
          }} />
        )}
      </button>

      {showMenu && (
        <div style={{
          position: "absolute", top: "100%", right: 0, marginTop: 8,
          width: 260, background: "#0a0a0a",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12, overflow: "hidden",
          zIndex: 200,
          boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
        }}>
          {/* User info */}
          <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 14, fontWeight: 600, fontFamily: F }}>{profile?.display_name || "User"}</div>
            <div style={{ fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
              @{profile?.github_username}
            </div>
            {profile?.is_verified && (
              <span style={{
                fontSize: 10, fontFamily: M, padding: "2px 6px", borderRadius: 4, marginTop: 6, display: "inline-block",
                background: "rgba(34,211,238,0.1)", color: "#22d3ee",
              }}>Verified publisher</span>
            )}
          </div>

          {/* Claimable skills notification */}
          {claimableSkills.length > 0 && (
            <div style={{
              padding: "12px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(34,211,238,0.03)",
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#22d3ee", marginBottom: 4 }}>
                {claimableSkills.length} skill{claimableSkills.length > 1 ? "s" : ""} to claim
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>
                We found skills on GitHub matching your username. Claim them to manage pricing, analytics, and updates.
              </div>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                {claimableSkills.slice(0, 3).map(s => (
                  <div key={s.id} style={{
                    fontSize: 11, fontFamily: M, color: "rgba(255,255,255,0.5)",
                    padding: "4px 0", display: "flex", justifyContent: "space-between",
                  }}>
                    <span>{s.name}</span>
                    <span style={{ color: "rgba(255,255,255,0.2)" }}>↓ {s.install_count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Menu items */}
          <div style={{ padding: 6 }}>
            {[
              { label: "Dashboard", href: "/publish" },
              { label: "My skills", href: "/publish" },
              ...(profile?.is_admin ? [{ label: "Review queue", href: "/admin/staged" }] : []),
              { label: "Settings", href: "#" },
            ].map(item => (
              <a
                key={item.label}
                href={item.href}
                style={{
                  display: "block", padding: "8px 12px", borderRadius: 6,
                  fontSize: 13, color: "rgba(255,255,255,0.6)",
                  textDecoration: "none", cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => {
                  (e.target as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                  (e.target as HTMLElement).style.color = "#fff";
                }}
                onMouseLeave={e => {
                  (e.target as HTMLElement).style.background = "transparent";
                  (e.target as HTMLElement).style.color = "rgba(255,255,255,0.6)";
                }}
              >{item.label}</a>
            ))}
          </div>

          {/* Sign out */}
          <div style={{ padding: "0 6px 6px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <button
              onClick={() => { signOut(); setShowMenu(false); }}
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 6,
                fontSize: 13, color: "rgba(255,255,255,0.35)", background: "transparent",
                border: "none", textAlign: "left", cursor: "pointer", fontFamily: F,
                transition: "all 0.15s",
              }}
              onMouseEnter={e => {
                (e.target as HTMLElement).style.background = "rgba(255,100,100,0.06)";
                (e.target as HTMLElement).style.color = "rgba(255,150,150,0.8)";
              }}
              onMouseLeave={e => {
                (e.target as HTMLElement).style.background = "transparent";
                (e.target as HTMLElement).style.color = "rgba(255,255,255,0.35)";
              }}
            >Sign out</button>
          </div>
        </div>
      )}
    </div>
  );
}
