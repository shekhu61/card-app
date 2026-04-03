
export async function loader({ request }) {

  console.log("======================================");
  console.log("🚀 Shopify Flow Redeem Triggered");
  console.log("======================================");

  try {

    /* ================= READ HEADERS ================= */

    console.log("📥 Step 1: Reading request headers");

    const raw = request.headers.get("points");
    const rawOrderId = request.headers.get("ordername");
    const rawOrder_Id = request.headers.get("orderId");
    const employeeId = request.headers.get("employeeId");

    console.log("📦 Raw Points Header:", raw);
    console.log("📦 Raw Order Name Header:", rawOrderId);
    console.log("📦 Raw Order ID Header:", rawOrder_Id);
    console.log("👤 Employee ID Header:", employeeId);

    if (!rawOrderId || !employeeId || !rawOrder_Id) {
      console.log("❌ Missing required headers");
      return new Response("Missing parameters", { status: 400 });
    }

    /* ================= FORMAT ORDER DATA ================= */

    console.log("🔧 Step 2: Formatting order data");

    const orderId = rawOrderId.replace("#", "").trim();
    const shopifyOrderId = rawOrder_Id.split("/").pop();

    console.log("🧾 Shopify Order Name:", orderId);
    console.log("🧾 Shopify Order Numeric ID:", shopifyOrderId);

    /* ================= FIXED POINTS ================= */

    console.log("🪙 Step 3: Setting fixed redeem points");

    const pointsToRedeem = 15;

    console.log("🪙 Points to Redeem:", pointsToRedeem);

    /* ================= LOGIN ================= */

    console.log("🔐 Step 4: Authenticating with Rewards API");

    const BASE_URL = "https://stg-rewardsapi.centerforautism.com";

    console.log("🌐 Login URL:", `${BASE_URL}/Authentication/Login`);

    const loginRes = await fetch(`${BASE_URL}/Authentication/Login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        Username: "admin",
        Password: "admin"
      }),
    });

    console.log("📡 Login response status:", loginRes.status);

    const loginText = await loginRes.text();

    console.log("📨 Login raw response:", loginText);

    let loginData;

    try {
      loginData = JSON.parse(loginText);
      console.log("✅ Login JSON parsed successfully");
    } catch (error) {
      console.log("❌ Login response was not JSON");
      throw new Error("Login API did not return JSON");
    }

    const token =
      loginData.Token ||
      loginData.AccessToken ||
      loginData.access_token ||
      loginData.token;

    console.log("🔑 Extracted Token:", token);

    if (!token) {
      console.log("❌ Token not found in login response");
      throw new Error("Login failed: token missing");
    }

    console.log("✅ Authentication successful");

    /* ================= REDEEM ================= */

    console.log("🎯 Step 5: Preparing redeem request");

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

    console.log("📡 Redeem response status:", redeemRes.status);

    const redeemText = await redeemRes.text();

    console.log("📨 Redeem raw response:", redeemText);

    if (!redeemRes.ok) {
      console.log("❌ Redeem API failed");
      throw new Error(redeemText);
    }

    console.log("✅ Points redeemed successfully");

    /* ================= SHOPIFY METAFIELD UPDATE ================= */

    console.log("🛒 Step 6: Updating Shopify order metafield");

    const SHOPIFY_STORE = process.env.SHOPIFY_SHOP_DOMAIN;
    const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

    console.log("🏪 Shopify Store:", SHOPIFY_STORE);
    console.log("🧾 Order ID for metafield:", shopifyOrderId);

    const metafieldUrl =
      `https://${SHOPIFY_STORE}/admin/api/2026-01/orders/${shopifyOrderId}/metafields.json`;

    console.log("➡️ Metafield API URL:", metafieldUrl);

    const metafieldRes = await fetch(metafieldUrl, {
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
    });

    console.log("📡 Metafield response status:", metafieldRes.status);

    const metafieldData = await metafieldRes.json();

    console.log("📝 Metafield API response:", metafieldData);

    console.log("✅ Shopify metafield updated");

    /* ================= SUCCESS RESPONSE ================= */

    console.log("🎉 Step 7: Process completed successfully");

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

    console.log("======================================");
    console.log("🔥 ERROR OCCURRED");
    console.log("Message:", err.message);
    console.log("======================================");

    return new Response(err.message, { status: 500 });

  }

}