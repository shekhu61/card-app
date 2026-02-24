import { authenticate } from "../shopify.server";
import prisma from "../db.server";

/* ======================================================
   HARD-CODED REWARDS API CONFIG (NO ENV)
====================================================== */
const BASE_URL = "https://stg-rewardsapi.centerforautism.com";
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
    console.log("📧 Customer Email:", email);

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

    const {
      employeeID,
      employeeName,
      availablePoints,
      totalEarnedPoints,
      redeemedPoints,
      addedPoints,
    } = pointsData;

    console.log("✅ Employee Points:", pointsData);

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

    const { pointsPerUnit, currencyUnit } = rewardRule;

    const coins =
      ((availablePoints || 0) * currencyUnit) / pointsPerUnit;

    if (coins <= 0) {
      throw new Error("No discount available for this employee");
    }

    console.log(`💰 Order Discount Amount: $${coins}`);

    /* ----------------------------------------------
       FETCH SHOPIFY CUSTOMER ID
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
    const shopifyCustomerId =
      customerData.data.customers.nodes[0]?.id;

    if (!shopifyCustomerId) {
      throw new Error("Shopify customer not found");
    }

    /* ----------------------------------------------
       DISCOUNT CODE NAME
    ---------------------------------------------- */
    const discountCode = `PTS-${email
      .split("@")[0]
      .toUpperCase()}`;

    console.log("🎟️ Discount Code:", discountCode);

    /* ----------------------------------------------
       SEARCH EXISTING DISCOUNT
    ---------------------------------------------- */
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

    /* =====================================================
       CREATE ORDER DISCOUNT (NO LIMITS)
    ===================================================== */
    if (!discountNode) {
      console.log("➕ Creating Order Discount");

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

              // ✅ ORDER DISCOUNT STRUCTURE
              customerGets: {
                value: {
                  discountAmount: {
                    amount: String(coins),
                    appliesOnEachItem: false,
                  },
                },
              },

              appliesTo: {
                all: true,
              },

              // ❌ No usageLimit
              // ❌ No appliesOncePerCustomer
            },
          },
        }
      );
    }

    /* =====================================================
       UPDATE ORDER DISCOUNT
    ===================================================== */
    else {
      console.log("✏️ Updating Order Discount");

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
                value: {
                  discountAmount: {
                    amount: String(coins),
                    appliesOnEachItem: false,
                  },
                },
              },
              appliesTo: {
                all: true,
              },
            },
          },
        }
      );
    }

    /* ----------------------------------------------
       UPDATE CUSTOMER METAFIELDS
    ---------------------------------------------- */
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

  return data.token;
}