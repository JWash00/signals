import { TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, id, style, className, ...props }: TextareaProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 500,
            color: "var(--color-text-secondary)",
          }}
        >
          {label}
        </label>
      )}
      <textarea
        id={id}
        className={className}
        style={{
          padding: "var(--space-2) var(--space-3)",
          fontSize: "var(--text-base)",
          borderRadius: "var(--radius-md)",
          border: `1px solid ${error ? "var(--color-error)" : "var(--color-border)"}`,
          background: "var(--color-bg-elevated)",
          color: "var(--color-text-primary)",
          transition: "border-color var(--duration-fast) var(--ease-default), box-shadow var(--duration-fast) var(--ease-default)",
          outline: "none",
          resize: "vertical" as const,
          fontFamily: "inherit",
          ...style,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--color-accent)";
          e.currentTarget.style.boxShadow = "0 0 0 3px var(--color-accent-subtle)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? "var(--color-error)" : "var(--color-border)";
          e.currentTarget.style.boxShadow = "none";
        }}
        {...props}
      />
      {error && (
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-error-text)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
