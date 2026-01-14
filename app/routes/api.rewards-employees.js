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

  const data = await res.json();

  if (!data.token) {
    console.error("❌ Login failed:", data);
    throw new Error("Login failed");
  }

  setToken(data.token, 3600);
  console.log("✅ Token saved");

  return data.token;
}

/* ========================================================
   FETCH WITH TOKEN AUTO-REFRESH
======================================================== */
async function fetchWithAuth(url) {
  let token = getToken();
  if (!token) token = await login();

  console.log("🌐 Request:", url);

  let res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    console.log("🔁 Token expired. Re-authenticating...");
    token = await login();

    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  const json = await res.json();
  console.log("📥 Response from", url, json);

  return json;
}

/* ========================================================
   FETCH ALL PAGINATED DATA
======================================================== */
async function fetchAllPages(baseUrl, pageSize = 100) {
  let page = 1;
  let allData = [];
  let hasMore = true;

  while (hasMore) {
    const url = `${baseUrl}&PageNumber=${page}&PageSize=${pageSize}`;
    console.log(`📄 Fetching page ${page}`);

    const res = await fetchWithAuth(url);
    const data = res?.data || res || [];

    console.log(`📦 Page ${page} records:`, data);

    allData.push(...data);

    if (!Array.isArray(data) || data.length < pageSize) {
      hasMore = false;
    } else {
      page++;
    }
  }

  console.log("📊 TOTAL RECORDS FROM", baseUrl, allData.length);
  return allData;
}

/* ========================================================
   MAIN ACTION
======================================================== */
export async function action() {
  try {
    const EMPLOYEE_ID = 4;

    console.log("=======================================");
    console.log("🚀 STARTING FULL REWARDS SYNC");
    console.log("Employee:", EMPLOYEE_ID);
    console.log("=======================================");

    /* -------------------------------------------
       1️⃣ EMPLOYEE LIST
    ------------------------------------------- */
    const employeeList = await fetchAllPages(
      `https://stg-rewardsapi.centerforautism.com/CardShopWrapper/EmployeeDetails
?PageNumber=1&PageSize=20&FromDate=2025-03-01&ToDate=2025-12-31
`
    );

    /* -------------------------------------------
       2️⃣ EMPLOYEE PROFILE
    ------------------------------------------- */
    const employee = await fetchWithAuth(
      `https://stg-rewardsapi.centerforautism.com/CardShopWrapper/GetEmployeeById?EmployeeId=${EMPLOYEE_ID}`
    );

    console.log("👤 Employee Profile:", employee);

    /* -------------------------------------------
       3️⃣ REWARDS HISTORY
    ------------------------------------------- */
    const rewardsList = await fetchAllPages(
      `https://stg-rewardsapi.centerforautism.com/CardShopWrapper/GetEmployeeRewardsById?EmployeeId=${EMPLOYEE_ID}`
    );

    /* -------------------------------------------
       4️⃣ ADDED POINTS
    ------------------------------------------- */
    const addedPoints = await fetchAllPages(
      `https://stg-rewardsapi.centerforautism.com/CardShopWrapper/GetEmployeeAddedPointsById?EmployeeId=${EMPLOYEE_ID}`
    );

    /* -------------------------------------------
       5️⃣ TOTAL POINTS
    ------------------------------------------- */
    const totalPoints = await fetchWithAuth(
      `https://stg-rewardsapi.centerforautism.com/CardShopWrapper/GetEmployeePoints?EmployeeID=${EMPLOYEE_ID}`
    );

    

    console.log("=======================================");
    console.log("✅ FINAL DATA");
    console.log("Employees:", employeeList);
    console.log("One Employee:", employee);
    console.log("Rewards:", rewardsList);
    console.log("Added Points:", addedPoints);
    console.log("💰 Total Points:", totalPoints);
    console.log("=======================================");

    return new Response(
      JSON.stringify({
        employeeList,
        employee,
        rewardsList,
        addedPoints,
        totalPoints,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("🔥 SYSTEM FAILURE:", err);

    return new Response(
      JSON.stringify({ error: "Rewards API failed" }),
      { status: 500 }
    );
  }
}
