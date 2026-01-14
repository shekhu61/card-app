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

  const [employeeList, setEmployeeList] = useState([]);
  const [employee, setEmployee] = useState(null);
  const [rewardsList, setRewardsList] = useState([]);
  const [addedPoints, setAddedPoints] = useState([]);
  const [totalPoints, setTotalPoints] = useState(null);

  /* ---------------- FETCH DATA ---------------- */

  async function fetchRewardsData() {
    setLoading(true);
    try {
      const res = await fetch("/api/rewards-employees", { method: "POST" });
      const data = await res.json();

      setEmployeeList(data.employeeList || []);
      setEmployee(data.employee || null);
      setRewardsList(data.rewardsList || []);
      setAddedPoints(data.addedPoints || []);
      setTotalPoints(data.totalPoints || null);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  /* ---------------- HELPERS ---------------- */

  const badge = (value) => (
    <Badge tone={value ? "success" : "critical"}>
      {value ? "Active" : "Inactive"}
    </Badge>
  );

  const formatDate = (date) =>
    date ? new Date(date).toLocaleDateString() : "—";

  /* ========================================================
     EMPLOYEE LIST (MASTER)
  ======================================================== */

  const employeeListRows = employeeList.map(e => [
    e.employeeID,
    e.employeeNumber,
    `${e.firstName} ${e.lastName}`,
    e.emailAddress,
    e.position,
    e.officeLocation,
    badge(e.isActive),
  ]);

  /* ========================================================
     EMPLOYEE PROFILE
  ======================================================== */

  const employeeRows = employee
    ? [[
        employee.employeeID,
        employee.employeeNumber,
        `${employee.firstName} ${employee.lastName}`,
        employee.emailAddress,
        employee.position,
        employee.officeLocation,
        badge(employee.isActive),
        formatDate(employee.hireDate),
      ]]
    : [];

  /* ========================================================
     TOTAL POINTS
  ======================================================== */

  const totalPointsRows = totalPoints
    ? [[
        totalPoints.employeeID,
        totalPoints.employeeName,
        totalPoints.availablePoints,
        totalPoints.totalEarnedPoints,
        totalPoints.redeemedPoints,
        totalPoints.addedPoints,
      ]]
    : [];

  /* ========================================================
     REWARDS HISTORY (Weekly)
  ======================================================== */

  const rewardRows = rewardsList.map(r => [
    formatDate(r.startDate),
    formatDate(r.endDate),
    r.regular,
    r.fillinMakeUp,
    r.cancellation,
    r.unexcusedAbsence,
    r.pointsEarned,
  ]);

  /* ========================================================
     ADDED POINTS
  ======================================================== */

  const addedPointsRows = addedPoints.map(p => [
    formatDate(p.createdDate),
    p.rewardType,
    p.pointsAdded,
    p.notes || "—",
  ]);

  return (
    <Page
      title="Rewards Dashboard"
      subtitle="Employee rewards & points summary"
      primaryAction={{
        content: "Fetch Latest Data",
        onAction: fetchRewardsData,
        loading,
      }}
    >
      {loading && (
        <Card padding="400">
          <InlineStack align="center" gap="300">
            <Spinner />
            <Text tone="subdued">Loading data…</Text>
          </InlineStack>
        </Card>
      )}

      <Layout gap="400">

        {/* EMPLOYEE LIST */}
        {employeeListRows.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd">👥 All Employees</Text>
                <DataTable
                  columnContentTypes={[
                    "text","text","text","text","text","text","text"
                  ]}
                  headings={[
                    "ID",
                    "Emp No",
                    "Name",
                    "Email",
                    "Position",
                    "Office",
                    "Status",
                  ]}
                  rows={employeeListRows}
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* EMPLOYEE PROFILE */}
        {employeeRows.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd">Employee Profile</Text>
                <DataTable
                  columnContentTypes={[
                    "text","text","text","text","text","text","text","text"
                  ]}
                  headings={[
                    "Employee ID",
                    "Emp No",
                    "Name",
                    "Email",
                    "Position",
                    "Office",
                    "Active",
                    "Hire Date",
                  ]}
                  rows={employeeRows}
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* TOTAL POINTS */}
        {totalPointsRows.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd">💰 Points Wallet</Text>
                <DataTable
                  columnContentTypes={[
                    "text","text","numeric","numeric","numeric","numeric"
                  ]}
                  headings={[
                    "Employee ID",
                    "Name",
                    "Available",
                    "Total Earned",
                    "Redeemed",
                    "Added",
                  ]}
                  rows={totalPointsRows}
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* REWARDS HISTORY */}
        {rewardRows.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd">📅 Weekly Rewards</Text>
                <DataTable
                  columnContentTypes={[
                    "text","text","numeric","numeric","numeric","numeric","numeric"
                  ]}
                  headings={[
                    "Week Start",
                    "Week End",
                    "Regular",
                    "Fill-in",
                    "Cancellation",
                    "Absence",
                    "Points Earned",
                  ]}
                  rows={rewardRows}
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* ADDED POINTS */}
        {addedPointsRows.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd">➕ Manual Added Points</Text>
                <DataTable
                  columnContentTypes={[
                    "text","text","numeric","text"
                  ]}
                  headings={[
                    "Date",
                    "Type",
                    "Points",
                    "Notes",
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
