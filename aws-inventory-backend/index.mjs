import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const dynamo = new DynamoDBClient({});
const ses = new SESv2Client({});

const {
  TABLE_NAME,
  SES_FROM_EMAIL,
  SES_TO_EMAILS = "",
  ALLOWED_ORIGIN = "*"
} = process.env;

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": ALLOWED_ORIGIN,
      "access-control-allow-methods": "OPTIONS,POST",
      "access-control-allow-headers": "content-type"
    },
    body: JSON.stringify(body)
  };
}

function parseBody(event) {
  if (!event?.body) {
    throw new Error("Request body is required.");
  }

  return typeof event.body === "string" ? JSON.parse(event.body) : event.body;
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload must be an object.");
  }

  const technician = String(payload.technician ?? "").trim();
  const items = Array.isArray(payload.items) ? payload.items : [];

  if (!technician) {
    throw new Error("technician is required");
  }

  if (!items.length) {
    throw new Error("at least one item is required");
  }

  const normalizedItems = items.map((item) => {
    const quantity = Number(item.quantity);
    if (!item.item_id || !item.item_name || !item.category || !item.unit) {
      throw new Error("each item must include item_id, item_name, category, unit");
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`invalid quantity for ${item.item_id}`);
    }

    return {
      item_id: String(item.item_id),
      item_name: String(item.item_name),
      category: String(item.category),
      quantity,
      unit: String(item.unit)
    };
  });

  return {
    type: String(payload.type ?? "checkout"),
    source: String(payload.source ?? "s3_inventory_form"),
    request_id: String(payload.request_id ?? `checkout-${Date.now()}`),
    technician,
    job: String(payload.job ?? "").trim(),
    timestamp: String(payload.timestamp ?? new Date().toISOString()),
    items: normalizedItems
  };
}

function buildEmailText(payload) {
  const lines = payload.items.map((item, index) =>
    `${index + 1}. ${item.item_name} | ${item.item_id} | qty=${item.quantity} | unit=${item.unit} | category=${item.category}`
  );

  return [
    "Inventory checkout submitted.",
    "",
    `Request ID: ${payload.request_id}`,
    `Timestamp: ${payload.timestamp}`,
    `Technician: ${payload.technician}`,
    `Job: ${payload.job || "N/A"}`,
    `Item Count: ${payload.items.length}`,
    "",
    "Items:",
    ...lines,
    "",
    "Raw JSON:",
    JSON.stringify(payload, null, 2)
  ].join("\n");
}

async function storePayload(payload) {
  await dynamo.send(new PutItemCommand({
    TableName: TABLE_NAME,
    Item: {
      request_id: { S: payload.request_id },
      timestamp: { S: payload.timestamp },
      technician: { S: payload.technician },
      job: { S: payload.job },
      type: { S: payload.type },
      source: { S: payload.source },
      item_count: { N: String(payload.items.length) },
      payload_json: { S: JSON.stringify(payload) }
    }
  }));
}

async function sendEmail(payload) {
  const toAddresses = SES_TO_EMAILS.split(",").map((value) => value.trim()).filter(Boolean);
  if (!SES_FROM_EMAIL || !toAddresses.length) {
    return;
  }

  await ses.send(new SendEmailCommand({
    FromEmailAddress: SES_FROM_EMAIL,
    Destination: {
      ToAddresses: toAddresses
    },
    Content: {
      Simple: {
        Subject: {
          Data: `Inventory Checkout ${payload.technician} ${payload.timestamp}`
        },
        Body: {
          Text: {
            Data: buildEmailText(payload)
          }
        }
      }
    }
  }));
}

export const handler = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return response(200, { ok: true });
  }

  try {
    const payload = validatePayload(parseBody(event));
    await storePayload(payload);
    await sendEmail(payload);

    return response(200, {
      status: "ok",
      request_id: payload.request_id,
      item_count: payload.items.length,
      stored: true,
      emailed: true
    });
  } catch (error) {
    console.error(error);
    return response(400, {
      status: "error",
      message: error.message || "Unhandled error"
    });
  }
};
