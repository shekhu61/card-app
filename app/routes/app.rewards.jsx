import {
  Page,
  Layout,
  Card,
  DataTable,
  Spinner,
  Badge,
  InlineStack,
  BlockStack,
  Text,
  Divider,
} from "@shopify/polaris";
import { useState } from "react";

export default function RewardsEmployees() {
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [rawResponse, setRawResponse] = useState(null);

  async function fetchEmployees() {
    setLoading(true);

    try {
      const res = await fetch("/api/rewards-employees", {
        method: "POST",
      });

      const text = await res.text();
      if (!text) {
        setRawResponse("EMPTY RESPONSE");
        return;
      }

      const json = JSON.parse(text);
      setRawResponse(json);

      /* ===============================
         🔥 CLEAN EXTRACTION
      =============================== */
      const list = Array.isArray(json?.allEmployees?.data)
        ? json.allEmployees.data
        : [];

      const single = json?.employeeById ?? null;

      setEmployees(list);
      setSelectedEmployee(single);
    } catch (err) {
      console.error("🔥 Fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }

  const badge = (value) => (
    <Badge tone={value ? "success" : "critical"}>
      {value ? "Active" : "Inactive"}
    </Badge>
  );

  const formatDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

  const rows = employees.map((e) => [
    e.employeeID ?? "—",
    e.employeeNumber ?? "—",
    `${e.firstName ?? ""} ${e.lastName ?? ""}`,
    e.emailAddress ?? "—",
    e.position ?? "—",
    e.officeLocation ?? "—",
    badge(e.isActive),
    formatDate(e.hireDate),
    e.workerType ?? "—",
  ]);

  return (
    <Page
      title="Employees Dashboard"
      primaryAction={{
        content: "Fetch Employees",
        onAction: fetchEmployees,
        loading,
      }}
    >
      <Layout>

        {/* ===============================
            👤 EMPLOYEE BY ID CARD
        =============================== */}
        {selectedEmployee && (
          <Layout.Section>
            <Card title="Employee By ID">
              <BlockStack gap="200">
                <Text>
                  <b>ID:</b> {selectedEmployee.employeeID}
                </Text>
                <Text>
                  <b>Name:</b>{" "}
                  {selectedEmployee.firstName} {selectedEmployee.lastName}
                </Text>
                <Text>
                  <b>Employee No:</b> {selectedEmployee.employeeNumber}
                </Text>
                <Text>
                  <b>Email:</b> {selectedEmployee.emailAddress ?? "—"}
                </Text>
                <Text>
                  <b>Status:</b> {badge(selectedEmployee.isActive)}
                </Text>
                <Text>
                  <b>Hire Date:</b>{" "}
                  {formatDate(selectedEmployee.hireDate)}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        <Divider />

        {/* ===============================
            📋 ALL EMPLOYEES TABLE
        =============================== */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              {loading && (
                <InlineStack gap="300">
                  <Spinner />
                  <Text>Loading…</Text>
                </InlineStack>
              )}

              {!loading && employees.length === 0 && (
                <>
                  <Text tone="critical">❌ No employees rendered</Text>
                  <Text as="pre">
                    {JSON.stringify(rawResponse, null, 2)}
                  </Text>
                </>
              )}

              {employees.length > 0 && (
                <DataTable
                  columnContentTypes={[
                    "text",
                    "text",
                    "text",
                    "text",
                    "text",
                    "text",
                    "text",
                    "text",
                    "text",
                  ]}
                  headings={[
                    "ID",
                    "Emp No",
                    "Name",
                    "Email",
                    "Position",
                    "Office",
                    "Status",
                    "Hire Date",
                    "Worker Type",
                  ]}
                  rows={rows}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

      </Layout>
    </Page>
  );
}
