import { getToken, setToken } from "../utils/rewardsToken.server";

/* ========================================================
   LOGIN
======================================================== */
async function login() {
  console.log("🔐 Logging in...");

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
  console.log("✅ Token saved");

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
    console.log("🔁 Token expired. Re-login...");
    token = await login();

    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  const text = await res.text();
  if (!text) {
    console.warn("⚠️ Empty response:", url);
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("❌ Invalid JSON:", url);
    throw err;
  }
}

/* ========================================================
   FETCH ALL EMPLOYEE DATA (PAGINATED)
======================================================== */
async function fetchAllEmployeeRecords(pageSize = 20) {
  let page = 1;
  let hasMore = true;
  let allRecords = [];

  while (hasMore) {
    const url =
      `https://rewardsapi.centerforautism.com/CardShopWrapper/EmployeeDetails` +
      `?PageNumber=${page}&PageSize=${pageSize}&FromDate=2000-01-01&ToDate=2026-12-31`;

    console.log(`📄 Fetching employee list page ${page}`);

    const res = await fetchWithAuth(url);

    const records = Array.isArray(res?.data)
      ? res.data
      : Array.isArray(res)
      ? res
      : [];

    console.log(`📦 Records on page ${page}: ${records.length}`);

    allRecords.push(...records);

    if (records.length < pageSize) {
      hasMore = false;
    } else {
      page++;
    }
  }

  console.log("✅ ALL EMPLOYEES FETCHED:", allRecords.length);

  return {
    totalRecords: allRecords.length,
    totalPages: page,
    pageSize,
    data: allRecords,
  };
}

/* ========================================================
   FETCH SINGLE EMPLOYEE BY ID
======================================================== */
async function fetchEmployeeById(employeeId) {
  console.log(`👤 Fetching employee by ID: ${employeeId}`);

  const url =
    `https://stg-rewardsapi.centerforautism.com/CardShopWrapper/GetEmployeePoints` +
    `?EmployeeId=18904`;

  const res = await fetchWithAuth(url);

  console.log("👤 Employee detail response:", res);

  return res;
}

/* ========================================================
   MAIN ACTION
======================================================== */
export async function action() {
  try {
    console.log("🚀 STARTING EMPLOYEE DATA EXTRACTION");

    // 1️⃣ Fetch all employees
    const allEmployees = await fetchAllEmployeeRecords(20);

    // 2️⃣ Fetch single employee details (example ID = 46)
    const employeeById = await fetchEmployeeById(18237);

    // 3️⃣ Combine & return everything
    const finalResponse = {
      summary: {
        totalEmployees: allEmployees.totalRecords,
        totalPages: allEmployees.totalPages,
        pageSize: allEmployees.pageSize,
      },
      allEmployees: allEmployees.data,
      selectedEmployee: employeeById,
    };

    console.log("=======================================");
    console.log("✅ FINAL COMBINED RESPONSE");
    console.log(finalResponse);
    console.log("=======================================");

    return new Response(JSON.stringify(finalResponse), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("🔥 SYSTEM FAILURE:", error);

    return new Response(
      JSON.stringify({ error: "Employee data extraction failed" }),
      { status: 500 }
    );
  }
}