# Miracle Method Inventory Backend

Cloud submission path:

- `API Gateway` receives checkout JSON
- `Lambda` validates checkout payloads against the Inventory tab
- `Lambda` updates Google Sheets through Maton-managed Google Sheets access
- `DynamoDB` keeps an audit log with checkout status
- `SES` emails the checkout as a notification only

Required Lambda environment:

- `TABLE_NAME`
- `MATON_SECRET_ID`
- `MATON_SHEETS_CONNECTION_ID`
- `INVENTORY_SPREADSHEET_ID`
- `INVENTORY_SHEET_NAME`
- `SES_FROM_EMAIL`
- `SES_TO_EMAILS`

Current secret:

- `miracle-method/maton-api-key` stores the Maton API key in AWS Secrets Manager

Packaging note:

- this function relies on the AWS SDK v3 included in the Lambda Node.js runtime
- no local `node_modules` packaging is required
