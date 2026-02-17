"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    const { error: authError } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/dashboard`,
            },
          });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-bg)",
      }}
    >
      <div
        className="animate-fade-in"
        style={{
          width: "100%",
          maxWidth: 400,
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--color-border)",
          background: "var(--color-bg-elevated)",
          padding: "var(--space-8)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: "var(--space-8)" }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "var(--radius-lg)",
              background: "var(--color-accent)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "var(--text-lg)",
              fontWeight: 800,
              marginBottom: "var(--space-3)",
            }}
          >
            S
          </div>
          <h1
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              margin: 0,
            }}
          >
            Signals
          </h1>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-tertiary)",
              marginTop: "var(--space-1)",
            }}
          >
            PMF scoring and opportunity tracking
          </p>
        </div>

        {/* Mode toggle */}
        <div
          style={{
            display: "flex",
            marginBottom: "var(--space-6)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
            overflow: "hidden",
          }}
        >
          {(["signin", "signup"] as const).map((m) => {
            const isActive = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                style={{
                  flex: 1,
                  padding: "var(--space-2) var(--space-4)",
                  fontSize: "var(--text-sm)",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  transition: "all var(--duration-fast) var(--ease-default)",
                  background: isActive ? "var(--color-accent)" : "var(--color-bg-elevated)",
                  color: isActive ? "var(--color-text-inverted)" : "var(--color-text-secondary)",
                }}
              >
                {m === "signin" ? "Sign In" : "Sign Up"}
              </button>
            );
          })}
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
        >
          <Input
            id="email"
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <Input
            id="password"
            label="Password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 6 characters"
          />

          {error && (
            <div
              style={{
                padding: "var(--space-3)",
                borderRadius: "var(--radius-md)",
                background: "var(--color-error-bg)",
                color: "var(--color-error-text)",
                border: "1px solid var(--color-error-border)",
                fontSize: "var(--text-sm)",
              }}
            >
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading} loading={loading} size="lg">
            {loading
              ? "Loading..."
              : mode === "signin"
                ? "Sign In"
                : "Sign Up"}
          </Button>
        </form>
      </div>
    </div>
  );
}
