import { authenticate } from "../shopify.server";
import prisma from "../db.server"; // Make sure this path points to your Prisma instance

/* ======================================================
   HARD-CODED REWARDS API CONFIG (NO ENV)
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

    console.log("🆔 Employee ID:", employeeId);
    console.log("📧 Customer Email:", email);

    if (!employeeId || !email) {
      return Response.json(
        { error: "Employee ID or email missing" },
        { status: 400 }
      );
    }

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
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!pointsRes.ok) {
      throw new Error("Employee points API failed");
    }

    const pointsData = await pointsRes.json();

    console.log("✅ Employee Points Result:", pointsData);

    /* ----------------------------------------------
       FETCH DEFAULT EMPLOYEE (ID = 18237) POINTS
    ---------------------------------------------- */
    const defaultEmployeeRes = await fetch(
      `${BASE_URL}/CardShopWrapper/GetEmployeeAddedPointsById?EmployeeID=${employeeId}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!defaultEmployeeRes.ok) {
      throw new Error("Default employee points API failed");
    }

    const defaultEmployeePoints = await defaultEmployeeRes.json();

    console.log(
      "📊 Default Employee (ID=18237) Points:",
      defaultEmployeePoints
    );

    const {
      employeeID,
      employeeName,
      availablePoints,
      totalEarnedPoints,
      redeemedPoints,
      addedPoints,
    } = pointsData;

    /* ----------------------------------------------
       FETCH ACTIVE REWARD RULE FROM DB
    ---------------------------------------------- */
    const rewardRule = await prisma.rewardRule.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (!rewardRule) {
      throw new Error("No active reward rule found");
    }

   /* ----------------------------------------------
   CALCULATE DISCOUNT USING AP (a, d)
---------------------------------------------- */

const { basePoints: a, difference: d } = rewardRule;

if (typeof a !== "number" || typeof d !== "number") {
  throw new Error("Invalid reward rule configuration");
}

const points = Number(availablePoints) || 0;

let slab = 0;

// Step 1: Find base slab (n)
if (points >= a) {
  slab = Math.floor((points - a) / d) + 1;
}

// Step 2: Handle decimal threshold (like 2.75 → next slab)
const currentSlabPoints = a + (slab - 1) * d;
const remainingPoints = points - currentSlabPoints;

if (remainingPoints >= d * 0.75) {
  slab += 1;
}

// Step 3: Final discount (₹ / $ equivalent)
const coins = Math.max(0, slab);

console.log(`💰 AP Discount calculated: ${coins}`);


    /* ----------------------------------------------
       FETCH SHOPIFY CUSTOMER ID BY EMAIL
    ---------------------------------------------- */
    const customerRes = await admin.graphql(
      `
      query ($query: String!) {
        customers(first: 1, query: $query) {
          nodes { id }
        }
      }
      `,
      { variables: { query: `email:${email}` } }
    );

    const customerData = await customerRes.json();
    const shopifyCustomerId = customerData.data.customers.nodes[0]?.id;

    if (!shopifyCustomerId) {
      throw new Error("Shopify customer not found");
    }

    /* ----------------------------------------------
       DISCOUNT CODE LOGIC
    ---------------------------------------------- */
    const discountCode = `PTS-${email.split("@")[0].toUpperCase()}`;
    console.log("🎟️ Discount Code:", discountCode);

    const discountSearchRes = await admin.graphql(
      `
      query ($query: String!) {
        codeDiscountNodes(first: 10, query: $query) {
          nodes {
            id
            codeDiscount {
              ... on DiscountCodeBasic {
                codes(first: 10) { nodes { code } }
              }
            }
          }
        }
      }
      `,
      { variables: { query: `code:${discountCode}` } }
    );

    const discountSearchData = await discountSearchRes.json();

    let discountNode = null;

    for (const node of discountSearchData.data.codeDiscountNodes.nodes) {
      const codes = node.codeDiscount?.codes?.nodes || [];
      if (codes.some((c) => c.code === discountCode)) {
        discountNode = node;
        break;
      }
    }

    if (!discountNode) {
      console.log("➕ Creating discount");

      await admin.graphql(
        `
        mutation ($input: DiscountCodeBasicInput!) {
          discountCodeBasicCreate(basicCodeDiscount: $input) {
            userErrors { message }
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
            },
          },
        }
      );
    } else {
      console.log("✏️ Updating discount");

      await admin.graphql(
        `
        mutation ($id: ID!, $input: DiscountCodeBasicInput!) {
          discountCodeBasicUpdate(id: $id, basicCodeDiscount: $input) {
            userErrors { message }
          }
        }
        `,
        {
          variables: {
            id: discountNode.id,
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
    }

    /* ----------------------------------------------
       UPDATE CUSTOMER METAFIELDS
    ---------------------------------------------- */
    console.log("🧾 Updating customer metafields");

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
            ],
          },
        },
      }
    );

    console.log("✅ Sync completed for", email);

    /* ----------------------------------------------
       FINAL RESPONSE
    ---------------------------------------------- */
    return Response.json({
      success: true,

      employeeID,
      employeeName,

      availablePoints,
      totalEarnedPoints,
      redeemedPoints,
      addedPoints,

      email,
      coins,
      discountCode,
      defaultEmployeePoints,
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
   REWARDS LOGIN
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
