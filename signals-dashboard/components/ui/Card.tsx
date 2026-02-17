import { ReactNode } from "react";

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  padding?: boolean;
}

export function Card({ title, children, className = "", action, padding = true }: CardProps) {
  return (
    <div
      className={`animate-fade-in ${className}`}
      style={{
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        background: "var(--color-bg-elevated)",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      {(title || action) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--space-4) var(--space-5)",
            borderBottom: "1px solid var(--color-border-subtle)",
          }}
        >
          {title && (
            <h3
              style={{
                fontSize: "var(--text-base)",
                fontWeight: 600,
                color: "var(--color-text-primary)",
                margin: 0,
              }}
            >
              {title}
            </h3>
          )}
          {action && <div>{action}</div>}
        </div>
      )}
      {padding ? (
        <div style={{ padding: "var(--space-5)" }}>{children}</div>
      ) : (
        children
      )}
    </div>
  );
}
