import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);

  console.log("🚀 Rewards sync started");

  try {
    // ─────────────────────────────────────
    // 0️⃣ FETCH DB CUSTOMERS
    // ─────────────────────────────────────
    console.log("📥 Fetching DB customers...");
    const dbCustomers = await prisma.customerCoins.findMany();
    console.log(`📊 DB customers found: ${dbCustomers.length}`);

    const dbEmails = dbCustomers.map((c) => c.email.toLowerCase());

    // ─────────────────────────────────────
    // 1️⃣ AUTO DELETE ORPHAN SHOPIFY CUSTOMERS
    // ─────────────────────────────────────
    console.log("📥 Fetching Shopify customers with pts tag...");

    const shopifyPtsRes = await admin.graphql(`
      query {
        customers(first: 250, query: "tag:pts") {
          nodes {
            id
            email
          }
        }
      }
    `);

    const shopifyPtsData = await shopifyPtsRes.json();
    const shopifyPtsCustomers = shopifyPtsData.data.customers.nodes;

    console.log(`🏷️ Shopify pts customers: ${shopifyPtsCustomers.length}`);

    for (const customer of shopifyPtsCustomers) {
      if (!dbEmails.includes(customer.email.toLowerCase())) {
        console.log("🗑️ Orphan Shopify customer found:", customer.email);

        // 🔥 Delete related discount
        const discountCode = `PTS-${customer.email.split("@")[0].toUpperCase()}`;
        console.log("🎟️ Deleting discount:", discountCode);

        const discountSearchRes = await admin.graphql(
          `
          query ($query: String!) {
            codeDiscountNodes(first: 10, query: $query) {
              nodes { id }
            }
          }
          `,
          { variables: { query: `code:${discountCode}` } }
        );

        const discountSearchData = await discountSearchRes.json();
        const discountNode = discountSearchData.data.codeDiscountNodes.nodes[0];

        if (discountNode) {
          await admin.graphql(
            `
            mutation DeleteDiscount($id: ID!) {
              discountCodeDelete(id: $id) {
                deletedCodeDiscountId
                userErrors { message }
              }
            }
            `,
            { variables: { id: discountNode.id } }
          );
          console.log("❌ Discount deleted");
        }

        // 🔥 Delete customer
        await admin.graphql(
          `
          mutation DeleteCustomer($id: ID!) {
            customerDelete(input: { id: $id }) {
              deletedCustomerId
              userErrors { message }
            }
          }
          `,
          { variables: { id: customer.id } }
        );

        console.log("❌ Shopify customer deleted:", customer.email);
      }
    }

    // ─────────────────────────────────────
    // 2️⃣ SYNC DB → SHOPIFY
    // ─────────────────────────────────────
    for (const record of dbCustomers) {
      const { email, name, coins } = record;

      console.log("\n👤 Processing customer:", email);
      console.log("💰 Coins in DB:", coins);

      if (!email || coins <= 0) {
        console.log("⏭️ Skipping (invalid email or zero coins)");
        continue;
      }

      // ───────── CUSTOMER ─────────
      let shopifyCustomerId = null;

      const searchRes = await admin.graphql(
        `
        query ($query: String!) {
          customers(first: 1, query: $query) {
            nodes { id tags }
          }
        }
        `,
        { variables: { query: `email:${email}` } }
      );

      const searchData = await searchRes.json();
      let customer = searchData.data.customers.nodes[0];

      if (!customer) {
        console.log("➕ Creating Shopify customer");

        const { firstName, lastName } = splitName(name);

        const createRes = await admin.graphql(
          `
          mutation ($input: CustomerInput!) {
            customerCreate(input: $input) {
              customer { id }
              userErrors { message }
            }
          }
          `,
          {
            variables: {
              input: {
                email,
                firstName,
                lastName,
                tags: ["pts"],
              },
            },
          }
        );

        const createData = await createRes.json();
        if (createData.data.customerCreate.userErrors.length) {
          console.log("❌ Customer create error");
          continue;
        }

        shopifyCustomerId =
          createData.data.customerCreate.customer.id;
      } else {
        shopifyCustomerId = customer.id;

        if (!customer.tags.includes("pts")) {
          await admin.graphql(
            `
            mutation {
              tagsAdd(id: "${shopifyCustomerId}", tags: ["pts"]) {
                node { id }
              }
            }
            `
          );
        }
      }

      // ───────── DISCOUNT ─────────
      const discountCode = `PTS-${email.split("@")[0].toUpperCase()}`;
      console.log("🎟️ Discount:", discountCode);

      const discountSearchRes = await admin.graphql(
        `
        query ($query: String!) {
          codeDiscountNodes(first: 10, query: $query) {
            nodes {
              id
              codeDiscount {
                ... on DiscountCodeBasic {
                  codes(first: 10) { nodes { code } }
                }
              }
            }
          }
        }
        `,
        { variables: { query: `code:${discountCode}` } }
      );

      const discountSearchData = await discountSearchRes.json();
      let discountNode = null;

      for (const node of discountSearchData.data.codeDiscountNodes.nodes) {
        const codes = node.codeDiscount?.codes?.nodes || [];
        if (codes.some((c) => c.code === discountCode)) {
          discountNode = node;
          break;
        }
      }

      if (!discountNode) {
        console.log("➕ Creating discount");

        await admin.graphql(
          `
          mutation ($input: DiscountCodeBasicInput!) {
            discountCodeBasicCreate(basicCodeDiscount: $input) {
              userErrors { message }
            }
          }
          `,
          {
            variables: {
              input: {
                title: discountCode,
                code: discountCode,
                startsAt: new Date().toISOString(),
                customerSelection: {
                  customers: { add: [shopifyCustomerId] },
                },
                customerGets: {
                  items: { all: true },
                  value: {
                    discountAmount: {
                      amount: String(coins),
                      appliesOnEachItem: false,
                    },
                  },
                },
                usageLimit: 1,
                appliesOncePerCustomer: true,
              },
            },
          }
        );
      } else {
        console.log("✏️ Updating discount");

        await admin.graphql(
          `
          mutation ($id: ID!, $input: DiscountCodeBasicInput!) {
            discountCodeBasicUpdate(id: $id, basicCodeDiscount: $input) {
              userErrors { message }
            }
          }
          `,
          {
            variables: {
              id: discountNode.id,
              input: {
                customerGets: {
                  items: { all: true },
                  value: {
                    discountAmount: {
                      amount: String(coins),
                      appliesOnEachItem: false,
                    },
                  },
                },
              },
            },
          }
        );
      }

      // ───────── METAFIELDS ─────────
      console.log("🧾 Updating metafields");

      await admin.graphql(
        `
        mutation ($input: CustomerInput!) {
          customerUpdate(input: $input) {
            userErrors { message }
          }
        }
        `,
        {
          variables: {
            input: {
              id: shopifyCustomerId,
              metafields: [
                {
                  namespace: "custom",
                  key: "coins",
                  type: "single_line_text_field",
                  value: String(coins),
                },
                {
                  namespace: "custom",
                  key: "discount_code",
                  type: "single_line_text_field",
                  value: discountCode,
                },
              ],
            },
          },
        }
      );

      console.log("✅ Sync completed for", email);
    }

    console.log("🎉 Rewards sync completed successfully");
    return Response.json({ success: true });
  } catch (error) {
    console.log("🔥 Rewards sync failed:", error);
    return Response.json({ success: false }, { status: 500 });
  }
}

