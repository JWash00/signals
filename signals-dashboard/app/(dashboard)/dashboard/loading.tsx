import { Skeleton, SkeletonCard, SkeletonTable } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      {/* Title */}
      <div>
        <Skeleton width={220} height={28} />
        <div style={{ marginTop: "var(--space-1)" }}>
          <Skeleton width={280} height={14} />
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-4)" }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              padding: "var(--space-5)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border)",
              background: "var(--color-bg-elevated)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
            }}
          >
            <Skeleton width={100} height={12} />
            <Skeleton width={60} height={32} />
            <Skeleton width={80} height={10} />
          </div>
        ))}
      </div>

      {/* ScoreCard placeholder */}
      <Skeleton width="100%" height={72} borderRadius="var(--radius-lg)" />

      {/* Distribution cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--space-4)" }}>
        <SkeletonCard />
        <SkeletonCard />
      </div>

      {/* AI Usage + Alerts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--space-4)" }}>
        <SkeletonCard />
        <SkeletonCard />
      </div>

      {/* Table */}
      <div
        style={{
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          background: "var(--color-bg-elevated)",
          boxShadow: "var(--shadow-xs)",
        }}
      >
        <div
          style={{
            padding: "var(--space-4) var(--space-5)",
            borderBottom: "1px solid var(--color-border-subtle)",
          }}
        >
          <Skeleton width={180} height={16} />
        </div>
        <SkeletonTable rows={8} cols={5} />
      </div>
    </div>
  );
}
