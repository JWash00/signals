import { Card } from "@/components/ui/Card";
import { RedditIngestButton } from "./RedditIngestButton";

export default function IngestionPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-gray-900">Ingestion</h1>

      <Card title="Reddit">
        <p className="mb-4 text-sm text-gray-500">
          Fetch new posts from configured subreddits and insert into raw_signals.
          Set <code className="rounded bg-gray-100 px-1">REDDIT_SUBREDDITS</code> and
          optionally <code className="rounded bg-gray-100 px-1">REDDIT_LIMIT</code> in
          your <code className="rounded bg-gray-100 px-1">.env.local</code>.
        </p>
        <RedditIngestButton />
      </Card>
    </div>
  );
}
