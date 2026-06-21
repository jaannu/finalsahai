/**
 * IndianMotifs — lightweight inline SVG decorative components
 * All purely visual: aria-hidden, role="presentation", no interactivity.
 */

// ─────────────────────────────────────────────
// AshokaChakra
// 24-spoke wheel, faithful to the Dharma Chakra
// ─────────────────────────────────────────────
interface AshokaChakraProps {
  size?: number;
  color?: string;
  className?: string;
}

export function AshokaChakra({ size = 48, color = "#000080", className }: AshokaChakraProps) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 1; // outer ring radius
  const innerR = size * 0.08; // hub radius
  const strokeW = size * 0.035;

  // 24 spokes at 15° intervals
  const spokes = Array.from({ length: 24 }, (_, i) => {
    const angle = (i * 360) / 24;
    const rad = (angle * Math.PI) / 180;
    const x1 = +(cx + innerR * Math.cos(rad)).toFixed(4);
    const y1 = +(cy + innerR * Math.sin(rad)).toFixed(4);
    const x2 = +(cx + (outerR - strokeW / 2) * Math.cos(rad)).toFixed(4);
    const y2 = +(cy + (outerR - strokeW / 2) * Math.sin(rad)).toFixed(4);
    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      role="presentation"
      className={className}
    >
      <g stroke={color} strokeWidth={strokeW} fill="none">
        {/* Outer ring */}
        <circle cx={cx} cy={cy} r={outerR} />
        {/* Hub */}
        <circle cx={cx} cy={cy} r={innerR} fill={color} stroke="none" />
        {/* 24 spokes */}
        {spokes}
      </g>
    </svg>
  );
}

// ─────────────────────────────────────────────
// MandalaRing
// 8-petal geometric flower using CSS variable colors
// ─────────────────────────────────────────────
interface MandalaRingProps {
  size?: number;
  className?: string;
}

