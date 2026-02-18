import { Card } from "@/components/ui/Card";
import { RedditIngestButton } from "./RedditIngestButton";

export default function IngestionPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-gray-900">Ingestion</h1>

      <Card title="Reddit: SaaS + Entrepreneur">
        <p className="mb-4 text-sm text-gray-500">
          Fetch new posts from r/SaaS and r/Entrepreneur and insert into
          raw_signals. Optionally set{" "}
          <code className="rounded bg-gray-100 px-1">REDDIT_LIMIT</code> in
          your <code className="rounded bg-gray-100 px-1">.env.local</code> to
          control posts per subreddit (default: 25).
        </p>
        <RedditIngestButton />
      </Card>
    </div>
  );
}
