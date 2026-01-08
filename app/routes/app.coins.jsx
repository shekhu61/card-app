import { useState } from "react";

export default function CustomerCoinsPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    coins: "",
  });

  const submitForm = async (e) => {
    e.preventDefault();

    const res = await fetch("/api/createCustomerCoins", {
      method: "POST",
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (data.success) {
      alert("Customer created and coins saved!");
      setForm({ name: "", email: "", coins: "" });
    } else {
      alert("Error: " + JSON.stringify(data.errors));
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Add Customer Coins</h1>

      <form onSubmit={submitForm} style={{ display: "grid", gap: "12px", maxWidth: "350px" }}>
        
        <input
          type="text"
          placeholder="Customer Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />

        <input
          type="email"
          placeholder="Customer Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />

        <input
          type="number"
          placeholder="Coins"
          value={form.coins}
          onChange={(e) => setForm({ ...form, coins: Number(e.target.value) })}
        />

        <button type="submit" style={{ padding: "10px", cursor: "pointer" }}>
          Save Customer
        </button>
      </form>
    </div>
  );
}
