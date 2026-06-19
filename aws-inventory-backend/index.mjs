import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const dynamo = new DynamoDBClient({});
const ses = new SESv2Client({});

const {
  TABLE_NAME,
  SES_FROM_EMAIL,
  SES_TO_EMAILS = "",
  ALLOWED_ORIGIN = "*",
  INVENTORY_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/13WF8Z2r88IMG-Bwvmj_Ys1rGC5gP01O_bacZmTwzVZg/gviz/tq?tqx=out:csv&gid=232622180"
} = process.env;

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": ALLOWED_ORIGIN,
      "access-control-allow-methods": "OPTIONS,GET,POST",
      "access-control-allow-headers": "content-type"
    },
    body: JSON.stringify(body)
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(value);
      if (row.some((field) => field.trim())) {
        rows.push(row);
      }
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value || row.length) {
    row.push(value);
    if (row.some((field) => field.trim())) {
      rows.push(row);
    }
  }

  return rows;
}

function normalizeHeader(header) {
  return String(header).trim().toLowerCase();
}

function rowsToObjects(rows) {
  const [headers = [], ...dataRows] = rows;
  return dataRows.map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      record[normalizeHeader(header)] = String(row[index] ?? "").trim();
    });
    return record;
  });
}

async function getInventoryItems() {
  const sheetResponse = await fetch(INVENTORY_SHEET_CSV_URL);
  if (!sheetResponse.ok) {
    throw new Error(`inventory sheet fetch failed: ${sheetResponse.status}`);
  }

  const csv = await sheetResponse.text();
  const rows = rowsToObjects(parseCsv(csv));

  return rows
    .filter((row) => row["item id"] && row["item name"])
    .map((row) => {
      const quantity = Number(row["current quantity"] || 0);
      const reorderLevel = Number(row["reorder level"] || 0);

      return {
        item_id: row["item id"],
        item_name: row["item name"],
        category: row.category || "",
        unit: row.unit || "",
        current_quantity: Number.isFinite(quantity) ? quantity : 0,
        reorder_level: Number.isFinite(reorderLevel) ? reorderLevel : 0,
        in_stock: Number.isFinite(quantity) && quantity > 0
      };
    });
}

async function validateStockAvailability(payload) {
  const inventory = await getInventoryItems();
  const inventoryById = new Map(inventory.map((item) => [item.item_id, item]));
  const unavailable = [];

  payload.items.forEach((item) => {
    const inventoryItem = inventoryById.get(item.item_id);
    if (!inventoryItem) {
      unavailable.push(`${item.item_name} is not in the inventory sheet`);
      return;
    }

    if (!inventoryItem.in_stock) {
      unavailable.push(`${item.item_name} is out of stock`);
      return;
    }

    if (item.quantity > inventoryItem.current_quantity) {
      unavailable.push(`${item.item_name} requested ${item.quantity}, only ${inventoryItem.current_quantity} available`);
    }
  });

  if (unavailable.length) {
    const error = new Error(unavailable.join("; "));
    error.statusCode = 409;
    throw error;
  }
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
  const method = event.requestContext?.http?.method;

  if (method === "OPTIONS") {
    return response(200, { ok: true });
  }

  try {
    if (method === "GET") {
      const inventory = await getInventoryItems();
      return response(200, {
        status: "ok",
        item_count: inventory.length,
        items: inventory
      });
    }

    const payload = validatePayload(parseBody(event));
    await validateStockAvailability(payload);
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
    return response(error.statusCode || 400, {
      status: "error",
      message: error.message || "Unhandled error"
    });
  }
};
