import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function action({ request }) {
  console.log("🔵 /coins/redeem called");

  const { admin } = await authenticate.admin(request);
  const { email } = await request.json();

  console.log("📧 Redeeming for:", email);

  const customer = await prisma.customerCoins.findUnique({
    where: { email },
  });

  if (!customer || customer.coins <= 0) {
    return Response.json({
      success: false,
      message: "No coins available",
    });
  }

  const discountCode = `COINS-${Date.now()}`;
  const discountValue = String(customer.coins);

  console.log("💰 Coins:", discountValue);
  console.log("🏷️ Code:", discountCode);

  // Shopify discount creation (same as your working code)
  // ...

  await prisma.customerCoins.update({
    where: { email },
    data: { coins: 0 },
  });

  console.log("✅ Coins deducted");

  return Response.json({
    success: true,
    code: discountCode,
  });
}
