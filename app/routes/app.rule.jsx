import { useEffect, useState } from "react";

export default function RupePage() {
  const [a, setA] = useState("");
  const [d, setD] = useState("");
  const [loading, setLoading] = useState(false);

  /* ===== Fetch existing rule ===== */
  useEffect(() => {
    async function fetchRule() {
      try {
        const res = await fetch("/api/rule");
        const data = await res.json();

        if (data) {
          setA(data.basePoints || "");
          setD(data.difference || "");
        }
      } catch (err) {
        console.error("Fetch error:", err);
      }
    }

    fetchRule();
  }, []);

  /* ===== Save rule ===== */
  async function handleSave() {
    setLoading(true);

    try {
      const res = await fetch("/api/rule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          a,
          d
        })
      });

      if (!res.ok) {
        throw new Error("Failed to save");
      }

      alert("✅ Rule saved successfully");
    } catch (err) {
      console.error(err);
      alert("❌ Error saving rule");
    }

    setLoading(false);
  }

  return (
    <div style={{ padding: "20px" }}>
      <h2>Reward Rule</h2>

      <div style={{ marginBottom: "10px" }}>
        <label>Points for $1 (a): </label>
        <input
          type="number"
          value={a}
          onChange={(e) => setA(e.target.value)}
        />
      </div>

      <div style={{ marginBottom: "10px" }}>
        <label>Difference per $ (d): </label>
        <input
          type="number"
          value={d}
          onChange={(e) => setD(e.target.value)}
        />
      </div>

      <button onClick={handleSave} disabled={loading}>
        {loading ? "Saving..." : "Save Rule"}
      </button>
    </div>
  );
}