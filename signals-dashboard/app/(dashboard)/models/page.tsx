import { requireUser } from "@/lib/auth/requireUser";
import { Card } from "@/components/ui/Card";
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
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Scoring Models</h1>
        <form action={createDefaultModel}>
          <Button type="submit" variant="secondary">
            Create Default Model
          </Button>
        </form>
      </div>

      {error && (
        <p className="rounded bg-red-50 p-3 text-sm text-red-600">
          {error.message}
        </p>
      )}

      {models.length === 0 && (
        <p className="text-sm text-gray-500">
          No scoring models yet. Create a default model to get started.
        </p>
      )}

      {models.map((model) => (
        <Card key={model.id} title={model.name}>
          <div className="mb-4 flex items-center gap-4 text-sm text-gray-600">
            <span>Version {model.version}</span>
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                model.active
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {model.active ? "Active" : "Inactive"}
            </span>
            {!model.active && (
              <form action={setActiveModel}>
                <input type="hidden" name="model_id" value={model.id} />
                <Button type="submit" variant="ghost" className="text-xs">
                  Set Active
                </Button>
              </form>
            )}
          </div>

          <form action={updateModel} className="flex flex-col gap-4">
            <input type="hidden" name="model_id" value={model.id} />
            <Textarea
              id={`weights-${model.id}`}
              name="weights"
              label="Weights"
              rows={4}
              defaultValue={JSON.stringify(model.weights, null, 2)}
            />
            <Textarea
              id={`thresholds-${model.id}`}
              name="thresholds"
              label="Thresholds"
              rows={3}
              defaultValue={JSON.stringify(model.thresholds, null, 2)}
            />
            <Textarea
              id={`penalties-${model.id}`}
              name="penalties"
              label="Penalties"
              rows={2}
              defaultValue={JSON.stringify(model.penalties, null, 2)}
            />
            <Button type="submit" variant="secondary">
              Update Model
            </Button>
          </form>
        </Card>
      ))}
    </div>
  );
}
