"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
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
      durability_scores: {
        ...f.durability_scores,
        [key]: val as 0 | 1 | 2,
      },
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
      <div className="space-y-6 text-sm">
        {/* Atomic Value */}
        <div>
          <label className="block font-medium text-gray-700 mb-1">Atomic Value</label>
          <input
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={form.atomic_value}
            onChange={(e) => setForm((f) => ({ ...f, atomic_value: e.target.value }))}
            placeholder="What is the single atomic unit of value?"
          />
        </div>

        {/* Value Surface */}
        <fieldset>
          <legend className="font-medium text-gray-700 mb-2">Value Surface</legend>
          <div className="space-y-1">
            {(["inside_workflow", "actionable", "detectable_moment"] as const).map((k) => (
              <label key={k} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.value_surface[k]}
                  onChange={(e) => setValueSurface(k, e.target.checked)}
                />
                <span>{k.replace(/_/g, " ")}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Disqualifiers */}
        <fieldset>
          <legend className="font-medium text-gray-700 mb-2">Disqualifiers</legend>
          <div className="space-y-1">
            {DISQUALIFIERS.map((d) => (
              <label key={d.key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.disqualifiers[d.key]}
                  onChange={(e) => setDisqualifier(d.key, e.target.checked)}
                />
                <span>{d.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Durability Scores */}
        <fieldset>
          <legend className="font-medium text-gray-700 mb-2">Durability Scores</legend>
          <div className="space-y-2">
            {DURABILITY_AXES.map((axis) => (
              <div key={axis.key} className="flex items-center gap-3">
                <span className="w-48 text-gray-600">{axis.label}</span>
                <select
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
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
          <div className="mt-3 flex items-center gap-4">
            <span className="font-medium">Total: {computedTotal}/12</span>
            {hardKill && (
              <span className="rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
                HARD KILL — platform_encroachment=0 + data_compounding=0
              </span>
            )}
          </div>
        </fieldset>

        {/* Execution Surface */}
        <div>
          <label className="block font-medium text-gray-700 mb-1">Execution Surface</label>
          <select
            className="rounded border border-gray-300 px-3 py-2 text-sm"
            value={form.execution_surface ?? ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                execution_surface: (e.target.value || null) as ChecklistV1["execution_surface"],
              }))
            }
          >
            <option value="">— Select —</option>
            <option value="EXTENSION">EXTENSION</option>
            <option value="AGENT">AGENT</option>
            <option value="HYBRID">HYBRID</option>
            <option value="SAAS">SAAS</option>
          </select>
        </div>

        {/* Verdict */}
        <div>
          <label className="block font-medium text-gray-700 mb-1">Verdict</label>
          <select
            className="rounded border border-gray-300 px-3 py-2 text-sm"
            value={form.verdict ?? ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                verdict: (e.target.value || null) as ChecklistV1["verdict"],
              }))
            }
          >
            <option value="">— Select —</option>
            <option value="BUILD">BUILD</option>
            <option value="HOLD">HOLD</option>
            <option value="KILL">KILL</option>
          </select>
        </div>

        {/* Reason */}
        <div>
          <label className="block font-medium text-gray-700 mb-1">Reason</label>
          <textarea
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            rows={3}
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            placeholder="Why this verdict?"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving..." : "Save Checklist (v1)"}
        </Button>
      </div>
    </Card>
  );
}
