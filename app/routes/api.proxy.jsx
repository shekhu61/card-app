import { authenticate } from "../shopify.server";
import prisma from "../db.server";

/* ======================================================
   HARD-CODED REWARDS API CONFIG
====================================================== */
const BASE_URL = "https://rewardsapi.centerforautism.com";
const USERNAME = "admin";
const PASSWORD = "admin";

/* ======================================================
   APP PROXY ENTRY
====================================================== */
export async function action({ request }) {
  console.log("🔵 App Proxy hit");

  try {
    const { admin } = await authenticate.public.appProxy(request);

    /* ----------------------------------------------
       READ FRONTEND DATA
    ---------------------------------------------- */
    const { employeeId, email } = await request.json();

    if (!employeeId || !email) {
      return Response.json(
        { error: "Employee ID or email missing" },
        { status: 400 }
      );
    }

    console.log("🆔 Employee ID:", employeeId);
    console.log("📧 Email:", email);

    /* ----------------------------------------------
       LOGIN TO REWARDS API
    ---------------------------------------------- */
    const token = await loginAndGetToken();

    /* ----------------------------------------------
       FETCH EMPLOYEE POINTS
    ---------------------------------------------- */
    const pointsRes = await fetch(
      `${BASE_URL}/CardShopWrapper/GetEmployeePoints?EmployeeID=${employeeId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!pointsRes.ok) throw new Error("Employee points API failed");

    const pointsData = await pointsRes.json();

    const {
      employeeID,
      employeeName,
      availablePoints,
      totalEarnedPoints,
      redeemedPoints,
      addedPoints,
    } = pointsData;

    /* ----------------------------------------------
       FETCH REWARD RULE
    ---------------------------------------------- */
    const rewardRule = await prisma.rewardRule.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (!rewardRule) throw new Error("No active reward rule found");

    const { basePoints: a } = rewardRule;

    if (!a || a <= 0) {
      throw new Error("Invalid reward rule configuration");
    }

    const points = Number(availablePoints) || 0;
    const coins = (points / a).toFixed(2);

    console.log(`💰 Coins: ${coins}`);

    /* ----------------------------------------------
       GET SHOPIFY CUSTOMER
    ---------------------------------------------- */
    const customerRes = await admin.graphql(
      `
      query ($query: String!) {
        customers(first: 1, query: $query) {
          nodes {
            id
            metafield(namespace: "custom", key: "discount_id") {
              value
            }
          }
        }
      }
      `,
      { variables: { query: `email:${email}` } }
    );

    const customerJson = await customerRes.json();
    const customer = customerJson.data.customers.nodes[0];

    if (!customer) throw new Error("Customer not found");

    const shopifyCustomerId = customer.id;
    let discountId = customer.metafield?.value;

    const discountCode = `PTS-${email.split("@")[0].toUpperCase()}`;

    console.log("🎟️ Discount Code:", discountCode);
    console.log("🆔 Existing Discount ID:", discountId);

    /* ----------------------------------------------
       CREATE OR UPDATE DISCOUNT
    ---------------------------------------------- */
    if (!discountId) {
      console.log("➕ Creating new discount");

      const createRes = await admin.graphql(
        `
        mutation ($input: DiscountCodeBasicInput!) {
          discountCodeBasicCreate(basicCodeDiscount: $input) {
            codeDiscountNode {
              id
            }
            userErrors {
              message
            }
          }
        }
        `,
        {
          variables: {
            input: {
              title: discountCode,
              code: discountCode,
              startsAt: new Date().toISOString(),
              customerSelection: {
                customers: { add: [shopifyCustomerId] },
              },
              customerGets: {
                items: { all: true },
                value: {
                  discountAmount: {
                    amount: String(coins),
                    appliesOnEachItem: false,
                  },
                },
              },
              usageLimit: 1000,
              appliesOncePerCustomer: false,
              combinesWith: {
                shippingDiscounts: true,
                orderDiscounts: false,
                productDiscounts: false,
              },
            },
          },
        }
      );

      const createJson = await createRes.json();

      const errors =
        createJson.data.discountCodeBasicCreate.userErrors;

      if (errors.length) {
        console.error(errors);
        throw new Error(errors[0].message);
      }

      discountId =
        createJson.data.discountCodeBasicCreate.codeDiscountNode.id;

      console.log("✅ Created Discount ID:", discountId);
    } else {
      console.log("✏️ Updating existing discount");

      const updateRes = await admin.graphql(
        `
        mutation ($id: ID!, $input: DiscountCodeBasicInput!) {
          discountCodeBasicUpdate(id: $id, basicCodeDiscount: $input) {
            userErrors {
              message
            }
          }
        }
        `,
        {
          variables: {
            id: discountId,
            input: {
              customerGets: {
                items: { all: true },
                value: {
                  discountAmount: {
                    amount: String(coins),
                    appliesOnEachItem: false,
                  },
                },
              },
            },
          },
        }
      );

      const updateJson = await updateRes.json();

      const errors =
        updateJson.data.discountCodeBasicUpdate.userErrors;

      if (errors.length) {
        console.error(errors);
        throw new Error(errors[0].message);
      }

      console.log("✅ Discount updated");
    }

    /* ----------------------------------------------
       UPDATE CUSTOMER METAFIELDS
    ---------------------------------------------- */
    console.log("🧾 Updating metafields");

    await admin.graphql(
      `
      mutation ($input: CustomerInput!) {
        customerUpdate(input: $input) {
          userErrors { message }
        }
      }
      `,
      {
        variables: {
          input: {
            id: shopifyCustomerId,
            metafields: [
              {
                namespace: "custom",
                key: "coins",
                type: "single_line_text_field",
                value: String(availablePoints),
              },
              {
                namespace: "custom",
                key: "discount_code",
                type: "single_line_text_field",
                value: discountCode,
              },
              {
                namespace: "custom",
                key: "discount_id",
                type: "single_line_text_field",
                value: discountId,
              },
            ],
          },
        },
      }
    );

    console.log("✅ Sync completed");

    /* ----------------------------------------------
       RESPONSE
    ---------------------------------------------- */
    return Response.json({
      success: true,
      employeeID,
      employeeName,
      availablePoints,
      totalEarnedPoints,
      redeemedPoints,
      addedPoints,
      coins,
      discountCode,
    });
  } catch (error) {
    console.error("❌ Proxy Error:", error);

    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/* ======================================================
   LOGIN FUNCTION
====================================================== */
async function loginAndGetToken() {
  console.log("🔐 Logging into Rewards API");

  const res = await fetch(`${BASE_URL}/Authentication/Login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      Username: USERNAME,
      Password: PASSWORD,
    }),
  });

  if (!res.ok) {
    throw new Error("Rewards API login failed");
  }

  const data = await res.json();

  console.log("🔑 Token received");

  return data.token;
}