const CHECKOUT_ENDPOINT_URL = "https://hprceyld1i.execute-api.us-east-1.amazonaws.com/prod/checkout";
const INVENTORY_ENDPOINT_URL = "https://hprceyld1i.execute-api.us-east-1.amazonaws.com/prod/inventory";
const EMAIL_FALLBACK_TO = "Blakmarigold@gmail.com";
const inventoryById = new Map();
let inventoryLoadFailed = false;

const paintAndPrimerItems = [
  { item_id: "PNT_KOHLER_WHITE", item_name: "GlasTech 9000 Kohler White", category: "Paint", unit: "gallon" },
  { item_id: "RED_GLASTECH_LO_MEDIUM_REDUCER_GAL", item_name: "GlasTech Lo Medium Reducer Gal", category: "Paint", unit: "gallon" },
  { item_id: "CAT_GLASTECH_LO_CATALYST_GAL", item_name: "GlasTech Lo Catalyst GAL", category: "Paint", unit: "gallon" },
  { item_id: "PRM_ULTRAGRIP_4100_RESIN_WHITE_GAL", item_name: "UltraGrip 4100 Resin White GAL", category: "Paint", unit: "gallon" },
  { item_id: "PRM_ULTRAGRIP_4100_MEDIUM_REDUCER_GAL", item_name: "UltraGrip 4100 Medium Reducer GAL", category: "Paint", unit: "gallon" },
  { item_id: "PRM_ULTRAGRIP_4100_CATALYST_GAL", item_name: "UltraGrip 4100 Catalyst GAL", category: "Paint", unit: "gallon" },
  { item_id: "CLR_STONEGARD_LO_SATIN_CLEAR_GAL", item_name: "Stonegard Lo Satin Clear GAL", category: "Paint", unit: "gallon" },
  { item_id: "CLR_CLEAR_GLASTECH_9200_GLOSS", item_name: "Clear GlasTech 9200 Gloss", category: "Paint", unit: "gallon" },
  { item_id: "PRM_ULTRAGRIP_4100_RESIN_ALMOND_GAL", item_name: "UltraGrip 4100 Resin Almond GAL", category: "Primer", unit: "gallon" },
  { item_id: "PRM_ULTRAGRIP_4100_RESIN_LIGHT_GRAY_GAL", item_name: "UltraGrip 4100 Resin Light Gray GAL", category: "Primer", unit: "gallon" },
  { item_id: "PRM_ULTRAGRIP_4100_RESIN_BLACK_GAL", item_name: "UltraGrip 4100 Resin Black GAL", category: "Primer", unit: "gallon" },
  { item_id: "HAWK_LABS_90KO0001LO_GLASTECH_LO_9000_GLOSS_GAL", item_name: "GlasTech Lo 9000 Gloss GAL", category: "Paint", unit: "gallon" },
  { item_id: "PNT_GLASTECH_LO_9000_ALMOND_GAL", item_name: "GlasTech Lo 9000 Almond GAL", category: "Paint", unit: "gallon" }
];