// ─────────────────────────────────────
function splitName(fullName = "") {
  const parts = fullName.trim().split(" ");
  return {
    firstName: parts[0] || "Customer",
    lastName: parts.slice(1).join(" ") || "",
  };
}







// import { authenticate } from "../shopify.server";
// import prisma from "../db.server";

// export async function action({ request }) {
//   const { admin } = await authenticate.admin(request);
  
//   try {
//     // 1️⃣ Get all customers from your local DB
//     const dbCustomers = await prisma.customerCoins.findMany();
//     const summary = [];

//     for (const record of dbCustomers) {
//       const { email, coins } = record;
//       if (coins <= 0) continue;

//       // 2️⃣ Find or Create Customer in Shopify
//       let shopifyCustomerId = await getShopifyCustomerId(admin, email);

//       if (!shopifyCustomerId) {
//         console.log(`Creating new customer: ${email}`);
//         shopifyCustomerId = await createShopifyCustomer(admin, email);
//       } else {
//         // Ensure they have the "pts" tag
//         await addTagToCustomer(admin, shopifyCustomerId);
//       }

//       // 3️⃣ Manage Discount (Find existing or Create)
//       const discountCode = `SAVE-${email.split('@')[0].toUpperCase()}`;
//       const existingDiscount = await findExistingDiscount(admin, discountCode);

