import type { Verdict } from "@/lib/pmf/types";

const verdictStyles: Record<Verdict, React.CSSProperties> = {
  BUILD: {
    background: "var(--color-success-bg)",
    color: "var(--color-success-text)",
    border: "1px solid var(--color-success-border)",
  },
  INVEST: {
    background: "var(--color-info-bg)",
    color: "var(--color-info-text)",
    border: "1px solid var(--color-info-border)",
  },
  MONITOR: {
    background: "var(--color-warning-bg)",
    color: "var(--color-warning-text)",
    border: "1px solid var(--color-warning-border)",
  },
  PASS: {
    background: "var(--color-bg-sunken)",
    color: "var(--color-text-secondary)",
    border: "1px solid var(--color-border)",
  },
};

interface ScoreCardProps {
  score: number;
  verdict: Verdict;
  confidence: number;
}

export function ScoreCard({ score, verdict, confidence }: ScoreCardProps) {
  const pct = (confidence * 100).toFixed(0);

  return (
    <div
      className="animate-fade-in"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-6)",
        padding: "var(--space-5)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        background: "var(--color-bg-elevated)",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      {/* Score */}
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: "var(--text-3xl)",
            fontWeight: 700,
            color: "var(--color-text-primary)",
            lineHeight: "var(--leading-tight)",
          }}
        >
          {score.toFixed(1)}
        </div>
        <div
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--color-text-tertiary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontWeight: 600,
          }}
        >
          Score
        </div>
      </div>

      {/* Verdict */}
      <div
        style={{
          padding: "var(--space-2) var(--space-4)",
          borderRadius: "var(--radius-md)",
          fontSize: "var(--text-sm)",
          fontWeight: 700,
          ...verdictStyles[verdict],
        }}
      >
        {verdict}
      </div>

      {/* Confidence */}
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: "var(--text-xl)",
            fontWeight: 600,
            color: "var(--color-text-secondary)",
          }}
        >
          {pct}%
        </div>
        <div
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--color-text-tertiary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontWeight: 600,
          }}
        >
          Confidence
        </div>
      </div>

      {/* Confidence bar */}
      <div style={{ flex: 1, maxWidth: 120 }}>
        <div
          style={{
            height: 6,
            borderRadius: "var(--radius-full)",
            background: "var(--color-bg-active)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              borderRadius: "var(--radius-full)",
              background: "var(--color-accent)",
              transition: "width var(--duration-slow) var(--ease-default)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
