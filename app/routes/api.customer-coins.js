import prisma from "../db.server";

export async function loader({ request }) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email");

  if (!email) {
    return Response.json({ success: false }, { status: 400 });
  }

  const customer = await prisma.customerCoins.findUnique({
    where: { email },
  });

  return Response.json({
    success: true,
    coins: customer?.coins || 0,
  });
}
