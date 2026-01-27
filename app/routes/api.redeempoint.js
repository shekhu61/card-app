export async function loader({ request }) {
  console.log("🚀 Shopify Flow Redeem Triggered (GET)");

  try {
    const url = new URL(request.url);

    const orderId = url.searchParams.get("orderId");
    const employeeId = url.searchParams.get("employeeId");
    const pointsRaw = url.searchParams.get("points");

    console.log("📦 Raw Params:", { orderId, employeeId, pointsRaw });

    if (!orderId || !employeeId || !pointsRaw) {
      return new Response("Missing parameters", { status: 400 });
    }

    // Clean Shopify Flow discount
    const clean = pointsRaw.replace(/[\n\r]/g, "").trim();
    const discountAmount = parseFloat(clean);

    if (isNaN(discountAmount) || discountAmount <= 0) {
      return new Response("Invalid discount amount", { status: 400 });
    }

    // 💰 Convert discount → points
    const POINTS_PER_CURRENCY = 10;
    const pointsToRedeem = Math.round(discountAmount * POINTS_PER_CURRENCY);

    console.log("💰 Discount:", discountAmount);
    console.log("🪙 Points:", pointsToRedeem);

    const BASE_URL = "https://stg-rewardsapi.centerforautism.com";
    const USERNAME = "admin";
    const PASSWORD = "admin";

    /* ================= LOGIN ================= */

    const loginRes = await fetch(`${BASE_URL}/Authentication/Login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Username: USERNAME,
        Password: PASSWORD,
      }),
    });

    const loginData = await loginRes.json();
    const token =
      loginData.Token ||
      loginData.AccessToken ||
      loginData.access_token ||
      loginData.token;

    if (!token) throw new Error("Login failed");

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
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const redeemText = await redeemRes.text();

    if (!redeemRes.ok) {
      console.error("❌ Redeem failed:", redeemText);
      throw new Error(redeemText);
    }

    console.log("🎉 Redeemed:", redeemText);

    return new Response(
      JSON.stringify({
        success: true,
        orderId,
        employeeId,
        discountAmount,
        pointsRedeemed: pointsToRedeem,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("🔥 Redeem Error:", err.message);
    return new Response(err.message, { status: 500 });
  }
}
