export async function loader() {
  return new Response("Method Not Allowed", { status: 405 });
}

export async function action({ request }) {
  console.log("🚀 Redeem API triggered");

  try {
    const body = await request.json();
    console.log("📦 Request body:", body);

    const BASE_URL = "https://stg-rewardsapi.centerforautism.com";
    const USERNAME = "admin";
    const PASSWORD = "admin";

    /* ================= SANITIZE INPUT ================= */

    const employeeId = body.employeeId;
    const orderId = body.orderId;

    if (!employeeId || !orderId) {
      throw new Error("Missing employeeId or orderId");
    }

    // Shopify Flow sends discount as multi-line string — clean it
    const discountRaw = String(body.points || "")
      .replace(/[\n\r]/g, "")
      .trim();

    const discountAmount = parseFloat(discountRaw);

    if (isNaN(discountAmount) || discountAmount <= 0) {
      throw new Error("Invalid discount amount received");
    }

    // 💰 Convert Discount → Points (example: ₹1 = 10 points)
    const POINTS_PER_CURRENCY = 10;
    const pointsToRedeem = Math.round(discountAmount * POINTS_PER_CURRENCY);

    console.log("💰 Discount:", discountAmount);
    console.log("🪙 Points to Redeem:", pointsToRedeem);

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

    if (!token) {
      throw new Error("Login failed — token missing");
    }

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

    console.log("🎉 Redeem success:", redeemText);

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
  } catch (error) {
    console.error("🔥 Redeem API Error:", error.message);

    return new Response(
      JSON.stringify({
        success: false,
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
