import {
  Page,
  Card,
  Button,
  Text,
  Spinner,
  Banner,
} from "@shopify/polaris";
import { useEffect, useRef, useState } from "react";

export default function DiscountPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const email = "shekhu.khan@gmail.com";

  // To prevent multiple API calls at the same time
  const isRunningRef = useRef(false);

  const createDiscount = async () => {
    if (isRunningRef.current) return;

    console.log("🟢 Discount trigger started");
    isRunningRef.current = true;
    setLoading(true);
    setResult(null);

    try {
      console.log("📤 Sending request to backend");

      const res = await fetch("/api/create-discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      console.log("📦 Response:", data);

      setResult(data);
    } catch (error) {
      console.error("🔥 Frontend fetch error:", error);
      setResult({
        success: false,
        message: "Frontend error",
      });
    } finally {
      setLoading(false);
      isRunningRef.current = false;
      console.log("🛑 Discount trigger finished");
    }
  };

  // 🔁 Auto trigger every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      createDiscount();
    }, 5000);

    return () => clearInterval(interval); // cleanup
  }, []);

  return (
    <Page title="Customer Coins Discount">
      <Card sectioned>
        <Text as="h2" variant="headingMd">
          Generate Discount
        </Text>

        

        <br />

        {/* Manual trigger still available */}
        <Button primary onClick={createDiscount} loading={loading}>
          Create Discount from Coins
        </Button>

        <br /><br />

        {loading && <Spinner />}

        {result?.success && (
          <Banner status="success" title="Discount Created">
            <p>
              Code: <b>{result.code}</b>
            </p>
            <p>
              Coins Used: <b>{result.coinsUsed}</b>
            </p>
          </Banner>
        )}

        {result?.success === false && (
          <Banner status="critical" title="Error">
            <p>{result.message}</p>
          </Banner>
        )}
      </Card>
    </Page>
  );
}
