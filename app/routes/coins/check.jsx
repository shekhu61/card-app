import prisma from "../db.server";

export async function action({ request }) {
  console.log("🔵 /coins/check called");

  const { email } = await request.json();
  console.log("📧 Email received:", email);

  const customer = await prisma.customerCoins.findUnique({
    where: { email },
  });

  console.log("🪙 Coins found:", customer?.coins || 0);

  return Response.json({
    coins: customer?.coins || 0,
  });
}
