import prisma from "../db.server";

export async function loader({ request }) {

  console.log("================================================");
  console.log("🚀 Shopify Flow Redeem Triggered");
  console.log("================================================");

  try {

    /* ================= READ HEADERS ================= */

    console.log("📥 Reading headers...");

    const raw = request.headers.get("points");
    const rawOrderId = request.headers.get("ordername");
    const rawOrder_Id = request.headers.get("orderId");
    const employeeId = request.headers.get("employeeId");

    console.log("Header points:", raw);
    console.log("Header ordername:", rawOrderId);
    console.log("Header orderId:", rawOrder_Id);
    console.log("Header employeeId:", employeeId);

    if (!raw || !rawOrderId || !rawOrder_Id || !employeeId) {
      console.log("❌ Missing required headers");
      return new Response("Missing parameters", { status: 400 });
    }

    const shopifyOrderId = rawOrder_Id.split("/").pop();
    console.log("🛒 Shopify Order ID:", shopifyOrderId);

    const orderId = rawOrderId.replace("#", "").trim();
    console.log("🧾 Clean Order ID:", orderId);


    /* ================= DISCOUNT CALCULATION ================= */

    console.log("💲 Calculating discount amount...");

    const values = raw.split(".0").filter(v => v !== "");
    console.log("Split values:", values);

    const discountAmount = values.reduce((sum, v) => sum + parseFloat(v), 0);

    console.log("💲 Discount total:", discountAmount);

    if (isNaN(discountAmount) || discountAmount <= 0) {
      console.log("❌ Invalid discount amount");
      return new Response("Invalid discount amount", { status: 400 });
    }


    /* ================= LOAD REWARD RULE ================= */

    console.log("📊 Fetching reward rule from DB...");

    const rewardRule = await prisma.rewardRule.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    console.log("Reward Rule:", rewardRule);

    if (!rewardRule) {
      console.log("❌ No active reward rule found");
      return new Response("No active reward rule found", { status: 500 });
    }


    /* ================= CALCULATE POINTS ================= */

    const { basePoints: a } = rewardRule;
    const pointsPerDollar = a;

    console.log("Points per dollar:", pointsPerDollar);

    if (typeof a !== "number" || a <= 0) {
      console.log("❌ Invalid reward rule configuration");
      return new Response("Invalid reward rule configuration", { status: 500 });
    }

    console.log("🧮 Calculating redeem points...");

    let pointsToRedeem = Math.round(discountAmount * a);

    console.log("Raw points:", pointsToRedeem);

    const remainder = pointsToRedeem % 5;

    if (remainder !== 0) {
      pointsToRedeem += (5 - remainder);
    }

    console.log("🪙 Final points to redeem:", pointsToRedeem);

    if (pointsToRedeem <= 0) {
      console.log("❌ Calculated points invalid");
      return new Response("Calculated points invalid", { status: 400 });
    }


    /* ================= LOGIN ================= */

    console.log("🔐 Logging into rewards API...");

    const BASE_URL = "https://rewardsapi.centerforautism.com";

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

    console.log("Login status:", loginRes.status);

    const loginText = await loginRes.text();
    console.log("Login raw response:", loginText);

    let loginData;

    try {
      loginData = JSON.parse(loginText);
    } catch {
      console.log("❌ Login response not JSON");
      throw new Error("Login API did not return JSON");
    }

    const token =
      loginData.Token ||
      loginData.AccessToken ||
      loginData.access_token ||
      loginData.token;

    if (!token) {
      console.log("❌ Token missing");
      throw new Error("Login failed: token missing");
    }

    console.log("🔑 Token received successfully");


    /* ================= REDEEM ================= */

    console.log("🎯 Preparing redeem API call...");

    const redeemUrl =
      `${BASE_URL}/CardShopWrapper/SaveEmployeeOrderExternal` +
      `?EmployeeID=${employeeId}` +
      `&PointRedeemed=${pointsToRedeem}` +
      `&Notes=Shopify Order` +
      `&ExternalReferenceID=${orderId}`;

    console.log("➡️ Redeem URL:", redeemUrl);

    const redeemRes = await fetch(redeemUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log("Redeem API status:", redeemRes.status);

    const redeemText = await redeemRes.text();

    console.log("📨 Redeem API raw response:", redeemText);

    if (!redeemRes.ok) {
      console.log("❌ Redeem API failed");
      throw new Error(redeemText || "Redeem API failed");
    }


    /* ================= UPDATE SHOPIFY METAFIELD ================= */

    console.log("📝 Updating Shopify metafield...");

    const SHOPIFY_STORE = process.env.SHOPIFY_SHOP_DOMAIN;
    const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

    const meta_url =
      `https://${SHOPIFY_STORE}/admin/api/2026-01/orders/${shopifyOrderId}/metafields.json`;

    console.log("Metafield URL:", meta_url);

    const metafieldRes = await fetch(meta_url, {
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

    console.log("Metafield response status:", metafieldRes.status);

    const metafieldData = await metafieldRes.json();

    console.log("📝 Metafield update response:", metafieldData);


    /* ================= SUCCESS ================= */

    console.log("✅ Redeem process completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        orderId,
        employeeId,
        discountAmount,
        pointsPerDollar,
        pointsRedeemed: pointsToRedeem,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );

  } catch (err) {

    console.log("🔥 ERROR OCCURRED");
    console.error("Error message:", err.message);

    return new Response(err.message, { status: 500 });

  }
}