interface JsonBlockProps {
  data: unknown;
  label?: string;
}

export function JsonBlock({ data, label }: JsonBlockProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      {label && (
        <span
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 500,
            color: "var(--color-text-secondary)",
          }}
        >
          {label}
        </span>
      )}
      <pre
        style={{
          margin: 0,
          maxHeight: 320,
          overflow: "auto",
          padding: "var(--space-4)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-border-subtle)",
          background: "var(--color-bg-sunken)",
          fontSize: "var(--text-xs)",
          color: "var(--color-text-secondary)",
          fontFamily: "var(--font-mono), monospace",
          lineHeight: "var(--leading-relaxed)",
        }}
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