export function MandalaRing({ size = 64, className }: MandalaRingProps) {
  const cx = size / 2;
  const cy = size / 2;
  const petalR = size * 0.22; // petal oval height
  const orbitR = size * 0.22; // distance from center to petal midpoint

  // 8 petals rotated at 45° steps
  const petals = Array.from({ length: 8 }, (_, i) => {
    const angle = i * 45;
    return (
      <g key={i} transform={`rotate(${angle}, ${cx}, ${cy})`}>
        {/* Outer petal */}
        <ellipse
          cx={cx}
          cy={cy - orbitR}
          rx={petalR * 0.42}
          ry={petalR}
          fill="var(--terracotta, #c1440e)"
          fillOpacity="0.18"
          stroke="var(--terracotta, #c1440e)"
          strokeWidth={size * 0.022}
          strokeOpacity="0.55"
        />
        {/* Inner accent petal */}
        <ellipse
          cx={cx}
          cy={cy - orbitR * 0.52}
          rx={petalR * 0.22}
          ry={petalR * 0.48}
          fill="var(--marigold, #d4a017)"
          fillOpacity="0.35"
          stroke="none"
        />
      </g>
    );
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      role="presentation"
      className={className}
    >
      {/* Outer ring */}
      <circle
        cx={cx}
        cy={cy}
        r={size / 2 - size * 0.04}
        fill="none"
        stroke="var(--terracotta, #c1440e)"
        strokeWidth={size * 0.025}
        strokeOpacity="0.3"
      />
      {petals}
      {/* Center dot */}
      <circle cx={cx} cy={cy} r={size * 0.07} fill="var(--marigold, #d4a017)" fillOpacity="0.7" />
    </svg>
  );
}

// ─────────────────────────────────────────────
// LotusDivider
// 5 lotus buds as a full-width horizontal rule
// ─────────────────────────────────────────────
interface LotusDividerProps {
  className?: string;
}

export function LotusDivider({ className }: LotusDividerProps) {
  // A single lotus bud: two outer petals + one central petal + stem nub
  function LotusBud({ x, y }: { x: number; y: number }) {
    return (
      <g transform={`translate(${x}, ${y})`}>
        {/* Left petal */}
        <ellipse
          cx={-7}
          cy={-6}
          rx={5}
          ry={9}
          transform="rotate(-20, -7, -6)"
          fill="var(--terracotta, #c1440e)"
          fillOpacity="0.7"
        />
        {/* Right petal */}
        <ellipse
          cx={7}
          cy={-6}
          rx={5}
          ry={9}
          transform="rotate(20, 7, -6)"
          fill="var(--terracotta, #c1440e)"
          fillOpacity="0.7"
        />
        {/* Center petal */}
        <ellipse
          cx={0}
          cy={-8}
          rx={5}
          ry={10}
          fill="var(--terracotta, #c1440e)"
          fillOpacity="0.9"
        />
        {/* Sepal base */}
        <ellipse cx={0} cy={1} rx={9} ry={3} fill="var(--marigold, #d4a017)" fillOpacity="0.55" />
      </g>
    );
  }

  const buds = [60, 140, 220, 300, 380];

  return (
    <svg
      width="100%"
      height="28"
      viewBox="0 0 440 28"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      role="presentation"
      className={className}
    >
      {/* Hairline rule */}
      <line
        x1="0"
        y1="20"
        x2="440"
        y2="20"
        stroke="var(--terracotta, #c1440e)"
        strokeWidth="0.75"
        strokeOpacity="0.3"
      />
      {buds.map((bx) => (
        <LotusBud key={bx} x={bx} y={20} />
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────
// TricolorBar
// 4px-tall Indian flag tricolor accent bar
// with a tiny Ashoka Chakra on the white band
// ─────────────────────────────────────────────
interface TricolorBarProps {
  className?: string;
}

export function TricolorBar({ className }: TricolorBarProps) {
  const bandH = 8; // each band height → total 24px (≈4px visual at small sizes)
  const totalH = bandH * 3;
  const chakraSize = bandH * 0.9;

  return (
    <svg
      width="100%"
      height={totalH}
      viewBox={`0 0 1200 ${totalH}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      role="presentation"
      className={className}
    >
      {/* Saffron */}
      <rect x="0" y="0" width="1200" height={bandH} fill="#FF9933" />
      {/* White */}
      <rect x="0" y={bandH} width="1200" height={bandH} fill="#FFFFFF" />
      {/* Green */}
      <rect x="0" y={bandH * 2} width="1200" height={bandH} fill="#138808" />

      {/* Tiny Ashoka Chakra centered on white band */}
      {/* Rendered inline rather than nested component to keep SVG self-contained */}
      <g transform={`translate(${600 - chakraSize / 2}, ${bandH + (bandH - chakraSize) / 2})`}>
        <circle
          cx={chakraSize / 2}
          cy={chakraSize / 2}
          r={chakraSize / 2 - 0.4}
          fill="none"
          stroke="#000080"
          strokeWidth="0.7"
        />
        <circle cx={chakraSize / 2} cy={chakraSize / 2} r={chakraSize * 0.08} fill="#000080" />
        {Array.from({ length: 24 }, (_, i) => {
          const angle = (i * 360) / 24;
          const rad = (angle * Math.PI) / 180;
          const hub = chakraSize * 0.08;
          const rim = chakraSize / 2 - 1;
          return (
            <line
              key={i}
              x1={+(chakraSize / 2 + hub * Math.cos(rad)).toFixed(4)}
              y1={+(chakraSize / 2 + hub * Math.sin(rad)).toFixed(4)}
              x2={+(chakraSize / 2 + rim * Math.cos(rad)).toFixed(4)}
              y2={+(chakraSize / 2 + rim * Math.sin(rad)).toFixed(4)}
              stroke="#000080"
              strokeWidth="0.5"
            />
          );
        })}
      </g>
    </svg>
  );
}

// ─────────────────────────────────────────────
// PaisleyDivider
// Row of 3 paisley teardrop shapes
// ─────────────────────────────────────────────
interface PaisleyDividerProps {
  className?: string;
}

export function PaisleyDivider({ className }: PaisleyDividerProps) {
  // Each paisley: a teardrop made from a circle + a curved tail via cubic bezier
  function Paisley({ x, y, flip = false }: { x: number; y: number; flip?: boolean }) {
    const scale = flip ? -1 : 1;
    return (
      <g transform={`translate(${x}, ${y}) scale(${scale}, 1)`}>
        {/* Teardrop body */}
        <path
          d="M0,-18 C10,-18 18,-10 18,0 C18,12 10,20 0,22 C-10,20 -18,12 -18,0 C-18,-10 -10,-18 0,-18 Z"
          fill="var(--terracotta, #c1440e)"
          fillOpacity="0.15"
          stroke="var(--terracotta, #c1440e)"
          strokeWidth="1.2"
          strokeOpacity="0.6"
        />
        {/* Curved tail */}
        <path
          d="M0,22 C8,28 20,18 16,6"
          fill="none"
          stroke="var(--terracotta, #c1440e)"
          strokeWidth="1.2"
          strokeOpacity="0.6"
          strokeLinecap="round"
        />
        {/* Inner teardrop accent */}
        <path
          d="M0,-10 C5,-10 10,-5 10,0 C10,6 5,11 0,12 C-5,11 -10,6 -10,0 C-10,-5 -5,-10 0,-10 Z"
          fill="var(--marigold, #d4a017)"
          fillOpacity="0.3"
          stroke="none"
        />
        {/* Center dot */}
        <circle cx={0} cy={0} r={2.5} fill="var(--terracotta, #c1440e)" fillOpacity="0.5" />
      </g>
    );
  }

  return (
    <svg
      width="160"
      height="64"
      viewBox="0 0 160 64"
      aria-hidden="true"
      role="presentation"
      className={className}
    >
      <Paisley x={32} y={32} />
      <Paisley x={80} y={32} flip />
      <Paisley x={128} y={32} />
    </svg>
  );
}
