"use client";

import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: {
    background: "var(--color-accent)",
    color: "var(--color-text-inverted)",
    border: "1px solid var(--color-accent)",
  },
  secondary: {
    background: "var(--color-bg-elevated)",
    color: "var(--color-text-primary)",
    border: "1px solid var(--color-border)",
  },
  danger: {
    background: "var(--color-error)",
    color: "var(--color-text-inverted)",
    border: "1px solid var(--color-error)",
  },
  ghost: {
    background: "transparent",
    color: "var(--color-text-secondary)",
    border: "1px solid transparent",
  },
};

const hoverBg: Record<Variant, string> = {
  primary: "var(--color-accent-hover)",
  secondary: "var(--color-bg-hover)",
  danger: "#b91c1c",
  ghost: "var(--color-bg-hover)",
};

const sizeStyles: Record<Size, React.CSSProperties> = {
  sm: { padding: "var(--space-1) var(--space-3)", fontSize: "var(--text-xs)" },
  md: { padding: "var(--space-2) var(--space-4)", fontSize: "var(--text-sm)" },
  lg: { padding: "var(--space-3) var(--space-5)", fontSize: "var(--text-base)" },
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  style,
  className,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-2)",
        borderRadius: "var(--radius-md)",
        fontWeight: 600,
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.5 : 1,
        transition: "all var(--duration-fast) var(--ease-default)",
        whiteSpace: "nowrap" as const,
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      onMouseOver={(e) => {
        if (isDisabled) return;
        e.currentTarget.style.background = hoverBg[variant];
      }}
      onMouseOut={(e) => {
        if (isDisabled) return;
        e.currentTarget.style.background = variantStyles[variant].background as string;
      }}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      )}
      {children}
    </button>
  );
}
