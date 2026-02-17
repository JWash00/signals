import { requireUser } from "@/lib/auth/requireUser";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { createDefaultModel, setActiveModel, updateModel } from "./actions";

interface ModelRow {
  id: string;
  name: string;
  version: number;
  active: boolean;
  weights: Record<string, number>;
  thresholds: Record<string, number>;
  penalties: Record<string, number>;
  created_at: string;
}

export default async function ModelsPage() {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("scoring_models")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const models: ModelRow[] = (data as ModelRow[]) ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              margin: 0,
            }}
          >
            Scoring Models
          </h1>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-tertiary)",
              marginTop: "var(--space-1)",
            }}
          >
            Configure PMF scoring weights and thresholds
          </p>
        </div>
        <form action={createDefaultModel}>
          <Button type="submit" variant="secondary">
            Create Default Model
          </Button>
        </form>
      </div>

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
          {error.message}
        </div>
      )}

      {models.length === 0 && (
        <div
          style={{
            padding: "var(--space-10) var(--space-5)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            background: "var(--color-bg-elevated)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontWeight: 600,
              color: "var(--color-text-primary)",
              marginBottom: "var(--space-2)",
            }}
          >
            No scoring models yet
          </div>
          <div style={{ color: "var(--color-text-tertiary)", fontSize: "var(--text-sm)" }}>
            Create a default model to get started.
          </div>
        </div>
      )}

      <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        {models.map((model) => (
          <Card
            key={model.id}
            title={model.name}
            action={
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-tertiary)" }}>
                  v{model.version}
                </span>
                <Badge variant={model.active ? "success" : "default"}>
                  {model.active ? "Active" : "Inactive"}
                </Badge>
                {!model.active && (
                  <form action={setActiveModel}>
                    <input type="hidden" name="model_id" value={model.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      Set Active
                    </Button>
                  </form>
                )}
              </div>
            }
          >
            <form action={updateModel} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <input type="hidden" name="model_id" value={model.id} />
              <Textarea
                id={`weights-${model.id}`}
                name="weights"
                label="Weights"
                rows={4}
                defaultValue={JSON.stringify(model.weights, null, 2)}
                style={{ fontFamily: "var(--font-mono), monospace", fontSize: "var(--text-xs)" }}
              />
              <Textarea
                id={`thresholds-${model.id}`}
                name="thresholds"
                label="Thresholds"
                rows={3}
                defaultValue={JSON.stringify(model.thresholds, null, 2)}
                style={{ fontFamily: "var(--font-mono), monospace", fontSize: "var(--text-xs)" }}
              />
              <Textarea
                id={`penalties-${model.id}`}
                name="penalties"
                label="Penalties"
                rows={2}
                defaultValue={JSON.stringify(model.penalties, null, 2)}
                style={{ fontFamily: "var(--font-mono), monospace", fontSize: "var(--text-xs)" }}
              />
              <Button type="submit" variant="secondary">
                Update Model
              </Button>
            </form>
          </Card>
        ))}
      </div>
    </div>
  );
}