//       if (existingDiscount) {
//         console.log(`Updating discount for ${email}`);
//         await updateDiscount(admin, existingDiscount.id, String(coins));
//       } else {
//         console.log(`Creating new discount for ${email}`);
//         await createDiscount(admin, discountCode, String(coins), email);
//       }

//       summary.push({ email, status: "Success" });
//     }

//     return Response.json({ success: true, processed: summary });
//   } catch (error) {
//     return Response.json({ success: false, error: error.message }, { status: 500 });
//   }
// }

// /** * HELPER FUNCTIONS 
//  **/

// async function getShopifyCustomerId(admin, email) {
//   const query = `query($query: String!) { customers(first: 1, query: $query) { nodes { id } } }`;
//   const response = await admin.graphql(query, { variables: { query: `email:${email}` } });
//   const data = await response.json();
//   return data.data.customers.nodes[0]?.id;
// }

// async function createShopifyCustomer(admin, email) {
//   const mutation = `mutation customerCreate($input: CustomerInput!) {
//     customerCreate(input: $input) { customer { id } userErrors { message } }
//   }`;
//   const response = await admin.graphql(mutation, {
//     variables: { input: { email, tags: ["pts"] } }
//   });
//   const data = await response.json();
//   return data.data.customerCreate.customer?.id;
// }

// async function addTagToCustomer(admin, customerId) {
//   const mutation = `mutation tagsAdd($id: ID!, $tags: [String!]!) {
//     tagsAdd(id: $id, tags: $tags) { node { id } }
//   }`;
//   await admin.graphql(mutation, { variables: { id: customerId, tags: ["pts"] } });
// }

// async function findExistingDiscount(admin, code) {
//   const query = `query($query: String!) {
//     codeDiscountNodes(first: 1, query: $query) {
//       nodes { id }
//     }
//   }`;
//   const response = await admin.graphql(query, { variables: { query: `code:${code}` } });
//   const data = await response.json();
//   return data.data.codeDiscountNodes.nodes[0];
// }

// async function updateDiscount(admin, discountId, amount) {
//   const mutation = `mutation discountCodeBasicUpdate($id: ID!, $basicCodeDiscount: DiscountCodeBasicInput!) {
//     discountCodeBasicUpdate(id: $id, basicCodeDiscount: $basicCodeDiscount) {
//       userErrors { message }
//     }
//   }`;
//   await admin.graphql(mutation, {
//     variables: {
//       id: discountId,
//       basicCodeDiscount: {
//         customerGets: { value: { discountAmount: { amount, appliesOnEachItem: false } } }
//       }
//     }
//   });
// }

// async function createDiscount(admin, code, amount, email) {
//   const mutation = `mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
//     discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
//       userErrors { message }
//     }
//   }`;
//   await admin.graphql(mutation, {
//     variables: {
//       basicCodeDiscount: {
//         title: `Points Discount - ${email}`,
//         code: code,
//         startsAt: new Date().toISOString(),
//         customerSelection: { all: true },
//         customerGets: {
//           items: { all: true },
//           value: { discountAmount: { amount, appliesOnEachItem: false } }
//         },
//         usageLimit: 1
//       }
//     }
//   });
// }


// import { authenticate } from "../shopify.server";
// import prisma from "../db.server";

// /* ----------------------------------------
//    GET SHOPIFY CUSTOMER ID BY EMAIL
// ----------------------------------------- */
// async function getCustomerIdByEmail(admin, email) {
//   const query = `
//     query getCustomerByEmail($query: String!) {
//       customers(first: 1, query: $query) {
//         edges {
//           node {
//             id
//             email
//           }
//         }
//       }
//     }
//   `;

//   const response = await admin.graphql(query, {
//     variables: {
//       query: `email:${email}`,
//     },
//   });

//   const result = await response.json();
//   return result.data.customers.edges[0]?.node?.id || null;
// }

// /* ----------------------------------------
//    FIND EXISTING DISCOUNT BY EMAIL (TITLE)
// ----------------------------------------- */
// async function findDiscountByEmail(admin, email) {
//   const query = `
//     query {
//       discountNodes(first: 100) {
//         edges {
//           node {
//             id
//             discount {
//               ... on DiscountCodeBasic {
//                 title
//               }
//             }
//           }
//         }
//       }
//     }
//   `;

