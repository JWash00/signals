"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: "grid" },
  { label: "Clusters", href: "/clusters", icon: "layers" },
  { label: "Opportunities", href: "/opportunities", icon: "target" },
  { label: "Models", href: "/models", icon: "sliders" },
  { label: "Ingestion", href: "/ingestion", icon: "download" },
  { label: "Review", href: "/review", icon: "check-circle" },
];

const iconPaths: Record<string, string> = {
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  layers: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  target: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z",
  sliders: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  download: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
  "check-circle": "M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3",
};

function NavIcon({ name }: { name: string }) {
  const d = iconPaths[name];
  if (!d) return null;
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d={d} />
    </svg>
  );
}

interface SidebarProps {
  userEmail: string;
}

export function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        width: "var(--sidebar-width)",
        background: "var(--color-bg-elevated)",
        borderRight: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        zIndex: 40,
      }}
    >
      {/* Brand */}
      <div
        style={{
          padding: "var(--space-5) var(--space-4)",
          borderBottom: "1px solid var(--color-border-subtle)",
        }}
      >
        <Link
          href="/dashboard"
          style={{
            fontSize: "var(--text-lg)",
            fontWeight: 700,
            color: "var(--color-text-primary)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: "var(--radius-md)",
              background: "var(--color-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "var(--text-sm)",
              fontWeight: 800,
            }}
          >
            S
          </span>
          Signals
        </Link>
      </div>

      {/* Navigation */}
      <nav
        style={{
          flex: 1,
          padding: "var(--space-3) var(--space-3)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-1)",
          overflowY: "auto",
        }}
      >
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className="sidebar-link"
              data-active={isActive}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div
        style={{
          padding: "var(--space-4)",
          borderTop: "1px solid var(--color-border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-2)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-text-tertiary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {userEmail}
          </div>
        </div>
        <form action="/logout" method="POST">
          <button
            type="submit"
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-text-tertiary)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "var(--space-1) var(--space-2)",
              borderRadius: "var(--radius-sm)",
              transition: "all var(--duration-fast) var(--ease-default)",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.color = "var(--color-error)";
              e.currentTarget.style.background = "var(--color-error-bg)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = "var(--color-text-tertiary)";
              e.currentTarget.style.background = "none";
            }}
          >
            Logout
          </button>
        </form>
      </div>
    </aside>
  );
}
