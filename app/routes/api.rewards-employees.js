import { getToken, setToken } from "../utils/rewardsToken.server";

/* ========================================================
   ENV CONFIG
======================================================== */
const SHOP = process.env.SHOPIFY_SHOP_DOMAIN;
const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const FLOW_SECRET = process.env.FLOW_SECRET;

if (!SHOP || !ACCESS_TOKEN) {
  throw new Error("Missing Shopify environment variables");
}

/* ========================================================
   LOGIN TO REWARDS API
======================================================== */
async function login() {
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

  const data = await res.json();
  if (!data || !data.token) throw new Error("Login failed");

  setToken(data.token, 3600);
  return data.token;
}

/* ========================================================
   SAFE FETCH
======================================================== */
async function fetchWithAuth(url) {
  let token = getToken();
  if (!token) token = await login();

  let res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    token = await login();
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  return res.json();
}

/* ========================================================
   FETCH ALL EMPLOYEES
======================================================== */
async function fetchAllEmployees(pageSize = 100) {
  let page = 1;
  let hasMore = true;
  const employees = [];

  while (hasMore) {
    const url =
      "https://stg-rewardsapi.centerforautism.com/CardShopWrapper/EmployeeDetails" +
      `?PageNumber=${page}&PageSize=${pageSize}&FromDate=2019-01-01&ToDate=2026-12-31`;

    const res = await fetchWithAuth(url);
    const records = Array.isArray(res?.data) ? res.data : [];

    employees.push(...records);

    if (records.length < pageSize) hasMore = false;
    else page++;
  }

  return employees;
}

/* ========================================================
   SHOPIFY GRAPHQL
======================================================== */
async function shopifyGraphQL(query, variables) {
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
   FETCH EXISTING SHOPIFY CUSTOMERS (TAG: pts)
======================================================== */
async function fetchExistingCustomers() {
  let hasNextPage = true;
  let cursor = null;
  const existingEmails = new Set();

  while (hasNextPage) {
    const query = `
      query ($cursor: String) {
        customers(first: 250, after: $cursor, query: "tag:pts") {
          edges {
            cursor
            node { email }
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    `;

    const result = await shopifyGraphQL(query, { cursor });

    const edges = result.data.customers.edges;

    edges.forEach(edge => {
      if (edge.node.email) {
        existingEmails.add(edge.node.email.toLowerCase());
      }
    });

    hasNextPage = result.data.customers.pageInfo.hasNextPage;
    cursor = hasNextPage ? edges[edges.length - 1].cursor : null;
  }

  return existingEmails;
}

/* ========================================================
   CREATE CUSTOMERS IN BATCH
======================================================== */
async function createCustomersBatch(customers) {
  const mutation = `
    mutation customerCreate($input: CustomerInput!) {
      customerCreate(input: $input) {
        customer { id }
        userErrors { message }
      }
    }
  `;

  for (let i = 0; i < customers.length; i++) {
    await shopifyGraphQL(mutation, { input: customers[i] });
  }
}

/* ========================================================
   FLOW ACTION
======================================================== */
export async function action({ request }) {
  console.log("Rewards sync running");

  try {
    const body = await request.json();
    if (!body || body.secret !== FLOW_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    const employees = await fetchAllEmployees();
    const existingEmails = await fetchExistingCustomers();

    const customersToCreate = [];

    for (let emp of employees) {
      if (!emp.emailAddress) continue;

      const email = emp.emailAddress.toLowerCase();

      if (existingEmails.has(email)) continue;

      customersToCreate.push({
        firstName: emp.firstName || "",
        lastName: emp.lastName || "",
        email: email,
        tags: ["pts"],
        metafields: [
          {
            namespace: "custom",
            key: "employeeid",
            type: "single_line_text_field",
            value: String(emp.employeeID || ""),
          },
        ],
      });
    }

    await createCustomersBatch(customersToCreate);

    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ success: true });
  }
}
