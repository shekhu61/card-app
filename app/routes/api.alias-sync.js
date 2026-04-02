import { getToken, setToken } from "../utils/rewardsToken.server";

/* ========================================================
   ENV CONFIG
======================================================== */
const SHOP = process.env.SHOPIFY_SHOP_DOMAIN;
const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const FLOW_SECRET = process.env.FLOW_SECRET;

if (!SHOP || !ACCESS_TOKEN) {
  throw new Error("Missing Shopify environment variables");
}

/* ========================================================
   LOGIN TO REWARDS API
======================================================== */
async function login() {

  const res = await fetch(
    "https://stg-rewardsapi.centerforautism.com/Authentication/Login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Username: "admin",
        Password: "admin"
      })
    }
  );

  const text = await res.text();
  const data = JSON.parse(text);

  if (!data?.token) {
    throw new Error("Rewards login failed");
  }

  setToken(data.token, 3600);

  return data.token;
}

/* ========================================================
   SAFE FETCH WITH AUTO TOKEN REFRESH
======================================================== */
async function fetchWithAuth(url) {

  let token = getToken();

  if (!token) token = await login();

  let res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (res.status === 401) {

    token = await login();

    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

  }

  const text = await res.text();

  return text ? JSON.parse(text) : null;
}

/* ========================================================
   FETCH EMAIL ALIASES
======================================================== */
/* ========================================================
   FETCH EMAIL ALIASES
======================================================== */
async function fetchEmailAliases() {

  const url =
    "https://rewardsapi.centerforautism.com/CardShopWrapper/GetEmailAliases";

  const data = await fetchWithAuth(url);

  // 👇 Show raw API response
  console.log("📦 Alias API Raw Response:", data);

  const records = Array.isArray(data) ? data : data?.data || [];

  // 👇 Show parsed records
  console.log("📊 Parsed Alias Records:", records);

  return records;
}

/* ========================================================
   SHOPIFY GRAPHQL HELPER
======================================================== */
async function shopifyGraphQL(query, variables = {}) {

  const res = await fetch(
    `https://${SHOP}/admin/api/2024-01/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ACCESS_TOKEN
      },
      body: JSON.stringify({
        query,
        variables
      })
    }
  );

  return res.json();
}

/* ========================================================
   GET CUSTOMER BY EMAIL
======================================================== */
async function getCustomerByEmail(email) {

  const query = `
  query getCustomer($query: String!) {
    customers(first: 1, query: $query) {
      edges {
        node {
          id
          email
          tags
        }
      }
    }
  }`;

  const result = await shopifyGraphQL(query, {
    query: `email:${email}`
  });

  return result?.data?.customers?.edges?.[0]?.node || null;
}

/* ========================================================
   UPDATE CUSTOMER
======================================================== */
async function updateCustomer(customerId, existingTags = [], employeeID) {

  const mutation = `
  mutation updateCustomer($input: CustomerInput!) {
    customerUpdate(input: $input) {
      customer {
        id
        email
        tags
      }
      userErrors {
        field
        message
      }
    }
  }`;

  const tagsSet = new Set(existingTags || []);
  tagsSet.add("pts");

  const input = {
    id: customerId,
    tags: Array.from(tagsSet),
    metafields: [
      {
        namespace: "custom",
        key: "employeeid",
        type: "single_line_text_field",
        value: String(employeeID)
      }
    ]
  };

  return shopifyGraphQL(mutation, { input });
}

/* ========================================================
   ALIAS SYNC
======================================================== */
async function runAliasSync() {

  console.log("Alias Sync Started");

  const aliasRecords = await fetchEmailAliases();

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const record of aliasRecords) {

    const { email, employeeId, proxyaddresses } = record;

    if (!proxyaddresses || proxyaddresses.length === 0) {
      skipped++;
      continue;
    }

    try {

      const customer = await getCustomerByEmail(email);

      if (!customer) {
        skipped++;
        continue;
      }

      const result = await updateCustomer(
        customer.id,
        customer.tags,
        employeeId
      );

      const errors =
        result?.data?.customerUpdate?.userErrors;

      if (errors?.length) {
        failed++;
      } else {
        updated++;
      }

    } catch (err) {

      console.error("Alias sync error:", err.message);
      failed++;

    }

  }

  console.log("Alias Sync Completed", {
    updated,
    skipped,
    failed
  });

}

/* ========================================================
   SHOPIFY FLOW ACTION
======================================================== */
export async function action({ request }) {

  console.log("Shopify Flow Triggered");

  const body = await request.json();

  if (body?.secret !== FLOW_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const response = new Response(
    JSON.stringify({
      success: true,
      message: "Alias sync started"
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );

  setTimeout(() => {

    runAliasSync().catch((err) =>
      console.error("Alias sync crashed:", err)
    );

  }, 0);

  return response;

}