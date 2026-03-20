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
   FETCH ALL EMPLOYEES
======================================================== */
async function fetchAllEmployees(pageSize = 50) {
  let page = 1;
  let hasMore = true;
  let employees = [];

  while (hasMore) {
    const url =
      `https://rewardsapi.centerforautism.com/CardShopWrapper/EmployeeDetails` +
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
   GET CUSTOMER BY EMAIL
======================================================== */
async function getCustomerByEmail(email) {
  const query = `
    query getCustomer($query: String!) {
      customers(first: 1, query: $query) {
        edges {
          node {
            id
            email
            tags
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
   UPDATE CUSTOMER
======================================================== */
async function updateCustomer(customerId, existingTags = [], employeeID) {
  const mutation = `
    mutation updateCustomer($input: CustomerInput!) {
      customerUpdate(input: $input) {
        customer { id email tags }
        userErrors { field message }
      }
    }
  `;

  const tagsSet = new Set(existingTags || []);
  tagsSet.add("pts"); // ensure pts tag exists

  const input = {
    id: customerId,
    tags: Array.from(tagsSet),
    metafields: [
      {
        namespace: "custom",
        key: "employeeid",
        type: "single_line_text_field",
        value: String(employeeID),
      },
      {
        namespace: "custom",
        key: "office_location",
        type: "single_line_text_field",
        value: "US ME Portland ME",
      },
    ],
  };

  return shopifyGraphQL(mutation, { input });
}

/* ========================================================
   CREATE CUSTOMER
======================================================== */
async function createCustomer(firstName, lastName, email, employeeID) {
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
    email,
    tags: ["pts"],
    metafields: [
      {
        namespace: "custom",
        key: "employeeid",
        type: "single_line_text_field",
        value: String(employeeID),
      },
      {
        namespace: "custom",
        key: "office_location",
        type: "single_line_text_field",
        value: "US ME Portland ME",
      },
    ],
  };

  return shopifyGraphQL(mutation, { input });
}

/* ========================================================
   BACKGROUND SYNC
======================================================== */
async function runEmployeeSync() {
  console.log("🔄 Background sync started");

  const employees = await fetchAllEmployees();

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const emp of employees) {
    const { firstName, lastName, emailAddress, employeeID } = emp;

    if (!emailAddress) continue;

    try {
      const existingCustomer = await getCustomerByEmail(emailAddress);

      if (existingCustomer) {
        const result = await updateCustomer(
          existingCustomer.id,
          existingCustomer.tags,
          employeeID
        );

        const errors = result?.data?.customerUpdate?.userErrors;
        if (errors?.length) failed++;
        else updated++;

        continue;
      }

      const result = await createCustomer(
        firstName,
        lastName,
        emailAddress,
        employeeID
      );

      const errors = result?.data?.customerCreate?.userErrors;
      if (errors?.length) failed++;
      else created++;

    } catch (err) {
      console.error("❌ Sync error:", err.message);
      failed++;
    }
  }

  console.log("🎉 Sync Completed", { created, updated, failed });
}

/* ========================================================
   REMIX ACTION (SHOPIFY FLOW)
======================================================== */
export async function action({ request }) {
  console.log("🚀 Shopify Flow Triggered");

  const body = await request.json();

  if (body?.secret !== FLOW_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const response = new Response(
    JSON.stringify({
      success: true,
      message: "Employee sync started in background",
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );

  setTimeout(() => {
    runEmployeeSync().catch((err) =>
      console.error("🔥 Background crashed:", err)
    );
  }, 0);

  return response;
}