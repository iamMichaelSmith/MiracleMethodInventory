# Miracle Method Inventory Checkout

Static S3-ready frontend for technician inventory checkouts.

## Recommended architecture

- `S3` hosts the static frontend
- `n8n webhook` receives the JSON payload
- `n8n email node` sends the payload to the mailbox OpenClaw monitors
- `OpenClaw` reads daily emails and updates inventory in Google Sheets
- `OpenClaw` or `n8n` handles low-stock manager notifications

This keeps secrets out of the browser and avoids making technicians work through a raw email client.

## Files

- `index.html` main form
- `styles.css` mobile-first styling
- `app.js` item catalog, validation, payload generation, submission

## Configure submission

Edit `C:\Users\BlakM\OneDrive\Documents\Miracle Method Automations\s3-inventory-form\app.js:1`

- Set `CHECKOUT_ENDPOINT_URL` to your live webhook URL when ready
- Set `EMAIL_FALLBACK_TO` to the mailbox OpenClaw monitors if you want temporary email-draft fallback

If `CHECKOUT_ENDPOINT_URL` is blank, the app opens a `mailto:` draft and copies the JSON payload to the clipboard.

## Suggested n8n webhook

Use the included workflow:

- `C:\Users\BlakM\OneDrive\Documents\Miracle Method Automations\n8n_inventory_checkout_email_import.json`

That workflow:

- accepts a JSON `POST`
- validates required fields
- formats the checkout request
- emails it to the target mailbox
- responds with JSON success

## Deploy to S3

Upload these files to your bucket root:

- `index.html`
- `styles.css`
- `app.js`

Then enable static website hosting or front with CloudFront.

## Payload shape

```json
{
  "type": "checkout",
  "source": "s3_inventory_form",
  "request_id": "uuid",
  "technician": "Technician Name",
  "job": "Optional Job or Customer",
  "timestamp": "2026-06-08T18:00:00.000Z",
  "items": [
    {
      "item_id": "SUP_PAPER_ROLL",
      "item_name": "Paper Roll",
      "category": "Supply",
      "quantity": 2,
      "unit": "per"
    }
  ]
}
```