//   const response = await admin.graphql(query);
//   const result = await response.json();

//   return result.data.discountNodes.edges.find(edge =>
//     edge.node.discount?.title?.includes(email)
//   );
// }

// /* ----------------------------------------
//    DELETE DISCOUNT
// ----------------------------------------- */
// async function deleteDiscount(admin, discountId) {
//   const mutation = `
//     mutation discountDelete($id: ID!) {
//       discountDelete(id: $id) {
//         deletedDiscountId
//         userErrors {
//           message
//         }
//       }
//     }
//   `;

//   await admin.graphql(mutation, {
//     variables: { id: discountId },
//   });
// }

// /* ----------------------------------------
//    MAIN ACTION
// ----------------------------------------- */
// export async function action({ request }) {
//   console.log("🔵 API /create-discount called");

//   try {
//     const { admin } = await authenticate.admin(request);

//     // 1️⃣ FETCH ALL CUSTOMERS WITH COINS
//     const customers = await prisma.customerCoins.findMany({
//       where: {
//         coins: { gt: 0 },
//       },
//     });

//     if (!customers.length) {
//       return Response.json({
//         success: false,
//         message: "No customers with available coins",
//       });
//     }

//     const results = [];

//     // 2️⃣ PROCESS EACH CUSTOMER
//     for (const customer of customers) {
//       const { email, coins } = customer;

//       console.log(`➡️ Processing ${email}`);

//       // 3️⃣ GET SHOPIFY CUSTOMER ID
//       const customerId = await getCustomerIdByEmail(admin, email);

//       if (!customerId) {
//         console.warn(`⚠️ Shopify customer not found: ${email}`);
//         results.push({
//           email,
//           success: false,
//           message: "Customer not found in Shopify",
//         });
//         continue;
//       }

//       const discountValue = String(coins);
//       const discountCode = `COINS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

//       // 4️⃣ CHECK & DELETE EXISTING DISCOUNT
//       const existingDiscount = await findDiscountByEmail(admin, email);

//       if (existingDiscount) {
//         console.log(`♻️ Deleting old discount for ${email}`);
//         await deleteDiscount(admin, existingDiscount.node.id);
//       }

//       // 5️⃣ CREATE NEW DISCOUNT
//       const createDiscountMutation = `
//         mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
//           discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
//             codeDiscountNode {
//               id
//             }
//             userErrors {
//               field
//               message
//             }
//           }
//         }
//       `;

//       const response = await admin.graphql(createDiscountMutation, {
//         variables: {
//           basicCodeDiscount: {
//             title: `Coins Discount - ${email}`,
//             code: discountCode,
//             startsAt: new Date().toISOString(),

//             customerSelection: {
//               customers: {
//                 add: [customerId], // ✅ MUST BE GID
//               },
//             },

//             customerGets: {
//               items: { all: true },
//               value: {
//                 discountAmount: {
//                   amount: discountValue,
//                   appliesOnEachItem: false,
//                 },
//               },
//             },

//             minimumRequirement: {
//               subtotal: {
//                 greaterThanOrEqualToSubtotal: "1.0",
//               },
//             },

//             usageLimit: 1,
//           },
//         },
//       });

//       const result = await response.json();
//       const errors = result.data?.discountCodeBasicCreate?.userErrors;

//       if (errors && errors.length > 0) {
//         console.error(`❌ Discount failed for ${email}`, errors);
//         results.push({
//           email,
//           success: false,
//           errors,
//         });
//         continue;
//       }

//       // 6️⃣ DEDUCT COINS ONLY AFTER SUCCESS
//       await prisma.customerCoins.update({
//         where: { email },
//         data: { coins: 0 },
//       });

//       console.log(`✅ Discount created for ${email}`);

//       results.push({
//         email,
//         success: true,
//         discountCode,
//         coinsUsed: coins,
//       });
//     }

//     return Response.json({
//       success: true,
//       message: "Discount processing completed",
//       results,
//     });

//   } catch (error) {
//     console.error("🔥 API ERROR:", error);
//     return Response.json(
//       { success: false, message: error.message },
//       { status: 500 }
//     );
//   }
// }
