import { ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "accent";

const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
  default: {
    background: "var(--color-bg-sunken)",
    color: "var(--color-text-secondary)",
    border: "1px solid var(--color-border)",
  },
  success: {
    background: "var(--color-success-bg)",
    color: "var(--color-success-text)",
    border: "1px solid var(--color-success-border)",
  },
  warning: {
    background: "var(--color-warning-bg)",
    color: "var(--color-warning-text)",
    border: "1px solid var(--color-warning-border)",
  },
  error: {
    background: "var(--color-error-bg)",
    color: "var(--color-error-text)",
    border: "1px solid var(--color-error-border)",
  },
  info: {
    background: "var(--color-info-bg)",
    color: "var(--color-info-text)",
    border: "1px solid var(--color-info-border)",
  },
  accent: {
    background: "var(--color-accent-subtle)",
    color: "var(--color-accent-text)",
    border: "1px solid var(--color-accent-muted)",
  },
};

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
}

export function Badge({ children, variant = "default", size = "sm" }: BadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "var(--radius-full)",
        fontWeight: 600,
        whiteSpace: "nowrap",
        ...(size === "sm"
          ? { padding: "1px 8px", fontSize: "var(--text-xs)" }
          : { padding: "2px 10px", fontSize: "var(--text-sm)" }),
        ...variantStyles[variant],
      }}
    >
      {children}
    </span>
  );
}
