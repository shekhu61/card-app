import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export async function action({ request }) {
  console.log("🔵 App Proxy hit");

  const url = new URL(request.url);
  const path = url.pathname;

  console.log("📍 Proxy path:", path);

  // Detect which proxy route
  if (path.endsWith("/coins/check")) {
    return handleCheckCoins(request);
  }

  if (path.endsWith("/coins/redeem")) {
    return handleRedeemCoins(request);
  }

  return new Response("Not Found", { status: 404 });
}

// ---------- HANDLERS ----------

async function handleCheckCoins(request) {
  const { email } = await request.json();

  console.log("📧 Check coins for:", email);

  const customer = await prisma.customerCoins.findUnique({
    where: { email },
  });

  return Response.json({
    coins: customer?.coins || 0,
  });
}

async function handleRedeemCoins(request) {
  const { admin } = await authenticate.admin(request);
  const { email } = await request.json();

  console.log("📧 Redeem coins for:", email);

  // Your working discount logic here
  return Response.json({
    success: true,
    code: "TESTCODE",
  });
}
