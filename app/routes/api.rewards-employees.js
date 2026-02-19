import { getToken, setToken } from "../utils/rewardsToken.server";

const SHOP = process.env.SHOPIFY_SHOP_DOMAIN;
const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const FLOW_SECRET = process.env.FLOW_SECRET;

if (!SHOP || !ACCESS_TOKEN) {
  throw new Error("Missing Shopify environment variables");
}

/* ================= LOGIN ================= */
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
  if (!data?.token) throw new Error("Login failed");

  setToken(data.token, 3600);
  return data.token;
}

/* ================= SAFE FETCH ================= */
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

/* ================= FETCH EMPLOYEES ================= */
async function fetchAllEmployees(pageSize = 200) {
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

/* ================= SHOPIFY GRAPHQL ================= */
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

/* ================= BACKGROUND PROCESS ================= */
async function processEmployees() {
  console.log("Background process started");

  try {
    const employees = await fetchAllEmployees();

    const mutation = `
      mutation customerCreate($input: CustomerInput!) {
        customerCreate(input: $input) {
          customer { id }
          userErrors { message }
        }
      }
    `;

    for (let emp of employees) {
      if (!emp.emailAddress) continue;

      const input = {
        firstName: emp.firstName || "",
        lastName: emp.lastName || "",
        email: emp.emailAddress,
        tags: ["pts"],
        metafields: [
          {
            namespace: "custom",
            key: "employeeid",
            type: "single_line_text_field",
            value: String(emp.employeeID || ""),
          },
        ],
      };

      await shopifyGraphQL(mutation, { input });

      // small delay to prevent throttling
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  } catch (err) {
    // silently fail (Flow already returned success)
  }
}

/* ================= FLOW ACTION ================= */
export async function action({ request }) {
  console.log("Rewards sync running");

  const body = await request.json();

  if (!body || body.secret !== FLOW_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Start background process (non-blocking)
  processEmployees();

  // Immediately respond to Flow
  return Response.json({ success: true });
}
