import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function action({ request }) {
  console.log("🔹 Coins action called");

  // Protect route
  const { admin } = await authenticate.admin(request);
  console.log("🔹 Admin authenticated");

  const body = await request.json();
  console.log("🔹 Request body:", body);

  const { name, email, coins } = body;

  // ✅ Validation
  if (!email || coins === undefined) {
    return Response.json(
      { success: false, message: "Email and coins are required" },
      { status: 400 }
    );
  }

  const parsedCoins = Number(coins);
  if (Number.isNaN(parsedCoins)) {
    return Response.json(
      { success: false, message: "Coins must be a number" },
      { status: 400 }
    );
  }

  /* =========================
     1️⃣ DATABASE (ALWAYS SAVE)
     ========================= */

  let dbRecord;
  try {
    console.log("🔹 Saving coins to DB");

    dbRecord = await prisma.customerCoins.upsert({
      where: { email },
      create: {
        name: name || "",
        email,
        coins: parsedCoins,
      },
      update: {
        name: name || "",
        coins: parsedCoins,
      },
    });

    console.log("✅ DB saved:", dbRecord);
  } catch (dbError) {
    console.error("❌ DB error:", dbError);
    return Response.json(
      { success: false, message: "Database error" },
      { status: 500 }
    );
  }

  /* =================================
     2️⃣ SHOPIFY CUSTOMER (OPTIONAL)
     ================================= */

  let shopifyCustomer = null;
  let shopifyError = null;

  try {
    console.log("🔹 Creating Shopify customer");

    const mutation = `
      mutation createCustomer($input: CustomerInput!) {
        customerCreate(input: $input) {
          customer {
            id
            email
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await admin.graphql(mutation, {
      variables: {
        input: {
          firstName: name,
          email,
          tags: ["pts"],
        },
      },
    });

    const result = await response.json();
    console.log("🔹 Shopify response:", JSON.stringify(result, null, 2));

    if (result?.data?.customerCreate?.userErrors?.length > 0) {
      shopifyError = result.data.customerCreate.userErrors;
      console.warn("⚠️ Shopify userErrors:", shopifyError);
    } else {
      shopifyCustomer = result.data.customerCreate.customer;
      console.log("✅ Shopify customer created:", shopifyCustomer);
    }
  } catch (error) {
    shopifyError = error.message;
    console.warn("⚠️ Shopify API failed:", error);
  }

  /* =========================
     FINAL RESPONSE
     ========================= */

  return Response.json({
    success: true,
    db: dbRecord,
    shopify: shopifyCustomer,
    shopifyError, // null if success
  });
}
