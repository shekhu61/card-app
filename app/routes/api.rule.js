import prisma from "../db.server";
import { authenticate } from "../shopify.server";

/* ================= GET ACTIVE RULE ================= */
export async function loader() {
  try {
    const rule = await prisma.rewardRule.findFirst({
      where: { isActive: true }
    });

    return new Response(JSON.stringify(rule), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("❌ Loader error:", error);
    return new Response("Failed to load rule", { status: 500 });
  }
}

/* ================= SAVE RULE ================= */
export async function action({ request }) {
  try {
    const { admin } = await authenticate.admin(request);
    if (!admin) throw new Error("Admin authentication failed");

    const body = await request.json();

    const basePoints = parseFloat(body.a); // "a"
    const difference = parseFloat(body.d); // "d"

    if (isNaN(basePoints) || isNaN(difference)) {
      return new Response("Invalid values", { status: 400 });
    }

    // Deactivate old rules
    await prisma.rewardRule.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    });

    // Create new rule
    const rule = await prisma.rewardRule.create({
      data: {
        basePoints,
        difference,
        isActive: true
      }
    });

    return new Response(JSON.stringify(rule), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("❌ Save error:", error);
    return new Response("Failed to save rule", { status: 500 });
  }
}