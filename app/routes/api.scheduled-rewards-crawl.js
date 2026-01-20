import { authenticate } from "../shopify.server";
import { runRewardsEmployeeCrawler } from "../services/rewardsCrawler.server";

export async function action({ request }) {
  // 🔐 Shopify signed request
  await authenticate.webhook(request);

  console.log("⏰ Scheduled rewards crawl triggered");

  try {
    const result = await runRewardsEmployeeCrawler();

    return new Response(
      JSON.stringify({ success: true, result }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Scheduled crawl failed:", error);

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
