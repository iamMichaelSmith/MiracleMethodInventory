import { DynamoDBClient, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const dynamo = new DynamoDBClient({});
const secrets = new SecretsManagerClient({});
const ses = new SESv2Client({});

const {
  TABLE_NAME,
  SES_FROM_EMAIL,
  SES_TO_EMAILS = "",
  ALLOWED_ORIGIN = "*",
  MATON_API_KEY,
  MATON_SECRET_ID,
  MATON_SHEETS_CONNECTION_ID,
  INVENTORY_SPREADSHEET_ID = "13WF8Z2r88IMG-Bwvmj_Ys1rGC5gP01O_bacZmTwzVZg",
  INVENTORY_SHEET_NAME = "Inventory",
  INVENTORY_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/13WF8Z2r88IMG-Bwvmj_Ys1rGC5gP01O_bacZmTwzVZg/gviz/tq?tqx=out:csv&gid=232622180"
} = process.env;

let cachedMatonApiKey;

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

function a1Range(sheetName, range) {
  const escapedName = String(sheetName).replaceAll("'", "''");
  return `'${escapedName}'!${range}`;
}

async function getMatonApiKey() {
  if (cachedMatonApiKey) {
    return cachedMatonApiKey;
  }

  if (MATON_API_KEY) {
    cachedMatonApiKey = MATON_API_KEY;
    return cachedMatonApiKey;
  }

  if (!MATON_SECRET_ID) {
    return "";
  }

  const secret = await secrets.send(new GetSecretValueCommand({ SecretId: MATON_SECRET_ID }));
  cachedMatonApiKey = secret.SecretString || "";
  return cachedMatonApiKey;
}

async function matonRequest(path, { method = "GET", body } = {}) {
  const apiKey = await getMatonApiKey();
  if (!apiKey) {
    throw new Error("MATON_API_KEY or MATON_SECRET_ID is required for Google Sheets updates.");
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`
  };

  if (MATON_SHEETS_CONNECTION_ID) {
    headers["Maton-Connection"] = MATON_SHEETS_CONNECTION_ID;
  }

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const matonResponse = await fetch(`https://api.maton.ai${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await matonResponse.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!matonResponse.ok) {
    throw new Error(`Maton request failed: ${matonResponse.status} ${JSON.stringify(data).slice(0, 500)}`);
  }

  return data;
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
  const matonApiKey = await getMatonApiKey();
  if (matonApiKey) {
    return getInventoryItemsFromMaton();
  }

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

async function getInventoryItemsFromMaton() {
  const range = encodeURIComponent(a1Range(INVENTORY_SHEET_NAME, "A:I"));
  const data = await matonRequest(`/google-sheets/v4/spreadsheets/${INVENTORY_SPREADSHEET_ID}/values/${range}`);
  const rows = rowsToObjects(data.values || []);

  return rows
    .filter((row) => row["item id"] && row["item name"])
    .map((row, index) => {
      const quantity = Number(row["current quantity"] || 0);
      const reorderLevel = Number(row["reorder level"] || 0);

      return {
        item_id: row["item id"],
        item_name: row["item name"],
        category: row.category || "",
        unit: row.unit || "",
        current_quantity: Number.isFinite(quantity) ? quantity : 0,
        reorder_level: Number.isFinite(reorderLevel) ? reorderLevel : 0,
        in_stock: Number.isFinite(quantity) && quantity > 0,
        row_number: index + 2
      };
    });
}

function validateStockAvailability(payload, inventory) {
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

async function updateInventoryQuantities(payload, inventory) {
  const inventoryById = new Map(inventory.map((item) => [item.item_id, item]));
  const updates = payload.items.map((item) => {
    const inventoryItem = inventoryById.get(item.item_id);
    const nextQuantity = inventoryItem.current_quantity - item.quantity;

    return {
      range: a1Range(INVENTORY_SHEET_NAME, `G${inventoryItem.row_number}`),
      values: [[nextQuantity]]
    };
  });

  await matonRequest(`/google-sheets/v4/spreadsheets/${INVENTORY_SPREADSHEET_ID}/values:batchUpdate`, {
    method: "POST",
    body: {
      valueInputOption: "USER_ENTERED",
      data: updates
    }
  });

  return updates;
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

async function storePayload(payload, status = "pending") {
  await dynamo.send(new PutItemCommand({
    TableName: TABLE_NAME,
    Item: {
      request_id: { S: payload.request_id },
      timestamp: { S: payload.timestamp },
      technician: { S: payload.technician },
      job: { S: payload.job },
      type: { S: payload.type },
      source: { S: payload.source },
      status: { S: status },
      item_count: { N: String(payload.items.length) },
      payload_json: { S: JSON.stringify(payload) }
    },
    ConditionExpression: "attribute_not_exists(request_id)"
  }));
}

async function markPayloadStatus(requestId, status, details = {}) {
  await dynamo.send(new UpdateItemCommand({
    TableName: TABLE_NAME,
    Key: {
      request_id: { S: requestId }
    },
    UpdateExpression: "SET #status = :status, sheet_updated = :sheetUpdated, emailed = :emailed, status_detail = :detail",
    ExpressionAttributeNames: {
      "#status": "status"
    },
    ExpressionAttributeValues: {
      ":status": { S: status },
      ":sheetUpdated": { BOOL: Boolean(details.sheetUpdated) },
      ":emailed": { BOOL: Boolean(details.emailed) },
      ":detail": { S: details.detail || "" }
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
    const inventory = await getInventoryItems();
    validateStockAvailability(payload, inventory);

    try {
      await storePayload(payload);
    } catch (error) {
      if (error.name === "ConditionalCheckFailedException") {
        return response(409, {
          status: "error",
          message: "Duplicate checkout request."
        });
      }
      throw error;
    }

    try {
      await updateInventoryQuantities(payload, inventory);
    } catch (error) {
      await markPayloadStatus(payload.request_id, "sheet_update_failed", {
        sheetUpdated: false,
        emailed: false,
        detail: error.message || "Sheet update failed"
      });
      throw error;
    }

    let emailed = false;
    let emailError = "";
    try {
      await sendEmail(payload);
      emailed = true;
    } catch (error) {
      console.error("Email notification failed", error);
      emailError = error.message || "Email notification failed";
    }

    await markPayloadStatus(payload.request_id, "complete", {
      sheetUpdated: true,
      emailed,
      detail: emailed ? "" : emailError || "Email notification skipped"
    });

    return response(200, {
      status: "ok",
      request_id: payload.request_id,
      item_count: payload.items.length,
      stored: true,
      sheet_updated: true,
      emailed
    });
  } catch (error) {
    console.error(error);
    return response(error.statusCode || 400, {
      status: "error",
      message: error.message || "Unhandled error"
    });
  }
};
