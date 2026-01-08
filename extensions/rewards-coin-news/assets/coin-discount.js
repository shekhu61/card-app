document.addEventListener("DOMContentLoaded", async () => {
  try {
    console.log("✅ Rewards coin script loaded");

    const res = await fetch("/apps/rewards-coins-new/api/create-discount", {
      credentials: "include",
    });

    const data = await res.json();

    if (data.discountCode) {
      await fetch(`/discount/${data.discountCode}`);
      console.log("🎉 Discount applied:", data.discountCode);
    } else {
      console.log("ℹ️ No discount available");
    }
  } catch (err) {
    console.error("❌ Coin discount error:", err);
  }
});
