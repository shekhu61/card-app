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
} from "@shopify/polaris";
import { useState } from "react";

export default function RewardsEmployees() {
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [rawResponse, setRawResponse] = useState(null);
  const [error, setError] = useState(null);

  /* ========================================================
     FETCH EMPLOYEES
  ======================================================== */
  async function fetchEmployees() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/employe_data", {
        method: "POST",
      });

      const text = await res.text();
      if (!text) throw new Error("Empty API response");

      const json = JSON.parse(text);

      // Validate backend contract
      if (!Array.isArray(json?.allEmployees)) {
        throw new Error("allEmployees array missing in response");
      }

      setRawResponse(json);
      setEmployees(json.allEmployees);
      setSelectedEmployee(json.selectedEmployee ?? null);
    } catch (err) {
      console.error("Fetch failed:", err);
      setError(err.message);
      setEmployees([]);
      setSelectedEmployee(null);
    } finally {
      setLoading(false);
    }
  }

  /* ========================================================
     HELPERS
  ======================================================== */
  const badge = (value) => (
    <Badge tone={value ? "success" : "critical"}>
      {value ? "Active" : "Inactive"}
    </Badge>
  );

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString() : "—";

  /* ========================================================
     TABLE 1: ALL EMPLOYEES
  ======================================================== */
  const employeeRows = employees.map((e) => [
    e.employeeID ?? "—",
    e.employeeNumber ?? "—",
    `${e.firstName ?? ""} ${e.lastName ?? ""}`,
    e.emailAddress ?? "—",
    e.officeAddress ?? "—",
    e.position ?? "—",
    e.officeLocation ?? "—",
    badge(e.isActive),
    formatDate(e.hireDate),
    e.workerType ?? "—",
  ]);

  /* ========================================================
     TABLE 2: SELECTED EMPLOYEE DETAILS
  ======================================================== */
  const selectedEmployeeRows = selectedEmployee
    ? [
        ["Employee ID", selectedEmployee.employeeID ?? "—"],
        ["Employee Number", selectedEmployee.employeeNumber ?? "—"],
        [
          "Name",
          `${selectedEmployee.firstName ?? ""} ${
            selectedEmployee.lastName ?? ""
          }`,
        ],
        ["Email", selectedEmployee.emailAddress ?? "—"],
        ["Position", selectedEmployee.position ?? "—"],
        ["Office Location", selectedEmployee.officeLocation ?? "—"],
        ["Status", badge(selectedEmployee.isActive)],
        ["Provider Status", selectedEmployee.providerStatus ?? "—"],
        ["Company ID", selectedEmployee.companyID ?? "—"],
        ["Worker Type", selectedEmployee.workerType || "—"],
        ["Hire Date", formatDate(selectedEmployee.hireDate)],
        ["Termination Date", formatDate(selectedEmployee.terminationDate)],
        ["Created Date", formatDate(selectedEmployee.createdDate)],
        ["Updated Date", formatDate(selectedEmployee.updatedDate)],
        ["Is Rescind", selectedEmployee.isRescind ? "Yes" : "No"],
      ]
    : [];

  /* ========================================================
     UI
  ======================================================== */
  return (
    <Page
      title="Employees"
      primaryAction={{
        content: "Fetch Employees",
        onAction: fetchEmployees,
        loading,
      }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {/* ================= Loading ================= */}
            {loading && (
              <Card>
                <InlineStack gap="300">
                  <Spinner />
                  <Text>Loading employees…</Text>
                </InlineStack>
              </Card>
            )}

            {/* ================= Error ================= */}
            {!loading && error && (
              <Card>
                <BlockStack gap="200">
                  <Text tone="critical">❌ {error}</Text>
                  {rawResponse && (
                    <Text as="pre">
                      {JSON.stringify(rawResponse, null, 2)}
                    </Text>
                  )}
                </BlockStack>
              </Card>
            )}

            {/* ================= Empty State ================= */}
            {!loading && !error && employees.length === 0 && (
              <Card>
                <Text tone="subdued">
                  No employees loaded yet. Click “Fetch Employees”.
                </Text>
              </Card>
            )}

            {/* ================= Table 1: All Employees ================= */}
            {employees.length > 0 && (
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingMd">All Employees</Text>

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
                      "text",
                    ]}
                    headings={[
                      "ID",
                      "Emp No",
                      "Name",
                      "Email",
                      "office add",
                      "Position",
                      "Office",
                      "Status",
                      "Hire Date",
                      "Worker Type",
                    ]}
                    rows={employeeRows}
                  />
                </BlockStack>
              </Card>
            )}

            {/* ================= Table 2: Selected Employee ================= */}
            {selectedEmployee && (
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingMd">
                    Selected Employee Details
                  </Text>

                  <DataTable
                    columnContentTypes={["text", "text"]}
                    headings={["Field", "Value"]}
                    rows={selectedEmployeeRows}
                  />
                </BlockStack>
              </Card>
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

