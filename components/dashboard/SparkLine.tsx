"use client";

interface SparkLineProps {
  data: number[];
  color?: string;
  height?: number;
}

export function SparkLine({ data, color = "#DC3C3C", height = 36 }: SparkLineProps) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 80;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });

  const polyline = points.join(" ");
  const lastX = parseFloat(points[points.length - 1].split(",")[0]);
  const lastY = parseFloat(points[points.length - 1].split(",")[1]);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
      {/* Area fill */}
      <defs>
        <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${polyline} ${width},${height}`}
        fill={`url(#sg-${color.replace("#", "")})`}
      />
      {/* Line */}
      <polyline
        points={polyline}
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Last point dot */}
      <circle cx={lastX} cy={lastY} r="2" fill={color} />
    </svg>
  );
}
