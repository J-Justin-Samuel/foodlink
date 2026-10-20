import { STATUS_META, statusForScore } from "@/lib/freshness";

interface Props {
  /** 0-100, or null when there is no reading yet. */
  score: number | null;
  /** Rendered width in px (height is half of it plus the label). */
  size?: number;
}

const CX = 100;
const CY = 100;
const R = 78;

/** Point on the dial for a score (0 = far left, 100 = far right, over the top). */
function polar(score: number, r = R): [number, number] {
  const angle = Math.PI * (1 - score / 100);
  return [CX + r * Math.cos(angle), CY - r * Math.sin(angle)];
}

function arc(from: number, to: number) {
  const [x1, y1] = polar(from);
  const [x2, y2] = polar(to);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/**
 * Semicircular freshness gauge. Three zones match the status bands
 * (red < 40, amber 40-69, green >= 70) and the needle eases to the score.
 */
export function FreshnessGauge({ score, size = 260 }: Props) {
  const hasScore = score !== null;
  const value = hasScore ? Math.min(100, Math.max(0, score)) : 0;
  const status = hasScore ? statusForScore(value) : null;
  const meta = status ? STATUS_META[status] : null;
  const label = hasScore
    ? `Freshness ${value} out of 100, ${meta!.label}`
    : "Freshness: waiting for a reading";

  return (
    <svg
      viewBox="0 0 200 124"
      width={size}
      height={size * 0.62}
      role="img"
      aria-label={label}
      className="max-w-full"
    >
      {/* zones */}
      <path
        d={arc(0, 39.5)}
        fill="none"
        stroke={STATUS_META.SPOILED.hex}
        strokeWidth={14}
        opacity={hasScore && status !== "SPOILED" ? 0.25 : 1}
      />
      <path
        d={arc(40.5, 69.5)}
        fill="none"
        stroke={STATUS_META.CONSUME_SOON.hex}
        strokeWidth={14}
        opacity={hasScore && status !== "CONSUME_SOON" ? 0.25 : 1}
      />
      <path
        d={arc(70.5, 100)}
        fill="none"
        stroke={STATUS_META.SAFE.hex}
        strokeWidth={14}
        opacity={hasScore && status !== "SAFE" ? 0.25 : 1}
      />

      {/* ticks at the band edges */}
      {[40, 70].map((t) => {
        const [x1, y1] = polar(t, R - 12);
        const [x2, y2] = polar(t, R + 12);
        return (
          <line
            key={t}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth={2}
          />
        );
      })}

      {/* needle: drawn pointing left (score 0), then rotated clockwise */}
      <g
        style={{
          transformOrigin: `${CX}px ${CY}px`,
          transform: `rotate(${(value / 100) * 180}deg)`,
          transition: "transform 450ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        <line
          x1={CX}
          y1={CY}
          x2={CX - (R - 20)}
          y2={CY}
          stroke="currentColor"
          strokeWidth={4}
          strokeLinecap="round"
        />
      </g>
      <circle cx={CX} cy={CY} r={7} fill="currentColor" />

      {/* readout */}
      <text
        x={CX}
        y={CY + 22}
        textAnchor="middle"
        fontSize={22}
        fontWeight={800}
        fill="currentColor"
      >
        {hasScore ? value : "—"}
      </text>
      <text
        x={CX}
        y={CY + 36}
        textAnchor="middle"
        fontSize={9}
        fontWeight={600}
        fill={meta?.hex ?? "currentColor"}
      >
        {meta ? meta.label : "No reading yet"}
      </text>
    </svg>
  );
}
