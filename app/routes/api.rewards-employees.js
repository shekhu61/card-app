import { getToken, setToken } from "../utils/rewardsToken.server";

/* ========================================================
   ENV CONFIG
======================================================== */
const SHOP = process.env.SHOPIFY_SHOP_DOMAIN;
const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const FLOW_SECRET = process.env.FLOW_SECRET;

if (!SHOP || !ACCESS_TOKEN) {
  throw new Error("❌ Missing Shopify environment variables");
}

/* ========================================================
   LOGIN TO REWARDS API
======================================================== */
async function login() {
  console.log("🔐 Logging into Rewards API");

  const res = await fetch(
    "https://stg-rewardsapi.centerforautism.com/Authentication/Login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Username: "admin",
        Password: "admin",
      }),
    }
  );

  const text = await res.text();
  if (!text) throw new Error("❌ Empty login response");

  const data = JSON.parse(text);
  if (!data?.token) throw new Error("❌ Rewards login failed");

  setToken(data.token, 3600);
  console.log("✅ Rewards token stored");

  return data.token;
}

/* ========================================================
   SAFE FETCH WITH AUTO TOKEN REFRESH
======================================================== */
async function fetchWithAuth(url) {
  let token = getToken();
  if (!token) token = await login();

  let res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    console.log("🔄 Rewards token expired, re-login");
    token = await login();
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/* ========================================================
   FETCH ALL EMPLOYEES (PAGINATED)
======================================================== */
async function fetchAllEmployees(pageSize = 20) {
  let page = 1;
  let hasMore = true;
  let employees = [];

  while (hasMore) {
    const url =
      `https://stg-rewardsapi.centerforautism.com/CardShopWrapper/EmployeeDetails` +
      `?PageNumber=${page}&PageSize=${pageSize}&FromDate=2025-01-01&ToDate=2025-12-31`;

    const res = await fetchWithAuth(url);

    const records = Array.isArray(res?.data)
      ? res.data
      : Array.isArray(res)
      ? res
      : [];

    employees.push(...records);

    if (records.length < pageSize) {
      hasMore = false;
    } else {
      page++;
    }
  }

  return employees;
}

/* ========================================================
   SHOPIFY GRAPHQL HELPER
======================================================== */
async function shopifyGraphQL(query, variables = {}) {
  const res = await fetch(
    `https://${SHOP}/admin/api/2024-01/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ACCESS_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    }
  );

  return res.json();
}

/* ========================================================
   REMIX ACTION — SHOPIFY FLOW ENTRY POINT
======================================================== */
export async function action({ request }) {
  console.log("🚀 Shopify Flow → Rewards Sync Triggered");

  /* =========================
     SECURITY CHECK
     ========================= */
  const body = await request.json();

  if (body?.secret !== FLOW_SECRET) {
    console.log("❌ Unauthorized Flow request");
    return new Response("Unauthorized", { status: 401 });
  }

  console.log("✅ Flow authorized");

  /* =========================
     FETCH EMPLOYEES
     ========================= */
  const employees = await fetchAllEmployees();
  console.log(`✅ Employees fetched: ${employees.length}`);

  const results = [];

  /* =========================
     CREATE SHOPIFY CUSTOMERS
     ========================= */
  for (const emp of employees) {
    const {
      firstName,
      lastName,
      emailAddress,
      employeeID,
    } = emp;

    if (!emailAddress) {
      results.push({
        status: "skipped",
        reason: "Missing email",
      });
      continue;
    }

    try {
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

      const input = {
        firstName,
        lastName,
        email: emailAddress,
        tags: ["pts"],
        metafields: [
          {
            namespace: "custom",
            key: "employeeid",
            type: "single_line_text_field",
            value: String(employeeID),
          },
        ],
      };

      const result = await shopifyGraphQL(mutation, { input });

      /* ===== GRAPHQL HARD FAIL ===== */
      if (result.errors) {
        console.error("❌ Shopify GraphQL error:", result.errors);

        results.push({
          email: emailAddress,
          status: "failed",
          errors: result.errors,
        });
        continue;
      }

      const createResult = result.data?.customerCreate;

      if (!createResult) {
        results.push({
          email: emailAddress,
          status: "failed",
          error: "customerCreate missing in response",
        });
        continue;
      }

      if (createResult.userErrors.length > 0) {
        results.push({
          email: emailAddress,
          status: "failed",
          errors: createResult.userErrors,
        });
      } else {
        results.push({
          email: emailAddress,
          status: "created",
          shopifyCustomerId: createResult.customer.id,
        });
      }
    } catch (error) {
      console.error("❌ Unexpected error:", error);

      results.push({
        email: emailAddress,
        status: "error",
        error: error.message,
      });
    }
  }

  /* =========================
     FINAL RESPONSE
     ========================= */
  return Response.json({
    success: true,
    totalEmployees: employees.length,
    totalProcessed: results.length,
    results,
  });
}
