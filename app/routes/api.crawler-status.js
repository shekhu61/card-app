import { authenticate } from "../shopify.server";
import { getCrawlerStatus } from "../services/rewardsCrawler.server";

export async function loader({ request }) {
  await authenticate.admin(request);

  return new Response(
    JSON.stringify(getCrawlerStatus()),
    { headers: { "Content-Type": "application/json" } }
  );
}
