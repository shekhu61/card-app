import { authenticate } from "../shopify.server";
import { registerScheduledJob } from "../shopify.server";

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  await registerScheduledJob(admin);
  return null;
}
