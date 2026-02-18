"use client";

interface Tab {
  value: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  value: string;
  onChange: (value: string) => void;
}

export function Tabs({ tabs, value, onChange }: TabsProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: "var(--space-1)",
        borderBottom: "1px solid var(--color-border)",
        marginBottom: "var(--space-5)",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.value === value;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            style={{
              padding: "var(--space-2) var(--space-4)",
              fontSize: "var(--text-sm)",
              fontWeight: isActive ? 600 : 500,
              color: isActive ? "var(--color-accent)" : "var(--color-text-secondary)",
              background: "transparent",
              border: "none",
              borderBottom: isActive
                ? "2px solid var(--color-accent)"
                : "2px solid transparent",
              cursor: "pointer",
              transition: "all var(--duration-fast) var(--ease-default)",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              marginBottom: -1,
            }}
          >
            {tab.label}
            {tab.count != null && (
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  padding: "0 6px",
                  borderRadius: "var(--radius-full)",
                  background: isActive
                    ? "var(--color-accent-subtle)"
                    : "var(--color-bg-sunken)",
                  color: isActive
                    ? "var(--color-accent)"
                    : "var(--color-text-tertiary)",
                  fontWeight: 600,
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
