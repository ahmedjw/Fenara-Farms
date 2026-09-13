/**
 * Extra virgin seal.
 *
 * Drawn in SVG from the brand palette, so it stays sharp at any size and needs
 * no image request. Replace it with the bottle label artwork once that exists.
 */

// A serrated rim, like a pressed seal: points alternate between two radii.
const rim = (() => {
  const teeth = 48;
  let d = "";
  for (let i = 0; i < teeth * 2; i++) {
    const angle = (i / (teeth * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? 99 : 93;
    d += `${i === 0 ? "M" : "L"}${(100 + r * Math.cos(angle)).toFixed(2)} ${(100 + r * Math.sin(angle)).toFixed(2)}`;
  }
  return `${d}Z`;
})();

const mono = "var(--font-geist-mono), ui-monospace, monospace";

export function EvooSeal({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      role="img"
      aria-label="Extra virgin olive oil, cold extracted in Andalusia"
      className={className}
    >
      <defs>
        {/* Top text runs clockwise over the top; bottom text runs the other way so it reads upright. */}
        <path id="evoo-top" d="M 34 100 A 66 66 0 0 1 166 100" />
        <path id="evoo-bottom" d="M 26 100 A 74 74 0 0 0 174 100" />
      </defs>

      <path d={rim} fill="var(--color-paper)" />
      <circle cx="100" cy="100" r="86" fill="var(--color-olive)" />
      <circle
        cx="100"
        cy="100"
        r="80"
        fill="none"
        stroke="var(--color-olive-soft)"
        strokeOpacity="0.5"
        strokeWidth="0.8"
      />

      <text fill="var(--color-paper)" fontFamily={mono} fontSize="12.5" letterSpacing="3.4">
        <textPath href="#evoo-top" startOffset="50%" textAnchor="middle">
          EXTRA VIRGIN
        </textPath>
      </text>
      <text fill="var(--color-olive-soft)" fontFamily={mono} fontSize="9.5" letterSpacing="2.2">
        <textPath href="#evoo-bottom" startOffset="50%" textAnchor="middle">
          COLD EXTRACTED · ANDALUSIA
        </textPath>
      </text>

      <text
        x="100"
        y="112"
        textAnchor="middle"
        fill="var(--color-paper)"
        fontFamily="var(--font-display)"
        fontStyle="italic"
        fontSize="46"
        letterSpacing="-1"
      >
        EVOO
      </text>
      <text
        x="100"
        y="132"
        textAnchor="middle"
        fill="var(--color-olive-soft)"
        fontFamily={mono}
        fontSize="8.5"
        letterSpacing="3"
      >
        OLIVE OIL
      </text>
    </svg>
  );
}
