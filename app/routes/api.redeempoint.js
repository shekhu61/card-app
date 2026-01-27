export async function loader({ request }) {
  console.log("🚀 Shopify Flow Redeem Triggered");

  try {
    const raw = request.headers.get("points");

const matches = raw.match(/[\d.]+/g) || [];
const discountAmount = matches.reduce((sum, v) => sum + parseFloat(v), 0);



    const rawOrderId = request.headers.get("orderId");
const orderId = rawOrderId.replace("#", "").trim();

    const employeeId = request.headers.get("employeeId");
    const pointsRaw = request.headers.get("points");

    console.log("📦 Headers:", { orderId, employeeId, pointsRaw });

    if (!orderId || !employeeId || !pointsRaw) {
      return new Response("Missing parameters", { status: 400 });
    }


    if (isNaN(discountAmount) || discountAmount <= 0) {
      return new Response("Invalid discount amount", { status: 400 });
    }

    // 🪙 1 currency = 1 point
    const pointsToRedeem = Math.round(discountAmount);
    console.log("🪙 Redeeming:", pointsToRedeem);

    const BASE_URL = "https://stg-rewardsapi.centerforautism.com";

    /* ================= LOGIN ================= */

    const loginRes = await fetch(`${BASE_URL}/Authentication/Login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Username: "admin",
        Password: "admin",
      }),
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
      loginData.Token ||
      loginData.AccessToken ||
      loginData.access_token ||
      loginData.token;

    if (!token) {
      throw new Error("Login failed: token missing");
    }

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
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const redeemText = await redeemRes.text();
    console.log("📨 Redeem raw:", redeemText);

    if (!redeemRes.ok) {
      throw new Error(redeemText);
    }

    return new Response(
      JSON.stringify({
        success: true,
        orderId,
        employeeId,
        pointsRedeemed: pointsToRedeem,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("🔥 Redeem error:", err.message);
    return new Response(err.message, { status: 500 });
  }
}
