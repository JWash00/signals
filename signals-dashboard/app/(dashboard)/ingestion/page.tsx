import { redirect } from "next/navigation";
import { debugToolsEnabled } from "@/lib/debug";
import { Card } from "@/components/ui/Card";
import { RedditIngestButton } from "./RedditIngestButton";
import { ProductHuntIngestButton } from "./ProductHuntIngestButton";

export default function IngestionPage() {
  if (!debugToolsEnabled()) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-gray-900">
        Get Stuff{" "}
        <span className="text-xs font-normal text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
          DEBUG
        </span>
      </h1>

      <p className="text-sm text-gray-500 -mt-4">
        Auto collection runs via cron every 30 minutes. These manual controls are
        only visible when{" "}
        <code className="rounded bg-gray-100 px-1">
          NEXT_PUBLIC_DEBUG_TOOLS=1
        </code>.
      </p>

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

      <Card title="Product Hunt">
        <p className="mb-4 text-sm text-gray-500">
          Fetch posts from Product Hunt and insert into raw_signals.{" "}
          <strong>Live</strong> grabs the newest posts within a time window.{" "}
          <strong>Backfill</strong> pages through older posts for historical data.{" "}
          Requires{" "}
          <code className="rounded bg-gray-100 px-1">
            PRODUCT_HUNT_CLIENT_ID
          </code>{" "}
          and{" "}
          <code className="rounded bg-gray-100 px-1">
            PRODUCT_HUNT_CLIENT_SECRET
          </code>{" "}
          in your{" "}
          <code className="rounded bg-gray-100 px-1">.env.local</code>.
        </p>
        <ProductHuntIngestButton />
      </Card>
    </div>
  );
}
