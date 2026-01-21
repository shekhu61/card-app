import { authenticate } from "../shopify.server";
import { getToken, setToken } from "../utils/rewardsToken.server";

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

  const text = await res.text();
  if (!text) throw new Error("Empty login response");

  const data = JSON.parse(text);
  if (!data?.token) throw new Error("Login failed");

  setToken(data.token, 3600);
  return data.token;
}

/* ========================================================
   SAFE FETCH WITH TOKEN AUTO-REFRESH
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

  const text = await res.text();
  if (!text) return null;

  return JSON.parse(text);
}

/* ========================================================
   FETCH ALL EMPLOYEES (PAGINATED)
======================================================== */
async function fetchAllEmployees(pageSize = 20) {
  let page = 1;
  let hasMore = true;
  let allEmployees = [];

  while (hasMore) {
    const url =
      `https://stg-rewardsapi.centerforautism.com/CardShopWrapper/EmployeeDetails` +
      `?PageNumber=${page}&PageSize=${pageSize}&FromDate=2025-03-01&ToDate=2025-12-31`;

    const res = await fetchWithAuth(url);

    const records = Array.isArray(res?.data)
      ? res.data
      : Array.isArray(res)
      ? res
      : [];

    allEmployees.push(...records);

    if (records.length < pageSize) {
      hasMore = false;
    } else {
      page++;
    }
  }

  return allEmployees;
}

/* ========================================================
   REMIX ACTION
======================================================== */
export async function action({ request }) {
  console.log("🔹 Sync employees → Shopify started");

  // 🔐 Protect route
  const { admin } = await authenticate.admin(request);

  /* =========================
     1️⃣ FETCH EMPLOYEES
     ========================= */
  const employees = await fetchAllEmployees();
  console.log(`✅ Total employees fetched: ${employees.length}`);

  /* =========================
     2️⃣ CREATE SHOPIFY CUSTOMERS
     ========================= */
  const results = [];

  for (const emp of employees) {
    const {
      firstName,
      lastName,
      emailAddress,
    } = emp;

    if (!emailAddress) {
      results.push({
        email: null,
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

const response = await admin.graphql(mutation, {
  variables: {
    input: {
      firstName,
      lastName,
      email: emailAddress,
      tags: ["pts"],
      metafields: [
        {
          namespace: "custom",
          key: "employeeid",
          type: "single_line_text_field",
          value: String(emp.employeeID),
        },
      ],
    },
  },
});


      const result = await response.json();

      if (result?.data?.customerCreate?.userErrors?.length > 0) {
        results.push({
          email: emailAddress,
          status: "failed",
          errors: result.data.customerCreate.userErrors,
        });
      } else {
        results.push({
          email: emailAddress,
          status: "created",
          shopifyCustomerId:
            result.data.customerCreate.customer.id,
        });
      }
    } catch (error) {
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
