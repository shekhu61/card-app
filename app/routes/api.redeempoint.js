export async function loader({ request }) {
  console.log("🚀 Shopify Flow Redeem Triggered");

  try {
    const orderId = request.headers.get("orderId");
    const employeeId = request.headers.get("employeeId");
    const pointsRaw = request.headers.get("points");

    console.log("📦 Headers:", { orderId, employeeId, pointsRaw });

    if (!orderId || !employeeId || !pointsRaw) {
      return new Response("Missing parameters", { status: 400 });
    }

    const discountAmount = parseFloat(pointsRaw);
    if (isNaN(discountAmount) || discountAmount <= 0) {
      return new Response("Invalid discount amount", { status: 400 });
    }

    const POINTS_PER_CURRENCY = 10;
    const pointsToRedeem = Math.round(discountAmount * POINTS_PER_CURRENCY);

    console.log("🪙 Redeeming:", pointsToRedeem);

    const BASE_URL = "https://stg-rewardsapi.centerforautism.com";

    const loginRes = await fetch(`${BASE_URL}/Authentication/Login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Username: "admin", Password: "admin" }),
    });

    const loginData = await loginRes.json();
    const token =
      loginData.Token || loginData.AccessToken || loginData.access_token;

    if (!token) throw new Error("Login failed");

    const redeemUrl =
      `${BASE_URL}/CardShopWrapper/SaveEmployeeOrderExternal` +
      `?EmployeeID=${employeeId}` +
      `&PointRedeemed=${pointsToRedeem}` +
      `&Notes=Shopify Order` +
      `&ExternalReferenceID=${orderId}`;

    const redeemRes = await fetch(redeemUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });

    const redeemText = await redeemRes.text();

    if (!redeemRes.ok) throw new Error(redeemText);

    return new Response(
      JSON.stringify({ success: true, orderId, employeeId, pointsToRedeem }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("🔥 Redeem error:", err.message);
    return new Response(err.message, { status: 500 });
  }
}
