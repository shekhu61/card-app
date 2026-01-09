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

  const [employee, setEmployee] = useState(null);
  const [employeeRewards, setEmployeeRewards] = useState([]);
  const [employeeAddedPoints, setEmployeeAddedPoints] = useState([]);

  /* ---------------- FETCH DATA ---------------- */

  async function fetchRewardsData() {
    setLoading(true);
    try {
      const res = await fetch("/api/rewards-employees", { method: "POST" });
      const data = await res.json();

      setEmployee(data.employee || null);
      setEmployeeRewards(data.employeeRewards || []);
      setEmployeeAddedPoints(data.employeeAddedPoints || []);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  /* ---------------- HELPERS ---------------- */

  const badge = (value) => (
    <Badge tone={value ? "success" : "critical"}>
      {value ? "Yes" : "No"}
    </Badge>
  );

  const formatDate = (date) =>
    date ? new Date(date).toLocaleString() : "—";

  /* ---------------- EMPLOYEE ROW ---------------- */

  const employeeRows = employee
    ? [[
        employee.employeeID,
        employee.employeeNumber,
        employee.firstName,
        employee.lastName,
        employee.emailAddress,
        employee.position,
        employee.officeLocation,
        employee.companyID,
        employee.providerStatus,
        employee.jobLevel || "—",
        employee.workerType || "—",
        employee.managerEmail || "—",
        badge(employee.isActive),
        badge(employee.isRescind),
        formatDate(employee.hireDate),
        formatDate(employee.terminationDate),
        employee.createdBy || "—",
        formatDate(employee.createdDate),
        employee.updatedBy || "—",
        formatDate(employee.updatedDate),
      ]]
    : [];

  /* ---------------- EMPLOYEE REWARDS ROWS ---------------- */

  const rewardRows = employeeRewards.map((r) => [
    r.employeeRewardPointID,
    r.employeeID,
    r.employeeNumber,
    formatDate(r.startDate),
    formatDate(r.endDate),
    formatDate(r.calculatedOn),
    r.regular,
    r.fillinMakeUp,
    r.cancellation,
    r.unexcusedAbsence,
    r.pointsEarned,
    r.companyID,
    r.notes || "—",
    badge(r.isActive),
    formatDate(r.createdDate),
    formatDate(r.updatedDate),
  ]);

  /* ---------------- EMPLOYEE ADDED POINTS ROWS ---------------- */

  const addedPointsRows = employeeAddedPoints.map((p) => [
    p.employeeID,
    formatDate(p.dateAdded),
    p.rewardType,
    formatDate(p.startDate),
    formatDate(p.endDate),
    p.pointsAdded,
    p.notes || "—",
  ]);

  return (
    <Page
      title="Rewards & Employees"
      subtitle="Complete employee, rewards & added points data"
      primaryAction={{
        content: "Fetch Latest Data",
        onAction: fetchRewardsData,
        loading,
      }}
    >
      {/* LOADING */}
      {loading && (
        <Card padding="400">
          <InlineStack align="center" gap="300">
            <Spinner />
            <Text tone="subdued">Loading data…</Text>
          </InlineStack>
        </Card>
      )}

      <Layout gap="400">
        {/* EMPLOYEE TABLE */}
        {employeeRows.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd">Employee (All Columns)</Text>
                <DataTable
                  columnContentTypes={[
                    "numeric","text","text","text","text","text","text",
                    "numeric","numeric","text","text","text",
                    "text","text","text","text","text","text","text","text"
                  ]}
                  headings={[
                    "ID","Emp No","First Name","Last Name","Email",
                    "Position","Location","Company ID","Provider Status",
                    "Job Level","Worker Type","Manager Email",
                    "Active","Rescind","Hire Date","Termination Date",
                    "Created By","Created Date","Updated By","Updated Date"
                  ]}
                  rows={employeeRows}
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* EMPLOYEE REWARDS TABLE */}
        {rewardRows.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd">Employee Rewards (All Columns)</Text>
                <DataTable
                  columnContentTypes={[
                    "numeric","numeric","text","text","text","text",
                    "numeric","numeric","numeric","numeric","numeric",
                    "numeric","text","text","text","text"
                  ]}
                  headings={[
                    "Reward ID","Employee ID","Employee No",
                    "Start Date","End Date","Calculated On",
                    "Regular","Fill-in","Cancellation","Unexcused",
                    "Points Earned","Company ID","Notes",
                    "Active","Created Date","Updated Date"
                  ]}
                  rows={rewardRows}
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* EMPLOYEE ADDED POINTS TABLE */}
        {addedPointsRows.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd">Employee Added Points (All Columns)</Text>
                <DataTable
                  columnContentTypes={[
                    "numeric","text","text","text","text","numeric","text"
                  ]}
                  headings={[
                    "Employee ID","Date Added","Reward Type",
                    "Start Date","End Date","Points Added","Notes"
                  ]}
                  rows={addedPointsRows}
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>

      <Divider />
    </Page>
  );
}
