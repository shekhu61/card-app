import {
  Page,
  Card,
  Text,
  ProgressBar,
  DataTable,
  InlineStack,
  BlockStack,
  Badge,
} from "@shopify/polaris";
import { useEffect, useState } from "react";

export default function Rewards() {
  const [status, setStatus] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    const fetchStatus = async () => {
      const res = await fetch("/api/crawler-status");
      const data = await res.json();
      setStatus(data);

      setSecondsLeft(
        Math.max(0, Math.floor((data.nextRunAt - Date.now()) / 1000))
      );
    };

    fetchStatus();
    const i = setInterval(fetchStatus, 1000);
    return () => clearInterval(i);
  }, []);

  if (!status) return null;

  const rows = status.history.map((h) => [
    h.time,
    h.status === "Success" ? (
      <Badge tone="success">Success</Badge>
    ) : (
      <Badge tone="critical">Failed</Badge>
    ),
    h.totalEmployees,
    h.processed,
  ]);

  return (
    <Page title="Rewards Sync">
      <BlockStack gap="500">
        <Card>
          <InlineStack align="space-between">
            <Text variant="headingMd">
              {status.isRunning ? "Crawling…" : "Idle"}
            </Text>
            <Text>
              Next crawl in: <strong>{secondsLeft}s</strong>
            </Text>
          </InlineStack>

          {status.isRunning && <ProgressBar progress={70} />}
        </Card>

        <Card>
          <DataTable
            columnContentTypes={["text", "text", "numeric", "numeric"]}
            headings={["Time", "Status", "Employees", "Processed"]}
            rows={rows}
          />
        </Card>
      </BlockStack>
    </Page>
  );
}