const supplyItems = [
  { item_id: "SUP_PAPER_ROLL", item_name: "Paper Roll", category: "Supply", unit: "per" },
  { item_id: "SUP_PLASTIC_ROLL", item_name: "Plastic Roll", category: "Supply", unit: "per" },
  { item_id: "TAP_1_INCH_TAPE", item_name: "1 Inch Tape", category: "Supply", unit: "per" },
  { item_id: "TAP_2_INCH_TAPE", item_name: "2 Inch Tape", category: "Supply", unit: "per" },
  { item_id: "TAP_BLUE_TAPE", item_name: "Blue Tape", category: "Supply", unit: "per" },
  { item_id: "SUP_RAZOR_BLADES", item_name: "Razor Blades", category: "Supply", unit: "pack" },
  { item_id: "SUP_STICKS", item_name: "Sticks", category: "Supply", unit: "per" },
  { item_id: "SAF_GLOVE", item_name: "Glove", category: "Supply", unit: "box" },
  { item_id: "SND_80_GRIT_SANDPAPER", item_name: "80 Grit Sandpaper", category: "Supply", unit: "per" },
  { item_id: "SND_120_GRIT_SANDPAPER", item_name: "120 Grit Sandpaper", category: "Supply", unit: "per" },
  { item_id: "SND_220_GRIT_SANDPAPER", item_name: "220 Grit Sandpaper", category: "Supply", unit: "per" },
  { item_id: "SND_40_GRIT_SANDPAPER", item_name: "40 Grit Sandpaper", category: "Supply", unit: "per" },
  { item_id: "SND_1000_GRIT_SANDPAPER", item_name: "1000 Grit Sandpaper", category: "Supply", unit: "per" },
  { item_id: "SND_1500_GRIT_SANDPAPER", item_name: "1500 Grit Sandpaper", category: "Supply", unit: "per" },
  { item_id: "SUP_SMALL_PAINT_BRUSH", item_name: "Small Paint Brush", category: "Supply", unit: "per" },
  { item_id: "SUP_FOAM_ROLLERS", item_name: "Foam Rollers", category: "Supply", unit: "per" },
  { item_id: "SUP_DAP_CAULK", item_name: "Dap Caulk", category: "Supply", unit: "per" },
  { item_id: "SUP_SEAM_SEAL", item_name: "Seam Seal", category: "Supply", unit: "per" },
  { item_id: "SAF_MASK_FILTERS", item_name: "Mask Filters", category: "Supply", unit: "pair" },
  { item_id: "SAF_MASK_CARTRIDGE", item_name: "Mask Cartridge", category: "Supply", unit: "pack" },
  { item_id: "SUP_LIDS_AND_LINERS", item_name: "Lids & Liners", category: "Supply", unit: "box" },
  { item_id: "SUP_PAPER_TOWELS", item_name: "Paper Towels", category: "Supply", unit: "per" },
  { item_id: "SUP_1_QT_MIXING_CUP", item_name: "1 QT Mixing Cup", category: "Supply", unit: "per" },
  { item_id: "SUP_5_QT_MIXING_CUP", item_name: "5 QT Mixing Cup", category: "Supply", unit: "per" },
  { item_id: "SUP_FLOOR_PAPER", item_name: "Floor Paper", category: "Supply", unit: "per" },
  { item_id: "SUP_FOAM", item_name: "Foam", category: "Supply", unit: "pair" },
  { item_id: "SUP_ETCH", item_name: "Etch", category: "Supply", unit: "per" },
  { item_id: "SUP_STEP_1", item_name: "Step 1", category: "Supply", unit: "per" },
  { item_id: "SUP_STEP_2", item_name: "Step 2", category: "Supply", unit: "per" },
  { item_id: "SUP_AANDB_BONDING_AGENT", item_name: "A&B Bonding Agent", category: "Supply", unit: "per" },
  { item_id: "SUP_DURAGLASS", item_name: "Duraglass", category: "Supply", unit: "per" },
  { item_id: "SUP_HIGH_TECK_4160_PUTTY", item_name: "High Teck 4160 Putty", category: "Supply", unit: "per" },
  { item_id: "SUP_HARDENER", item_name: "Hardener", category: "Supply", unit: "per" },
  { item_id: "SUP_HEAD_SOCKS", item_name: "Head Socks", category: "Supply", unit: "per" },
  { item_id: "SUP_TACK_CLOTH", item_name: "Tack Cloth", category: "Supply", unit: "per" },
  { item_id: "SUP_SPREADER", item_name: "Spreader", category: "Supply", unit: "per" },
  { item_id: "SUP_4_INCH_BLADES", item_name: "4 Inch Blades", category: "Supply", unit: "per" },
  { item_id: "SUP_CLEAR_SILICONE", item_name: "Clear Silicone", category: "Supply", unit: "per" },
  { item_id: "SUP_WHITE_SILICONE", item_name: "White Silicone", category: "Supply", unit: "per" },
  { item_id: "HAWK_52584_SRS", item_name: "SRS", category: "Supply", unit: "per" },
  { item_id: "IQ_HITSPRED_SCOTCH_BRITE", item_name: "Scotch Brite", category: "Supply", unit: "per" }
];

const form = document.getElementById("checkout-form");
const paintContainer = document.getElementById("paint-items");
const supplyContainer = document.getElementById("supply-items");
const selectionSummary = document.getElementById("selection-summary");
const selectedCount = document.getElementById("selected-count");
const formStatus = document.getElementById("form-status");
const submitButton = document.getElementById("submit-button");
const clearButton = document.getElementById("clear-button");
const confirmationView = document.getElementById("confirmation-view");
const confirmationTechnician = document.getElementById("confirmation-technician");
const confirmationJob = document.getElementById("confirmation-job");
const confirmationTimestamp = document.getElementById("confirmation-timestamp");
const confirmationRequestId = document.getElementById("confirmation-request-id");
const confirmationItemCount = document.getElementById("confirmation-item-count");
const confirmationItems = document.getElementById("confirmation-items");
const newCheckoutButton = document.getElementById("new-checkout-button");
const printSummaryButton = document.getElementById("print-summary-button");

