import prisma from "../db.server";

export async function loader({ request }) {
  console.log("🚀 Shopify Flow Redeem Triggered");

  try {
    /* ================= READ HEADERS ================= */
    const raw = request.headers.get("points"); // "90.090.0"
    const rawOrderId = request.headers.get("orderId");
    const employeeId = request.headers.get("employeeId");

    if (!raw || !rawOrderId || !employeeId) {
      return new Response("Missing parameters", { status: 400 });
    }

    const orderId = rawOrderId.replace("#", "").trim();

    // Split "90.090.0" → ["90","90"]
    const values = raw.split(".0").filter(v => v !== "");
    const discountAmount = values.reduce((sum, v) => sum + parseFloat(v), 0);

    if (isNaN(discountAmount) || discountAmount <= 0) {
      return new Response("Invalid discount amount", { status: 400 });
    }

    console.log("💲 Discount total:", discountAmount);

    /* ================= LOAD REWARD RULE ================= */
    const rewardRule = await prisma.rewardRule.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (!rewardRule) {
      return new Response("No active reward rule found", { status: 500 });
    }

    const { pointsPerUnit, currencyUnit } = rewardRule;

    if (pointsPerUnit <= 0 || currencyUnit <= 0) {
      return new Response("Invalid reward rule configuration", { status: 500 });
    }

    const pointsPerDollar = pointsPerUnit / currencyUnit;
    console.log("🎯 Reward Rule:", { pointsPerUnit, currencyUnit, pointsPerDollar });

    /* ================= CALCULATE POINTS ================= */
    const pointsToRedeem = Math.round(discountAmount * pointsPerDollar);
    console.log("🪙 Points to redeem:", { discountAmount, pointsPerDollar, pointsToRedeem });

    if (pointsToRedeem <= 0) {
      return new Response("Calculated points invalid", { status: 400 });
    }

    /* ================= LOGIN ================= */
    const BASE_URL = "https://stg-rewardsapi.centerforautism.com";

    const loginRes = await fetch(`${BASE_URL}/Authentication/Login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Username: "admin", Password: "admin" }),
    });

    const loginText = await loginRes.text();
    console.log("🔐 Login raw:", loginText);

    let loginData;
    try {
      loginData = JSON.parse(loginText);
    } catch {
      throw new Error("Login API did not return JSON");
    }

    const token =
      loginData.Token || loginData.AccessToken || loginData.access_token || loginData.token;
    if (!token) throw new Error("Login failed: token missing");

    console.log("🔑 Token received");

    /* ================= REDEEM ================= */
    const redeemUrl =
      `${BASE_URL}/CardShopWrapper/SaveEmployeeOrderExternal` +
      `?EmployeeID=${employeeId}` +
      `&PointRedeemed=${pointsToRedeem}` +
      `&Notes=Shopify Order` +
      `&ExternalReferenceID=${orderId}`;

    console.log("➡️ Redeem URL:", redeemUrl);

    const redeemRes = await fetch(redeemUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });

    const redeemText = await redeemRes.text();
    console.log("📨 Redeem raw:", redeemText);

    if (!redeemRes.ok) throw new Error(redeemText);

    /* ================= UPDATE SHOPIFY METAFIELD ================= */
    const SHOPIFY_STORE = process.env.SHOPIFY_STORE; // e.g. "mystore.myshopify.com"
    const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN; // Admin API token

    const metafieldRes = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2026-01/orders/${orderId}/metafields.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": SHOPIFY_TOKEN,
        },
        body: JSON.stringify({
          metafield: {
            namespace: "custom",
            key: "redeem_points",
            value: pointsToRedeem.toString(),
            type: "single_line_text_field",
          },
        }),
      }
    );

    const metafieldData = await metafieldRes.json();
    console.log("📝 Metafield update response:", metafieldData);

    /* ================= SUCCESS ================= */
    return new Response(
      JSON.stringify({
        success: true,
        orderId,
        employeeId,
        discountAmount,
        pointsPerDollar,
        pointsRedeemed: pointsToRedeem,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("🔥 Redeem error:", err.message);
    return new Response(err.message, { status: 500 });
  }
}
