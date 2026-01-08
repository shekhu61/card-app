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
  const [rewards, setRewards] = useState([]);
  const [rewardsDetail, setRewardsDetail] = useState([]);
  const [addPointsResult, setAddPointsResult] = useState(null);
  const [employeePoints, setEmployeePoints] = useState(null);

  

  /* ---------------- FETCH DATA ---------------- */

  async function getEmployees() {
    setLoading(true);
    try {
      const res = await fetch("/api/rewards-employees", { method: "POST" });
      const data = await res.json();

     
      setRewards(data.rewards || []);
      setRewardsDetail(data.rewards_detail || []);
      setAddPointsResult(data.addPointsResult || null);
      setEmployeePoints(data.employeePoints || null);
      
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  /* ---------------- HELPERS ---------------- */

  const statusBadge = (active) => (
    <Badge tone={active ? "success" : "critical"}>
      {active ? "Active" : "Inactive"}
    </Badge>
  );

  /* ---------------- ROWS ---------------- */

  const employeeRows = employees.map((e) => [
    `${e.firstName} ${e.lastName}`,
    e.employeeNumber,
    e.emailAddress,
    e.position,
    e.officeLocation,
    statusBadge(e.isActive),
  ]);

  const rewardRows = rewards.map((r) => [
    r.employeeNumber,
    r.pointsEarned,
    r.regular,
    r.fillinMakeUp,
    r.cancellation,
    r.unexcusedAbsence,
    statusBadge(r.isActive),
  ]);

  const rewardDetailRows = rewardsDetail.map((r) => [
    r.employeeAddedPointsID,
    r.employeeNumber,
    r.pointsAdded,
    r.notes || "—",
    new Date(r.createdDate).toLocaleDateString(),
    statusBadge(r.isActive),
  ]);

  const employeePointsRows = employeePoints
    ? [[
        employeePoints.employeeID,
        employeePoints.employeeName,
        employeePoints.availablePoints,
        employeePoints.totalEarnedPoints,
        employeePoints.redeemedPoints,
        employeePoints.addedPoints,
      ]]
    : [];

  return (
    <Page
      title="Rewards & Employees"
      subtitle="Manage employee data, rewards and points"
      primaryAction={{
        content: "Fetch Latest Data",
        onAction: getEmployees,
        loading,
      }}
      className="rewardsPage"
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
        {/* EMPLOYEES */}
        {employeeRows.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" className="sectionTitle">
                  Employees
                </Text>
                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "text", "text"]}
                  headings={[
                    "Name",
                    "Employee No",
                    "Email",
                    "Position",
                    "Location",
                    "Status",
                  ]}
                  rows={employeeRows}
                  increasedTableDensity
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* REWARDS */}
        {rewardRows.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" className="sectionTitle">
                  Employee Rewards
                </Text>
                <DataTable
                  columnContentTypes={[
                    "text",
                    "numeric",
                    "numeric",
                    "numeric",
                    "numeric",
                    "numeric",
                    "text",
                  ]}
                  headings={[
                    "Employee No",
                    "Points Earned",
                    "Regular",
                    "Fill-in",
                    "Cancellation",
                    "Unexcused",
                    "Status",
                  ]}
                  rows={rewardRows}
                  increasedTableDensity
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* ACTIVITY */}
        {rewardDetailRows.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" className="sectionTitle">
                  Rewards Activity
                </Text>
                <DataTable
                  columnContentTypes={[
                    "numeric",
                    "text",
                    "numeric",
                    "text",
                    "text",
                    "text",
                  ]}
                  headings={[
                    "Reward ID",
                    "Employee No",
                    "Points",
                    "Notes",
                    "Created",
                    "Status",
                  ]}
                  rows={rewardDetailRows}
                  increasedTableDensity
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* SUMMARY */}
        {employeePointsRows.length > 0 && (
          <Layout.Section oneHalf>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" className="sectionTitle">
                  Employee Points Summary
                </Text>
                <DataTable
                  columnContentTypes={[
                    "numeric",
                    "text",
                    "numeric",
                    "numeric",
                    "numeric",
                    "numeric",
                  ]}
                  headings={[
                    "Employee ID",
                    "Name",
                    "Available",
                    "Total Earned",
                    "Redeemed",
                    "Added",
                  ]}
                  rows={employeePointsRows}
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* ADD POINTS RESULT */}
        {addPointsResult && (
          <Layout.Section oneHalf>
            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" className="sectionTitle">
                  Add Points Result
                </Text>
                <Text>
                  <strong>Status:</strong>{" "}
                  <Badge
                    tone={addPointsResult.status === 200 ? "success" : "critical"}
                  >
                    {addPointsResult.status}
                  </Badge>
                </Text>
                <Text>
                  <strong>Message:</strong> {addPointsResult.message}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>

      <Divider />
    </Page>
  );
}
