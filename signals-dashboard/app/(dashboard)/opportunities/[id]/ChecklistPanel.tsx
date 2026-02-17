"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { ChecklistV1 } from "@/lib/artifacts/types";
import { saveChecklistV1 } from "./actions";

interface ChecklistPanelProps {
  opportunityId: string;
  checklist: ChecklistV1 | null;
}

const DURABILITY_AXES = [
  { key: "platform_encroachment", label: "Platform Encroachment" },
  { key: "workflow_state", label: "Workflow State" },
  { key: "vertical_specificity", label: "Vertical Specificity" },
  { key: "permission_moat", label: "Permission Moat" },
  { key: "expansion_vector", label: "Expansion Vector" },
  { key: "data_compounding", label: "Data Compounding" },
] as const;

const DISQUALIFIERS = [
  { key: "summarization_lookup", label: "Summarization / Lookup" },
  { key: "dom_scrape_no_authority", label: "DOM Scrape (No Authority)" },
  { key: "horizontal_ai_assistant", label: "Horizontal AI Assistant" },
  { key: "stateless_value", label: "Stateless Value" },
  { key: "no_data_compounding", label: "No Data Compounding" },
  { key: "likely_native_feature", label: "Likely Native Feature" },
] as const;

function emptyChecklist(): ChecklistV1 {
  return {
    atomic_value: "",
    value_surface: { inside_workflow: false, actionable: false, detectable_moment: false },
    disqualifiers: {
      summarization_lookup: false,
      dom_scrape_no_authority: false,
      horizontal_ai_assistant: false,
      stateless_value: false,
      no_data_compounding: false,
      likely_native_feature: false,
    },
    durability_scores: {
      platform_encroachment: 1,
      workflow_state: 1,
      vertical_specificity: 1,
      permission_moat: 1,
      expansion_vector: 1,
      data_compounding: 1,
      total: 6,
      hard_kill: false,
    },
    execution_surface: null,
    verdict: null,
    reason: "",
    created_at_iso: "",
  };
}

const selectStyle: React.CSSProperties = {
  padding: "var(--space-2) var(--space-3)",
  fontSize: "var(--text-sm)",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg-elevated)",
  color: "var(--color-text-primary)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 500,
  fontSize: "var(--text-sm)",
  color: "var(--color-text-secondary)",
  marginBottom: "var(--space-1)",
};

export function ChecklistPanel({ opportunityId, checklist: initial }: ChecklistPanelProps) {
  const [form, setForm] = useState<ChecklistV1>(initial ?? emptyChecklist());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const ds = form.durability_scores;
  const computedTotal =
    ds.platform_encroachment + ds.workflow_state + ds.vertical_specificity +
    ds.permission_moat + ds.expansion_vector + ds.data_compounding;
  const hardKill = ds.platform_encroachment === 0 && ds.data_compounding === 0;

  function setDurability(key: string, val: number) {
    setForm((f) => ({
      ...f,
      durability_scores: { ...f.durability_scores, [key]: val as 0 | 1 | 2 },
    }));
  }

  function setDisqualifier(key: string, val: boolean) {
    setForm((f) => ({
      ...f,
      disqualifiers: { ...f.disqualifiers, [key]: val },
    }));
  }

  function setValueSurface(key: string, val: boolean) {
    setForm((f) => ({
      ...f,
      value_surface: { ...f.value_surface, [key]: val },
    }));
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await saveChecklistV1(opportunityId, {
        ...form,
        durability_scores: {
          ...form.durability_scores,
          total: computedTotal,
          hard_kill: hardKill,
        },
      });
      if (!result.ok) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <Card title="Build Checklist (v1)">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", fontSize: "var(--text-sm)" }}>
        {/* Atomic Value */}
        <div>
          <label style={labelStyle}>Atomic Value</label>
          <input
            style={{
              width: "100%",
              padding: "var(--space-2) var(--space-3)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              fontSize: "var(--text-sm)",
              color: "var(--color-text-primary)",
              background: "var(--color-bg-elevated)",
              outline: "none",
            }}
            value={form.atomic_value}
            onChange={(e) => setForm((f) => ({ ...f, atomic_value: e.target.value }))}
            placeholder="What is the single atomic unit of value?"
          />
        </div>

        {/* Value Surface */}
        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend style={labelStyle}>Value Surface</legend>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {(["inside_workflow", "actionable", "detectable_moment"] as const).map((k) => (
              <label
                key={k}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  cursor: "pointer",
                  color: "var(--color-text-primary)",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.value_surface[k]}
                  onChange={(e) => setValueSurface(k, e.target.checked)}
                  style={{ accentColor: "var(--color-accent)" }}
                />
                <span>{k.replace(/_/g, " ")}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Disqualifiers */}
        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend style={labelStyle}>Disqualifiers</legend>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {DISQUALIFIERS.map((d) => (
              <label
                key={d.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  cursor: "pointer",
                  color: "var(--color-text-primary)",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.disqualifiers[d.key]}
                  onChange={(e) => setDisqualifier(d.key, e.target.checked)}
                  style={{ accentColor: "var(--color-error)" }}
                />
                <span>{d.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Durability Scores */}
        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend style={labelStyle}>Durability Scores</legend>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {DURABILITY_AXES.map((axis) => (
              <div key={axis.key} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <span style={{ width: 180, color: "var(--color-text-secondary)", fontSize: "var(--text-sm)" }}>
                  {axis.label}
                </span>
                <select
                  style={selectStyle}
                  value={ds[axis.key]}
                  onChange={(e) => setDurability(axis.key, parseInt(e.target.value))}
                >
                  <option value={0}>0</option>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                </select>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "var(--space-3)", display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>
              Total: {computedTotal}/12
            </span>
            {hardKill && (
              <Badge variant="error">
                HARD KILL
              </Badge>
            )}
          </div>
        </fieldset>

        {/* Execution Surface */}
        <div>
          <label style={labelStyle}>Execution Surface</label>
          <select
            style={selectStyle}
            value={form.execution_surface ?? ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                execution_surface: (e.target.value || null) as ChecklistV1["execution_surface"],
              }))
            }
          >
            <option value="">{"\u2014"} Select {"\u2014"}</option>
            <option value="EXTENSION">EXTENSION</option>
            <option value="AGENT">AGENT</option>
            <option value="HYBRID">HYBRID</option>
            <option value="SAAS">SAAS</option>
          </select>
        </div>

        {/* Verdict */}
        <div>
          <label style={labelStyle}>Verdict</label>
          <select
            style={selectStyle}
            value={form.verdict ?? ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                verdict: (e.target.value || null) as ChecklistV1["verdict"],
              }))
            }
          >
            <option value="">{"\u2014"} Select {"\u2014"}</option>
            <option value="BUILD">BUILD</option>
            <option value="HOLD">HOLD</option>
            <option value="KILL">KILL</option>
          </select>
        </div>

        {/* Reason */}
        <div>
          <label style={labelStyle}>Reason</label>
          <textarea
            style={{
              width: "100%",
              padding: "var(--space-2) var(--space-3)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              fontSize: "var(--text-sm)",
              fontFamily: "inherit",
              color: "var(--color-text-primary)",
              background: "var(--color-bg-elevated)",
              outline: "none",
              resize: "vertical",
            }}
            rows={3}
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            placeholder="Why this verdict?"
          />
        </div>

        {error && (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-error-text)" }}>
            {error}
          </p>
        )}

        <Button onClick={handleSave} disabled={isPending} loading={isPending}>
          {isPending ? "Saving..." : "Save Checklist (v1)"}
        </Button>
      </div>
    </Card>
  );
}
