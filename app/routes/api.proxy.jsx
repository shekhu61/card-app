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
       LOGIN → TOKEN
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

    console.log("💰 Coins:", coins);

    /* ----------------------------------------------
       GET SHOPIFY CUSTOMER
    ---------------------------------------------- */
    const customer = await getCustomerByEmail(admin, email);

    if (!customer?.id) {
      throw new Error("Customer not found");
    }

    const shopifyCustomerId = customer.id;

    /* ----------------------------------------------
       DISCOUNT CODE
    ---------------------------------------------- */
    const discountCode = `PTS-${email.split("@")[0].toUpperCase()}`;

    /* ----------------------------------------------
       CHECK EXISTING DISCOUNT ID (METAFIELD)
    ---------------------------------------------- */
    let discountId = getMetafieldValue(customer, "discount_id");

    if (!discountId) {
      console.log("➕ Creating new discount");

      const createRes = await admin.graphql(
        `
        mutation ($input: DiscountCodeBasicInput!) {
          discountCodeBasicCreate(basicCodeDiscount: $input) {
            discountCodeBasic { id }
            userErrors { message }
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

      const json = await createRes.json();

      if (json.data.discountCodeBasicCreate.userErrors.length) {
        throw new Error(
          JSON.stringify(json.data.discountCodeBasicCreate.userErrors)
        );
      }

      discountId = json.data.discountCodeBasicCreate.discountCodeBasic.id;
    } else {
      console.log("✏️ Updating existing discount");

      const updateRes = await admin.graphql(
        `
        mutation ($id: ID!, $input: DiscountCodeBasicInput!) {
          discountCodeBasicUpdate(id: $id, basicCodeDiscount: $input) {
            userErrors { message }
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

      const json = await updateRes.json();

      if (json.data.discountCodeBasicUpdate.userErrors.length) {
        throw new Error(
          JSON.stringify(json.data.discountCodeBasicUpdate.userErrors)
        );
      }
    }

    /* ----------------------------------------------
       UPDATE CUSTOMER METAFIELDS
    ---------------------------------------------- */
    await updateCustomerMetafields(admin, shopifyCustomerId, [
      {
        key: "coins",
        value: String(availablePoints),
      },
      {
        key: "discount_code",
        value: discountCode,
      },
      {
        key: "discount_id",
        value: discountId,
      },
    ]);

    console.log("✅ Sync complete");

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
          metafields(first: 10) {
            nodes { key value }
          }
        }
      }
    }
    `,
    { variables: { query: `email:${email}` } }
  );

  const json = await res.json();
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