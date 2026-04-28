import { useNavigate } from "react-router";

/** Sans-serif wordmark "skiyu" — the new brand mark.
 *
 * Lowercase, Geist Sans Bold (700), tight tracking, no slash, no italic,
 * no cursor block. Replaces the prior `/ skiyu` italic-serif wordmark
 * across the app.
 *
 * Use the standalone `<Wordmark/>` everywhere a brand mark needs to render.
 * The clickable variant routes to `/`.
 */
export const WORDMARK_FONT =
  "'Geist', 'Geist Sans', 'Inter', system-ui, -apple-system, sans-serif";

interface WordmarkProps {
  /** Font size in px. Defaults to nav size (18px). */
  size?: number;
  /** When true, renders as an anchor that routes to "/". */
  clickable?: boolean;
  /** When set, the wordmark sits as plain text at this color. Default #fff. */
  color?: string;
}

export default function Wordmark({
  size = 18,
  clickable = false,
  color = "#fff",
}: WordmarkProps) {
  const navigate = useNavigate();
  const text = "skiyu";
  const baseStyle: React.CSSProperties = {
    fontFamily: WORDMARK_FONT,
    fontWeight: 700,
    fontSize: size,
    // Tight tracking for the lowercase mark — matches the screenshot
    // optical density. Negative letter-spacing keeps the letters
    // hugging each other without crashing into one another.
    letterSpacing: "-0.02em",
    color,
    textTransform: "lowercase",
    lineHeight: 1,
    display: "inline-block",
  };

  if (!clickable) {
    return <span style={baseStyle}>{text}</span>;
  }
  return (
    <a
      href="/"
      onClick={(e) => {
        e.preventDefault();
        navigate("/");
      }}
      style={{
        ...baseStyle,
        textDecoration: "none",
        cursor: "pointer",
      }}
    >
      {text}
    </a>
  );
}