function generateRequestId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function renderItems() {
  renderItemSection(paintContainer, paintAndPrimerItems, false);
  renderItemSection(supplyContainer, supplyItems, true);
}

function getInventoryDisplay(itemId) {
  if (inventoryLoadFailed) {
    return { text: "Stock check unavailable", className: "stock-label stock-out", quantity: 0, inStock: false };
  }

  const inventoryItem = inventoryById.get(itemId);
  if (!inventoryItem) {
    return { text: "Checking stock...", className: "stock-label stock-loading", quantity: null, inStock: true };
  }

  if (!inventoryItem.in_stock) {
    return { text: "Out of stock", className: "stock-label stock-out", quantity: 0, inStock: false };
  }

  return {
    text: `${inventoryItem.current_quantity} available`,
    className: "stock-label stock-in",
    quantity: inventoryItem.current_quantity,
    inStock: true
  };
}

function renderItemSection(container, items, withQuantity) {
  container.replaceChildren();
  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const row = document.createElement("label");
    row.className = "item-row";
    row.htmlFor = item.item_id;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = item.item_id;
    checkbox.dataset.itemId = item.item_id;
    checkbox.dataset.itemName = item.item_name;
    checkbox.dataset.category = item.category;
    checkbox.dataset.unit = item.unit;
    checkbox.addEventListener("change", updateSummary);

    const details = document.createElement("div");
    details.className = "item-details";

    const name = document.createElement("div");
    name.className = "item-name";
    name.textContent = item.item_name;

    const meta = document.createElement("div");
    meta.className = "item-meta";
    meta.textContent = `${item.category} · ${item.unit}`;

    const stock = document.createElement("div");
    const stockDisplay = getInventoryDisplay(item.item_id);
    stock.className = stockDisplay.className;
    stock.textContent = stockDisplay.text;

    details.append(name, meta, stock);

    row.appendChild(checkbox);
    row.appendChild(details);

    if (!stockDisplay.inStock) {
      checkbox.disabled = true;
      row.classList.add("item-row-disabled");
    }

    if (withQuantity) {
      const select = document.createElement("select");
      select.className = "quantity-select";
      select.dataset.quantityFor = item.item_id;

      const maxQuantity = stockDisplay.quantity === null ? 5 : Math.min(5, Math.max(0, Math.floor(stockDisplay.quantity)));
      for (let value = 1; value <= Math.max(1, maxQuantity); value += 1) {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = String(value);
        select.appendChild(option);
      }

      select.disabled = !stockDisplay.inStock;
      select.addEventListener("change", updateSummary);
      row.appendChild(select);
    } else {
      const unit = document.createElement("div");
      unit.className = "unit-label";
      unit.textContent = "1 gallon";
      row.appendChild(unit);
    }

    fragment.appendChild(row);
  });

  container.appendChild(fragment);
}

async function loadInventory() {
  if (!INVENTORY_ENDPOINT_URL) {
    return;
  }

  try {
    const response = await fetch(INVENTORY_ENDPOINT_URL);
    if (!response.ok) {
      throw new Error(`Inventory unavailable: ${response.status}`);
    }

    const data = await response.json();
    inventoryLoadFailed = false;
    inventoryById.clear();
    (data.items || []).forEach((item) => {
      inventoryById.set(item.item_id, item);
    });
    renderItems();
    updateSummary();
  } catch (error) {
    inventoryLoadFailed = true;
    renderItems();
    updateSummary();
    setStatus("Stock check failed. Open the live CloudFront app instead of the local file, then refresh. Checkout is disabled until stock loads.", "error");
    revealStatus();
  }
}

function getSelectedItems() {
  const selections = [];
  const selectedCheckboxes = form.querySelectorAll('input[type="checkbox"]:checked');

  selectedCheckboxes.forEach((checkbox) => {
    const isSupply = checkbox.dataset.category === "Supply";
    const quantitySelect = form.querySelector(`[data-quantity-for="${checkbox.dataset.itemId}"]`);
    const quantity = isSupply ? Number(quantitySelect?.value ?? 1) : 1;

    selections.push({
      item_id: checkbox.dataset.itemId,
      item_name: checkbox.dataset.itemName,
      category: checkbox.dataset.category,
      quantity,
      unit: checkbox.dataset.unit
    });
  });

  return selections;
}

