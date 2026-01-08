import { getToken, setToken } from "../utils/rewardsToken.server";

/* -------------------- LOGIN HELPER -------------------- */
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
  setToken(data.token, 3600);
  return data.token;
}

/* -------------------- POST HANDLER -------------------- */
export async function action() {
  let token = getToken();
  if (!token) token = await login();

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  /* -------------------- GET EMPLOYEE BY ID -------------------- */
  const employeeRes = await fetch(
    "https://stg-rewardsapi.centerforautism.com/CardShopWrapper/GetEmployeeById?EmployeeId=46",
    { headers }
  );

  /* -------------------- GET EMPLOYEE REWARDS BY ID -------------------- */
  const employeeRewardsRes = await fetch(
    "https://stg-rewardsapi.centerforautism.com/CardShopWrapper/GetEmployeeRewardsById?EmployeeId=4",
    { headers }
  );

  /* -------------------- GET EMPLOYEE ADDED POINTS BY ID -------------------- */
  const employeeAddedPointsRes = await fetch(
    "https://stg-rewardsapi.centerforautism.com/CardShopWrapper/GetEmployeeAddedPointsById?EmployeeId=1",
    { headers }
  );

  /* -------------------- PARSE JSON -------------------- */
  const employee = await employeeRes.json();
  const employeeRewards = await employeeRewardsRes.json();
  const employeeAddedPoints = await employeeAddedPointsRes.json();

  /* -------------------- LOGS -------------------- */
  console.log("Employee:", employee);
  console.log("Employee Rewards:", employeeRewards);
  console.log("Employee Added Points:", employeeAddedPoints);

  /* -------------------- RETURN RESPONSE -------------------- */
  return new Response(
    JSON.stringify({
      employee,
      employeeRewards,
      employeeAddedPoints,
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}
