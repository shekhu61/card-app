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
    <div
  style={{
    padding: "24px",
    maxWidth: "500px",
    margin: "40px auto",
    borderRadius: "12px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
    background: "#ffffff",
    fontFamily: "system-ui, sans-serif"
  }}
>
  <h2
    style={{
      marginBottom: "20px",
      fontSize: "22px",
      fontWeight: "600",
      textAlign: "center",
      color: "#222"
    }}
  >
    Reward Rule
  </h2>

  {/* Input Row */}
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "15px",
      gap: "10px"
    }}
  >
    <label style={{ flex: 1, fontSize: "14px", color: "#555" }}>
      Points for $1 (a)
    </label>
    <input
      type="number"
      value={a}
      onChange={(e) => setA(e.target.value)}
      style={{
        flex: 1,
        padding: "10px",
        borderRadius: "8px",
        border: "1px solid #ddd",
        fontSize: "14px",
        outline: "none"
      }}
    />
  </div>

  {/* Input Row */}
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "20px",
      gap: "10px"
    }}
  >
    <label style={{ flex: 1, fontSize: "14px", color: "#555" }}>
      Difference per $ (d)
    </label>
    <input
      type="number"
      value={d}
      onChange={(e) => setD(e.target.value)}
      style={{
        flex: 1,
        padding: "10px",
        borderRadius: "8px",
        border: "1px solid #ddd",
        fontSize: "14px",
        outline: "none"
      }}
    />
  </div>

  {/* Button */}
  <button
    onClick={handleSave}
    disabled={loading}
    style={{
      width: "100%",
      padding: "12px",
      borderRadius: "10px",
      border: "none",
      background: loading ? "#999" : "#000",
      color: "#fff",
      fontSize: "14px",
      fontWeight: "500",
      cursor: loading ? "not-allowed" : "pointer",
      transition: "all 0.2s ease"
    }}
  >
    {loading ? "Saving..." : "Save Rule"}
  </button>
</div>
  );
}