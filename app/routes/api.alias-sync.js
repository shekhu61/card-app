import { getToken, setToken } from "../utils/rewardsToken.server";

/* ========================================================
ENV
======================================================== */

const SHOP = process.env.SHOPIFY_SHOP_DOMAIN;
const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const FLOW_SECRET = process.env.FLOW_SECRET;

if (!SHOP || !ACCESS_TOKEN) {
  throw new Error("Missing Shopify environment variables");
}

/* ========================================================
LOGIN REWARDS API
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

  const data = await res.json();

  if (!data?.token) throw new Error("Rewards login failed");

  setToken(data.token, 3600);

  return data.token;
}

/* ========================================================
FETCH WITH AUTH
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
      headers: { Authorization: `Bearer ${token}` }
    });

  }

  return res.json();
}

/* ========================================================
SHOPIFY GRAPHQL
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
      body: JSON.stringify({ query, variables })
    }
  );

  return res.json();
}

/* ========================================================
FETCH ALL PTS CUSTOMERS
======================================================== */

async function getAllPtsCustomers() {

  let customers = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {

    const query = `
    query ($cursor: String) {
      customers(
        first: 250
        after: $cursor
        query: "tag:pts"
      ) {
        edges {
          cursor
          node {
            id
            email
            firstName
            lastName
          }
        }
        pageInfo {
          hasNextPage
        }
      }
    }`;

    const result = await shopifyGraphQL(query, { cursor });

    const edges = result?.data?.customers?.edges || [];

    edges.forEach(edge => customers.push(edge.node));

    hasNextPage = result?.data?.customers?.pageInfo?.hasNextPage;

    cursor = edges.length ? edges[edges.length - 1].cursor : null;

    console.log("Fetched customers:", customers.length);

  }

  console.log("Total PTS customers:", customers.length);

  return customers;
}

/* ========================================================
GET EMAIL ALIASES
======================================================== */

async function getAliases(email) {

  const encodedEmail = encodeURIComponent(email);

  const url =
  `https://rewardsapi.centerforautism.com/CardShopWrapper/GetEmailAliases?EmailId=${encodedEmail}`;

  const data = await fetchWithAuth(url);

  console.log("Alias response:", email, data);

  return data?.proxyaddresses || [];
}

/* ========================================================
CHECK CUSTOMER EXISTS
======================================================== */

async function getCustomerByEmail(email) {

  const query = `
  query ($query: String!) {
    customers(first:1, query:$query) {
      edges {
        node { id }
      }
    }
  }`;

  const result = await shopifyGraphQL(query, {
    query: `email:${email}`
  });

  return result?.data?.customers?.edges?.[0]?.node || null;
}

/* ========================================================
CREATE CUSTOMER
======================================================== */

async function createCustomer(firstName,lastName,email,employeeId) {

  const mutation = `
  mutation ($input: CustomerInput!) {
    customerCreate(input:$input) {
      customer { id email }
      userErrors { field message }
    }
  }`;

  const input = {

    firstName,
    lastName,
    email,

    tags:["pts"],

    metafields:[
      {
        namespace:"custom",
        key:"employeeid",
        type:"single_line_text_field",
        value:String(employeeId)
      },
      {
        namespace:"custom",
        key:"office_location",
        type:"single_line_text_field",
        value:"US ME Portland ME"
      }
    ]

  };

  return shopifyGraphQL(mutation,{input});
}

/* ========================================================
MAIN ALIAS SYNC
======================================================== */

async function runAliasSync() {

  console.log("Alias Sync Started");

  const customers = await getAllPtsCustomers();

  let checked = 0;
  let created = 0;
  let skipped = 0;

  for (const cust of customers) {

    const email = cust.email;

    if (!email) continue;

    checked++;

    const aliases = await getAliases(email);

    if (!aliases.length) continue;

    for (const aliasEmail of aliases) {

      const exists = await getCustomerByEmail(aliasEmail);

      if (exists) {

        skipped++;

        continue;

      }

      await createCustomer(
        cust.firstName,
        cust.lastName,
        aliasEmail,
        cust.id
      );

      console.log("Created alias customer:", aliasEmail);

      created++;

    }

  }

  console.log("Alias Sync Completed",{
    checked,
    created,
    skipped
  });

}

/* ========================================================
SHOPIFY FLOW ACTION
======================================================== */

export async function action({ request }) {

  console.log("Shopify Flow Triggered");

  const body = await request.json();

  if (body?.secret !== FLOW_SECRET) {
    return new Response("Unauthorized",{status:401});
  }

  setTimeout(()=>{

    runAliasSync().catch(err=>{
      console.error("Alias sync crashed:",err);
    });

  },0);

  return new Response(
    JSON.stringify({
      success:true,
      message:"Alias sync started"
    }),
    {
      headers:{ "Content-Type":"application/json" }
    }
  );

}