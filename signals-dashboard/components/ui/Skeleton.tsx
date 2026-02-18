interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
}

export function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = "var(--radius-md)",
  className,
}: SkeletonProps) {
  return (
    <div
      className={`animate-pulse-subtle ${className ?? ""}`}
      style={{
        width,
        height,
        borderRadius,
        background: "var(--color-bg-active)",
      }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div
      style={{
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        background: "var(--color-bg-elevated)",
        padding: "var(--space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}
    >
      <Skeleton width={160} height={14} />
      <Skeleton width="100%" height={10} />
      <Skeleton width="80%" height={10} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-1)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: "var(--space-3)",
          padding: "var(--space-3) var(--space-4)",
        }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} width={80} height={10} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, ri) => (
        <div
          key={ri}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: "var(--space-3)",
            padding: "var(--space-3) var(--space-4)",
            borderTop: "1px solid var(--color-border-subtle)",
          }}
        >
          {Array.from({ length: cols }).map((_, ci) => (
            <Skeleton key={ci} width={ci === 0 ? "90%" : 60} height={12} />
          ))}
        </div>
      ))}
    </div>
  );
}
