import {
  Page,
  Card,
  Button,
  DataTable,
  Badge,
  Spinner,
} from "@shopify/polaris";
import { useEffect, useState } from "react";

export default function RewardsEmployees() {
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);

  async function syncEmployees() {
    setLoading(true);
    await fetch("/api/rewards-customer-db", { method: "POST" });
    await loadEmployees();
    setLoading(false);
  }

  async function loadEmployees() {
    const res = await fetch("/api/employees-list");
    const data = await res.json();
    setEmployees(data);
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  const rows = employees.map((e) => [
    e.employeeNumber,
    `${e.firstName} ${e.lastName}`,
    e.emailAddress,
    e.position,
    e.officeLocation,
    <Badge status={e.isActive ? "success" : "critical"}>
      {e.isActive ? "Active" : "Inactive"}
    </Badge>,
  ]);

  return (
    <Page title="Employees">
      <Card sectioned>
        <Button primary onClick={syncEmployees} loading={loading}>
          Sync Employees from API
        </Button>
      </Card>

      {loading && <Spinner />}

      <Card>
        <DataTable
          columnContentTypes={[
            "text",
            "text",
            "text",
            "text",
            "text",
            "text",
          ]}
          headings={[
            "Employee #",
            "Name",
            "Email",
            "Position",
            "Location",
            "Status",
          ]}
          rows={rows}
        />
      </Card>
    </Page>
  );
}
