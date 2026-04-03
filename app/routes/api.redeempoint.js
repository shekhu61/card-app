import prisma from "../db.server";

export async function loader({ request }) {
  console.log("🚀 Shopify Flow Redeem Triggered");

  try {

    /* ================= READ HEADERS ================= */
    const raw = request.headers.get("points");
    const rawOrderId = request.headers.get("ordername");
    const rawOrder_Id = request.headers.get("orderId");
    const employeeId = request.headers.get("employeeId");

    const shopifyOrderId = rawOrder_Id.split("/").pop();

    console.log("Shopify Order ID:", shopifyOrderId);

    if (!rawOrderId || !employeeId) {
      return new Response("Missing parameters", { status: 400 });
    }

    const orderId = rawOrderId.replace("#", "").trim();

    /* ================= FIXED POINTS ================= */

    const pointsToRedeem = 15;
    console.log("🪙 Fixed points to redeem:", pointsToRedeem);

    /* ================= LOGIN ================= */

    const BASE_URL = "https://stg-rewardsapi.centerforautism.com";

    const loginRes = await fetch(`${BASE_URL}/Authentication/Login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Username: "admin",
        Password: "admin"
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

    console.log("🔑 Token received successfully");

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

    /* ================= UPDATE SHOPIFY METAFIELD ================= */

    const SHOPIFY_STORE = process.env.SHOPIFY_SHOP_DOMAIN;
    const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

    const metafieldRes = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2026-01/orders/${shopifyOrderId}/metafields.json`,
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
        pointsRedeemed: pointsToRedeem,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );

  } catch (err) {

    console.error("🔥 Redeem error:", err.message);

    return new Response(err.message, { status: 500 });

  }
}