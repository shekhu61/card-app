import { authenticate } from "../shopify.server";
import prisma from "../db.server";

/* ======================================================
   CONFIG
====================================================== */
const BASE_URL = "https://rewardsapi.centerforautism.com";
const USERNAME = "admin";
const PASSWORD = "admin";

/* ======================================================
   MAIN ACTION
====================================================== */
export async function action({ request }) {
  console.log("🔵 App Proxy hit");

  try {
    const { admin } = await authenticate.public.appProxy(request);

    const { employeeId, email } = await request.json();

    if (!employeeId || !email) {
      return Response.json(
        { error: "Employee ID or email missing" },
        { status: 400 }
      );
    }

    /* ----------------------------------------------
       LOGIN
    ---------------------------------------------- */
    const token = await loginAndGetToken();

    /* ----------------------------------------------
       FETCH POINTS
    ---------------------------------------------- */
    const [pointsData, defaultEmployeePoints] = await Promise.all([
      fetchAPI(`/CardShopWrapper/GetEmployeePoints?EmployeeID=${employeeId}`, token),
      fetchAPI(`/CardShopWrapper/GetEmployeeAddedPointsById?EmployeeID=${employeeId}`, token),
    ]);

    const {
      employeeID,
      employeeName,
      availablePoints,
      totalEarnedPoints,
      redeemedPoints,
      addedPoints,
    } = pointsData;

    /* ----------------------------------------------
       REWARD RULE
    ---------------------------------------------- */
    const rewardRule = await prisma.rewardRule.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (!rewardRule?.basePoints) {
      throw new Error("Invalid reward rule");
    }

    const points = Number(availablePoints) || 0;
    const coins = (points / rewardRule.basePoints).toFixed(2);

    if (Number(coins) <= 0) {
      throw new Error("Invalid discount amount (coins <= 0)");
    }

    console.log("💰 Coins:", coins);

    /* ----------------------------------------------
       GET CUSTOMER
    ---------------------------------------------- */
    const customer = await getCustomerByEmail(admin, email);

    if (!customer?.id) {
      throw new Error("Customer not found");
    }

    const shopifyCustomerId = customer.id;
    let discountId = getMetafieldValue(customer, "discount_id");

    const discountCode = `PTS-${email.split("@")[0].toUpperCase()}`;

    /* ----------------------------------------------
       CREATE OR UPDATE DISCOUNT
    ---------------------------------------------- */
    if (!discountId) {
      console.log("➕ Creating discount");

      const res = await admin.graphql(
        `
        mutation ($input: DiscountCodeBasicInput!) {
          discountCodeBasicCreate(basicCodeDiscount: $input) {
            discountCodeBasic { id }
            userErrors { field message }
          }
        }
        `,
        {
          variables: {
            input: buildDiscountInput({
              discountCode,
              shopifyCustomerId,
              coins,
            }),
          },
        }
      );

      const json = await res.json();
      console.log("📦 CREATE RESPONSE:", JSON.stringify(json, null, 2));

      handleGraphQLErrors(json);

      const errors = json.data.discountCodeBasicCreate.userErrors;
      if (errors.length) {
        const msg = errors.map((e) => e.message).join(", ");

        // Handle duplicate code
        if (msg.toLowerCase().includes("already")) {
          throw new Error(
            "Discount already exists but discount_id metafield is missing"
          );
        }

        throw new Error(msg);
      }

      discountId =
        json.data.discountCodeBasicCreate.discountCodeBasic.id;
    } else {
      console.log("✏️ Updating discount");

      const res = await admin.graphql(
        `
        mutation ($id: ID!, $input: DiscountCodeBasicInput!) {
          discountCodeBasicUpdate(id: $id, basicCodeDiscount: $input) {
            userErrors { field message }
          }
        }
        `,
        {
          variables: {
            id: discountId,
            input: {
              title: discountCode,
              startsAt: new Date().toISOString(),
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

      const json = await res.json();
      console.log("📦 UPDATE RESPONSE:", JSON.stringify(json, null, 2));

      handleGraphQLErrors(json);

      const errors = json.data.discountCodeBasicUpdate.userErrors;
      if (errors.length) {
        throw new Error(errors.map((e) => e.message).join(", "));
      }
    }

    /* ----------------------------------------------
       UPDATE METAFIELDS
    ---------------------------------------------- */
    await updateCustomerMetafields(admin, shopifyCustomerId, [
      { key: "coins", value: String(availablePoints) },
      { key: "discount_code", value: discountCode },
      { key: "discount_id", value: discountId },
    ]);

    console.log("✅ Sync complete");

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
   HELPERS
====================================================== */

function handleGraphQLErrors(json) {
  if (json.errors) {
    console.error("❌ GraphQL Errors:", JSON.stringify(json.errors, null, 2));
    throw new Error("GraphQL top-level error");
  }
}

async function fetchAPI(endpoint, token) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`API failed: ${endpoint}`);

  return res.json();
}

async function getCustomerByEmail(admin, email) {
  const res = await admin.graphql(
    `
    query ($query: String!) {
      customers(first: 1, query: $query) {
        nodes {
          id
          metafields(first: 20) {
            nodes { key value }
          }
        }
      }
    }
    `,
    { variables: { query: `email:${email}` } }
  );

  const json = await res.json();
  handleGraphQLErrors(json);

  return json.data.customers.nodes[0];
}

function getMetafieldValue(customer, key) {
  return (
    customer.metafields?.nodes?.find((m) => m.key === key)?.value || null
  );
}

function buildDiscountInput({ discountCode, shopifyCustomerId, coins }) {
  return {
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
  };
}

async function updateCustomerMetafields(admin, customerId, metafields) {
  const res = await admin.graphql(
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
          id: customerId,
          metafields: metafields.map((m) => ({
            namespace: "custom",
            key: m.key,
            type: "single_line_text_field",
            value: m.value,
          })),
        },
      },
    }
  );

  const json = await res.json();
  handleGraphQLErrors(json);
}

/* ======================================================
   LOGIN
====================================================== */
async function loginAndGetToken() {
  const res = await fetch(`${BASE_URL}/Authentication/Login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      Username: USERNAME,
      Password: PASSWORD,
    }),
  });

  if (!res.ok) throw new Error("Rewards login failed");

  const data = await res.json();
  return data.token;
}