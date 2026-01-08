import { authenticate } from "../../shopify.server";
import prisma from "../../db.server";

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const body = await request.json();

  const { name, email, coins } = body;

  // 1️⃣ Shopify customer creation
  const mutation = `
    mutation createCustomer($input: CustomerInput!) {
      customerCreate(input: $input) {
        customer {
          id
          email
          tags
          firstName
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const response = await admin.graphql(mutation, {
    variables: {
      input: {
        firstName: name,
        email,
        tags: ["pts"],
      },
    },
  });

  const respJson = await response.json();

  // ❌ Stop if Shopify returns errors
  if (respJson.data.customerCreate.userErrors.length > 0) {
    return Response.json(
      {
        success: false,
        errors: respJson.data.customerCreate.userErrors,
      },
      { status: 400 }
    );
  }

  // ✅ ADD THIS RIGHT HERE ⬇️⬇️⬇️
  const customer = respJson.data.customerCreate.customer;
  const shopifyId = customer.id;

  // 2️⃣ Save to Prisma DB
  await prisma.customerCoin.upsert({
    where: { shopifyId }, // ✅ UNIQUE FIELD
    create: {
      shopifyId,
      name,
      email,
      coins,
    },
    update: {
      name,
      email,
      coins,
    },
  });

  return Response.json({
    success: true,
    message: "Customer created + coins saved",
  });
}
