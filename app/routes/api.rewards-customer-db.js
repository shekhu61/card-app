import { getToken, setToken } from "../utils/rewardsToken.server";
import db from "../db.server"; // prisma instance

async function login() {
  const res = await fetch(
    "https://stg-rewardsapi.centerforautism.com/Authentication/Login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Username: "admin", Password: "admin" }),
    }
  );

  const data = await res.json();
  setToken(data.token, 3600);
  return data.token;
}

export async function action() {
  let token = getToken();
  if (!token) token = await login();

  const res = await fetch(
    "https://stg-rewardsapi.centerforautism.com/CardShopWrapper/EmployeeDetails?PageNumber=1&PageSize=10&FromDate=2024-12-01",
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const employees = await res.json(); // ARRAY

  /* 🔥 UPSERT INTO DB */
  for (const emp of employees) {
    await db.employee.upsert({
      where: { employeeID: emp.employeeID },
      update: {
        firstName: emp.firstName,
        lastName: emp.lastName,
        emailAddress: emp.emailAddress,
        position: emp.position,
        officeLocation: emp.officeLocation,
        workerType: emp.workerType,
        isActive: emp.isActive,
        hireDate: emp.hireDate ? new Date(emp.hireDate) : null,
      },
      create: {
        employeeID: emp.employeeID,
        employeeNumber: emp.employeeNumber,
        firstName: emp.firstName,
        lastName: emp.lastName,
        emailAddress: emp.emailAddress,
        position: emp.position,
        officeLocation: emp.officeLocation,
        workerType: emp.workerType,
        isActive: emp.isActive,
        hireDate: emp.hireDate ? new Date(emp.hireDate) : null,
      },
    });
  }

  return new Response(JSON.stringify(employees), {
    headers: { "Content-Type": "application/json" },
  });
}
