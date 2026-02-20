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
async function fetchAllEmployees(pageSize = 50) {
  let page = 1;
  let hasMore = true;
  let employees = [];

  while (hasMore) {
    console.log(`📄 Fetching page ${page}`);

    const url =
      `https://stg-rewardsapi.centerforautism.com/CardShopWrapper/EmployeeDetails` +
      `?PageNumber=${page}&PageSize=${pageSize}&FromDate=2019-01-01&ToDate=2026-12-31`;

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

  console.log(`👥 Total employees fetched: ${employees.length}`);
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
   CHECK IF CUSTOMER EXISTS
======================================================== */
async function getCustomerByEmail(email) {
  const query = `
    query getCustomer($query: String!) {
      customers(first: 1, query: $query) {
        edges {
          node {
            id
            email
          }
        }
      }
    }
  `;

  const result = await shopifyGraphQL(query, {
    query: `email:${email}`,
  });

  return result?.data?.customers?.edges?.[0]?.node || null;
}

/* ========================================================
   BACKGROUND SYNC FUNCTION
======================================================== */
async function runEmployeeSync() {
  console.log("🔄 Background sync started");

  const employees = await fetchAllEmployees();

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const emp of employees) {
    const { firstName, lastName, emailAddress, employeeID } = emp;

    if (!emailAddress) {
      console.log("⏭ Skipped (missing email)");
      skipped++;
      continue;
    }

    try {
      // ✅ Skip if exists
      const existingCustomer = await getCustomerByEmail(emailAddress);

      if (existingCustomer) {
        console.log(`⏭ Already exists → ${emailAddress}`);
        skipped++;
        continue;
      }

      const mutation = `
        mutation createCustomer($input: CustomerInput!) {
          customerCreate(input: $input) {
            customer { id email }
            userErrors { field message }
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

      if (result.errors) {
        console.log("❌ GraphQL error:", result.errors);
        failed++;
        continue;
      }

      const userErrors = result?.data?.customerCreate?.userErrors;

      if (userErrors?.length > 0) {
        console.log("⚠️ User error:", userErrors);
        failed++;
      } else {
        console.log(`✅ Created → ${emailAddress}`);
        created++;
      }
    } catch (err) {
      console.log("❌ Unexpected error:", err.message);
      failed++;
    }
  }

  console.log("🎉 Sync Completed");
  console.log("📊 Summary:", {
    total: employees.length,
    created,
    skipped,
    failed,
  });
}

/* ========================================================
   REMIX ACTION — SHOPIFY FLOW ENTRY POINT
======================================================== */
export async function action({ request }) {
  console.log("🚀 Shopify Flow Triggered");

  const body = await request.json();

  if (body?.secret !== FLOW_SECRET) {
    console.log("❌ Unauthorized request");
    return new Response("Unauthorized", { status: 401 });
  }

  console.log("✅ Flow authorized");

  // 🔥 Immediately return success to prevent retry
  const response = Response.json({
    success: true,
    message: "Employee sync started in background",
  });

  // 🚀 Run background job
  setTimeout(() => {
    runEmployeeSync().catch((err) => {
      console.error("🔥 Background sync crashed:", err);
    });
  }, 0);

  return response;
}
