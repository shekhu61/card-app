import { authenticate } from "../shopify.server";
import { getToken, setToken } from "../utils/rewardsToken.server";

/* ========================================================
   🔐 LOGIN
======================================================== */
async function login() {
  console.log("🔐 [LOGIN] Starting login");

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

  console.log("🔐 [LOGIN] Status:", res.status);

  const text = await res.text();
  if (!text) throw new Error("Empty login response");

  const data = JSON.parse(text);
  if (!data?.token) throw new Error("Login failed");

  setToken(data.token, 3600);
  console.log("✅ [LOGIN] Token saved");

  return data.token;
}

/* ========================================================
   🌐 SAFE FETCH WITH TOKEN
======================================================== */
async function fetchWithAuth(url) {
  console.log("🌐 [FETCH] URL:", url);

  let token = getToken();
  if (!token) {
    console.log("🔁 [FETCH] No token found, logging in");
    token = await login();
  }

  let res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log("🌐 [FETCH] Status:", res.status);

  if (res.status === 401) {
    console.warn("⚠️ [FETCH] Token expired, retrying");
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
   📦 PHASE 1 — FETCH & STORE ALL EMPLOYEES
======================================================== */
async function fetchAllEmployees(pageSize = 50) {
  console.log("📦 [PHASE 1] Fetching all employees");

  let page = 1;
  let hasMore = true;
  let allEmployees = [];

  while (hasMore) {
    console.log(`📄 [PHASE 1] Fetching page ${page}`);

    const url =
      `https://stg-rewardsapi.centerforautism.com/CardShopWrapper/EmployeeDetails` +
      `?PageNumber=${page}&PageSize=${pageSize}&FromDate=2025-03-01&ToDate=2025-12-31`;

    const res = await fetchWithAuth(url);
    const records = Array.isArray(res?.data) ? res.data : [];

    console.log(
      `📦 [PHASE 1] Page ${page} records:`,
      records.length
    );

    allEmployees.push(...records);

    if (records.length < pageSize) {
      hasMore = false;
      console.log("🛑 [PHASE 1] Last page reached");
    } else {
      page++;
    }
  }

  console.log(
    "✅ [PHASE 1] Total employees stored:",
    allEmployees.length
  );

  console.log("🧾 [PHASE 1] Sample employee:", allEmployees[0]);

  return allEmployees;
}

/* ========================================================
   👤 CREATE SHOPIFY CUSTOMER
======================================================== */
async function createShopifyCustomer(admin, emp) {
  console.log("👤 [SHOPIFY] Creating customer:", emp.emailAddress);

  const mutation = `
    mutation customerCreate($input: CustomerInput!) {
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

  const variables = {
    input: {
      email: emp.emailAddress,
      firstName: emp.firstName,
      lastName: emp.lastName,
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
  };

  console.log("📤 [SHOPIFY] Payload:", variables);

  const response = await admin.graphql(mutation, { variables });
  const result = await response.json();

  console.log(
    "📥 [SHOPIFY] Response:",
    JSON.stringify(result, null, 2)
  );

  if (result?.data?.customerCreate?.userErrors?.length) {
    console.warn(
      "⚠️ [SHOPIFY] User errors:",
      result.data.customerCreate.userErrors
    );

    return {
      success: false,
      email: emp.emailAddress,
      errors: result.data.customerCreate.userErrors,
    };
  }

  console.log("✅ [SHOPIFY] Customer created:", emp.emailAddress);

  return {
    success: true,
    email: emp.emailAddress,
    customer: result.data.customerCreate.customer,
  };
}

/* ========================================================
   🚀 PHASE 2 — SYNC STORED DATA TO SHOPIFY
======================================================== */
async function syncEmployeesToShopify(admin, employees) {
  console.log("🚀 [PHASE 2] Starting Shopify sync");

  const results = [];

  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];

    console.log(
      `➡️ [PHASE 2] (${i + 1}/${employees.length}) Employee ID:`,
      emp.employeeID
    );

    if (!emp?.emailAddress) {
      console.warn(
        "⏭️ [PHASE 2] Skipping — missing email:",
        emp.employeeID
      );
      continue;
    }

    const result = await createShopifyCustomer(admin, emp);
    results.push(result);
  }

  console.log("🏁 [PHASE 2] Shopify sync completed");
  return results;
}

/* ========================================================
   🧠 MAIN ACTION
======================================================== */
export async function action({ request }) {
  console.log("🚀 [ACTION] Employee → Shopify sync started");

  const { admin } = await authenticate.admin(request);
  console.log("🔐 [ACTION] Admin authenticated");

  /* ========= PHASE 1 ========= */
  const employees = await fetchAllEmployees();

  /* ========= PHASE 2 ========= */
  const results = await syncEmployeesToShopify(admin, employees);

  console.log("🏁 [ACTION] Sync finished");

  return Response.json({
    success: true,
    totalEmployees: employees.length,
    processed: results.length,
    results,
  });
}