function updateSummary() {
  const items = getSelectedItems();
  selectedCount.textContent = `${items.length} selected`;

  if (!items.length) {
    selectionSummary.className = "summary-empty";
    selectionSummary.textContent = "No items selected.";
    return;
  }

  const list = document.createElement("div");
  list.className = "summary-list";

  items.forEach((item) => {
    const entry = document.createElement("div");
    entry.className = "summary-entry";

    const name = document.createElement("span");
    name.textContent = item.item_name;

    const qty = document.createElement("span");
    qty.textContent = `${item.quantity} ${item.unit}`;

    entry.append(name, qty);
    list.appendChild(entry);
  });

  selectionSummary.className = "";
  selectionSummary.replaceChildren(list);
}

function setStatus(message, type = "") {
  formStatus.textContent = message;
  formStatus.className = type ? `status ${type}` : "status";
}

function revealStatus() {
  formStatus.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function renderConfirmation(payload) {
  confirmationTechnician.textContent = payload.technician;
  confirmationJob.textContent = payload.job || "N/A";
  confirmationTimestamp.textContent = formatTimestamp(payload.timestamp);
  confirmationRequestId.textContent = payload.request_id;
  confirmationItemCount.textContent = `${payload.items.length} item${payload.items.length === 1 ? "" : "s"}`;
  confirmationItems.replaceChildren();

  payload.items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "receipt-item";

    const details = document.createElement("div");

    const name = document.createElement("div");
    name.className = "receipt-item-name";
    name.textContent = item.item_name;

    const meta = document.createElement("div");
    meta.className = "receipt-item-meta";
    meta.textContent = `${item.category} · ${item.item_id}`;

    const quantity = document.createElement("div");
    quantity.className = "receipt-item-quantity";
    quantity.textContent = `${item.quantity} ${item.unit}`;

    details.append(name, meta);
    row.append(details, quantity);
    confirmationItems.appendChild(row);
  });

  form.hidden = true;
  confirmationView.hidden = false;
  confirmationView.scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildPayload() {
  const technician = document.getElementById("technician").value.trim();
  const job = document.getElementById("job").value.trim();
  const items = getSelectedItems();

  if (!technician) {
    throw new Error("Technician selection is required.");
  }

  if (!items.length) {
    throw new Error("Select at least one item.");
  }

  items.forEach((item) => {
    const inventoryItem = inventoryById.get(item.item_id);
    if (!inventoryItem) {
      throw new Error(`${item.item_name} is not available in the inventory sheet.`);
    }
    if (!inventoryItem.in_stock) {
      throw new Error(`${item.item_name} is out of stock.`);
    }
    if (item.quantity > inventoryItem.current_quantity) {
      throw new Error(`${item.item_name} only has ${inventoryItem.current_quantity} available.`);
    }
  });

  return {
    type: "checkout",
    source: "s3_inventory_form",
    request_id: generateRequestId(),
    technician,
    job,
    timestamp: new Date().toISOString(),
    items
  };
}

async function submitToEndpoint(payload) {
  const response = await fetch(CHECKOUT_ENDPOINT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Submission failed: ${response.status} ${responseText || response.statusText}`);
  }

  return response;
}

async function submitViaMailto(payload) {
  const subject = encodeURIComponent(`Inventory Checkout ${payload.technician} ${payload.timestamp}`);
  const body = encodeURIComponent(JSON.stringify(payload, null, 2));

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  }

  window.location.href = `mailto:${EMAIL_FALLBACK_TO}?subject=${subject}&body=${body}`;
}

function resetForm(clearStatus = true) {
  form.reset();
  updateSummary();
  if (clearStatus) {
    setStatus("");
  }
}

function startNewCheckout() {
  resetForm();
  confirmationView.hidden = true;
  form.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function handleSubmit(event) {
  event.preventDefault();
  setStatus("");
  submitButton.disabled = true;
  clearButton.disabled = true;

  try {
    const payload = buildPayload();

    if (CHECKOUT_ENDPOINT_URL) {
      await submitToEndpoint(payload);
      renderConfirmation(payload);
      return;
    }

    await submitViaMailto(payload);
    setStatus("Email draft opened. Payload copied to clipboard.", "success");
    revealStatus();
  } catch (error) {
    setStatus(error.message || "Submission failed.", "error");
    if ((error.message || "").includes("Technician selection is required")) {
      document.getElementById("technician").focus();
      document.getElementById("technician").scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      revealStatus();
    }
  } finally {
    submitButton.disabled = false;
    clearButton.disabled = false;
  }
}

clearButton.addEventListener("click", resetForm);
form.addEventListener("submit", handleSubmit);
newCheckoutButton.addEventListener("click", startNewCheckout);
printSummaryButton.addEventListener("click", () => window.print());

renderItems();
updateSummary();
loadInventory();
