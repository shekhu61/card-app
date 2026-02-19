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

  if (!data || !data.token) {
    throw new Error("Rewards login failed");
  }

  setToken(data.token, 3600);
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
async function fetchAllEmployees(pageSize = 20) {
  let page = 1;
  let hasMore = true;
  const employees = [];

  while (hasMore) {
    const url =
      "https://stg-rewardsapi.centerforautism.com/CardShopWrapper/EmployeeDetails" +
      `?PageNumber=${page}&PageSize=${pageSize}&FromDate=2019-01-01&ToDate=2026-12-31`;

    const res = await fetchWithAuth(url);

    const records = Array.isArray(res && res.data)
      ? res.data
      : Array.isArray(res)
      ? res
      : [];

    employees.push.apply(employees, records);

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
async function shopifyGraphQL(query, variables) {
  const res = await fetch(
    `https://${SHOP}/admin/api/2024-01/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ACCESS_TOKEN,
      },
      body: JSON.stringify({ query: query, variables: variables || {} }),
    }
  );

  return res.json();
}

/* ========================================================
   CHECK IF CUSTOMER EXISTS
======================================================== */
async function getCustomerByEmail(email) {
  const query = `
    query {
      customers(first: 1, query: "email:${email}") {
        edges {
          node {
            id
          }
        }
      }
    }
  `;

  const result = await shopifyGraphQL(query);

  const edges =
    result &&
    result.data &&
    result.data.customers &&
    result.data.customers.edges;

  if (edges && edges.length > 0) {
    return edges[0].node;
  }

  return null;
}

/* ========================================================
   REMIX ACTION — SHOPIFY FLOW ENTRY POINT
======================================================== */
export async function action({ request }) {
  console.log("Rewards sync running");

  try {
    const body = await request.json();

    if (!body || body.secret !== FLOW_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    const employees = await fetchAllEmployees();

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];

      if (!emp || !emp.emailAddress) continue;

      const existing = await getCustomerByEmail(emp.emailAddress);

      if (existing) continue;

      const mutation = `
        mutation {
          customerCreate(input: {
            firstName: "${emp.firstName || ""}"
            lastName: "${emp.lastName || ""}"
            email: "${emp.emailAddress}"
            tags: ["pts"]
            metafields: [{
              namespace: "custom"
              key: "employeeid"
              type: "single_line_text_field"
              value: "${emp.employeeID || ""}"
            }]
          }) {
            customer { id }
            userErrors { field message }
          }
        }
      `;

      await shopifyGraphQL(mutation);
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ success: true });
  }
}
