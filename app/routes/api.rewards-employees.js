import { authenticate } from "../shopify.server";
import { getToken, setToken } from "../utils/rewardsToken.server";

/* ========================================================
   LOGIN TO REWARDS API
======================================================== */
async function login() {
  console.log("🔐 Rewards API login");

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
  if (!data?.token) throw new Error("❌ Login failed");

  setToken(data.token, 3600);
  console.log("✅ Rewards token stored");

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
    console.log("🔁 Token expired, re-login");
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

    console.log(`📄 Fetching employees page ${page}`);

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

  console.log(`✅ Total employees fetched: ${allEmployees.length}`);
  return allEmployees;
}

/* ========================================================
   CORE LOGIC (REUSED BY FLOW + UI + API)
======================================================== */
export async function runRewardsEmployees(admin) {
  console.log("🚀 Rewards employee sync started");

  const employees = await fetchAllEmployees();

  const results = [];
  let created = 0;
  let failed = 0;
  let skipped = 0;

  for (const emp of employees) {
    const { firstName, lastName, emailAddress, employeeID } = emp;

    if (!emailAddress) {
      skipped++;
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
                value: String(employeeID),
              },
            ],
          },
        },
      });

      const result = await response.json();

      if (result?.data?.customerCreate?.userErrors?.length) {
        failed++;
        results.push({
          email: emailAddress,
          status: "failed",
          errors: result.data.customerCreate.userErrors,
        });
      } else {
        created++;
        results.push({
          email: emailAddress,
          status: "created",
          shopifyCustomerId:
            result.data.customerCreate.customer.id,
        });
      }
    } catch (error) {
      failed++;
      results.push({
        email: emailAddress,
        status: "error",
        error: error.message,
      });
    }
  }

  console.log("🏁 Rewards employee sync completed");

  return {
    totalEmployees: employees.length,
    totalProcessed: results.length,
    created,
    failed,
    skipped,
    results,
  };
}

/* ========================================================
   REMIX ACTION (MANUAL / API CALL)
======================================================== */
export async function action({ request }) {
  console.log("🔹 API / Flow → rewards-employees called");

  const { admin } = await authenticate.admin(request);

  const result = await runRewardsEmployees(admin);

  return new Response(
    JSON.stringify({
      success: true,
      ...result,
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}
