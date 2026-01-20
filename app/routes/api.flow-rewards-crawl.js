import { authenticate } from "../shopify.server";
import { runRewardsCrawlerIfDue } from "../services/rewardsCrawler.server";
import { runRewardsEmployees } from "./api.rewards-employees";

export async function action({ request }) {
  // Flow runs inside the shop → admin auth works
  const { admin } = await authenticate.admin(request);

  const result = await runRewardsCrawlerIfDue(() =>
    runRewardsEmployees(admin)
  );

  return new Response(
    JSON.stringify({ success: true, result }),
    { headers: { "Content-Type": "application/json" } }
  );
}
