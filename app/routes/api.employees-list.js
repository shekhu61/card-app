import db from "../db.server";

export async function loader() {
  const employees = await db.employee.findMany({
    orderBy: { createdAt: "desc" },
  });

  return new Response(JSON.stringify(employees), {
    headers: { "Content-Type": "application/json" },
  });
}
