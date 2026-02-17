"use client";

import { ReactNode, useState, useMemo } from "react";

interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => ReactNode);
  className?: string;
  sortable?: boolean;
  sortKey?: (row: T) => string | number;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  emptyAction?: ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchAccessor?: (row: T) => string;
}

export function Table<T>({
  columns,
  data,
  emptyMessage = "No data",
  emptyAction,
  searchable = false,
  searchPlaceholder = "Search...",
  searchAccessor,
}: TableProps<T>) {
  const [query, setQuery] = useState("");
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return data;
    const q = query.toLowerCase();
    return data.filter((row) => {
      if (searchAccessor) return searchAccessor(row).toLowerCase().includes(q);
      return columns.some((col) => {
        const val =
          typeof col.accessor === "function"
            ? ""
            : String(row[col.accessor] ?? "");
        return val.toLowerCase().includes(q);
      });
    });
  }, [data, query, searchable, searchAccessor, columns]);

  const sorted = useMemo(() => {
    if (sortCol === null) return filtered;
    const col = columns[sortCol];
    if (!col) return filtered;
    const getKey =
      col.sortKey ??
      ((row: T) => {
        if (typeof col.accessor === "function") return "";
        return String(row[col.accessor] ?? "");
      });
    return [...filtered].sort((a, b) => {
      const av = getKey(a);
      const bv = getKey(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortAsc ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortAsc, columns]);

  function handleSort(idx: number) {
    if (!columns[idx]?.sortable) return;
    if (sortCol === idx) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(idx);
      setSortAsc(true);
    }
  }

  return (
    <div>
      {searchable && (
        <div
          style={{
            padding: "var(--space-3) var(--space-4)",
            borderBottom: "1px solid var(--color-border-subtle)",
          }}
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            style={{
              width: "100%",
              maxWidth: 320,
              padding: "var(--space-2) var(--space-3)",
              fontSize: "var(--text-sm)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              background: "var(--color-bg-sunken)",
              color: "var(--color-text-primary)",
              outline: "none",
              transition:
                "border-color var(--duration-fast) var(--ease-default)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--color-accent)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border)";
            }}
          />
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr
              style={{
                borderBottom: "1px solid var(--color-border-subtle)",
              }}
            >
              {columns.map((col, i) => (
                <th
                  key={i}
                  onClick={() => handleSort(i)}
                  style={{
                    padding: "var(--space-3) var(--space-4)",
                    textAlign: "left",
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                    color: "var(--color-text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    cursor: col.sortable ? "pointer" : "default",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "var(--space-1)",
                    }}
                  >
                    {col.header}
                    {col.sortable && sortCol === i && (
                      <span style={{ fontSize: 10 }}>
                        {sortAsc ? "\u25B2" : "\u25BC"}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: "var(--space-10) var(--space-4)",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      color: "var(--color-text-tertiary)",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    {emptyMessage}
                  </div>
                  {emptyAction && (
                    <div style={{ marginTop: "var(--space-3)" }}>
                      {emptyAction}
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              sorted.map((row, ri) => (
                <tr
                  key={ri}
                  style={{
                    borderBottom: "1px solid var(--color-border-subtle)",
                    transition:
                      "background var(--duration-fast) var(--ease-default)",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = "var(--color-bg-hover)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  {columns.map((col, ci) => (
                    <td
                      key={ci}
                      style={{
                        padding: "var(--space-3) var(--space-4)",
                        fontSize: "var(--text-sm)",
                        color: "var(--color-text-primary)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {typeof col.accessor === "function"
                        ? col.accessor(row)
                        : (row[col.accessor] as ReactNode)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
