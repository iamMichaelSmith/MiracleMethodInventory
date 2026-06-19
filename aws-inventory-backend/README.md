# Miracle Method Inventory Backend

Cloud submission path:

- `API Gateway` receives checkout JSON
- `Lambda` validates and stores payloads
- `DynamoDB` keeps the raw payload log
- `SES` emails the checkout to the monitored mailbox

Current SES limitation:

- this AWS account is still in `SES sandbox`
- email can only be sent to verified identities until sandbox is removed

Current default verified options in this account:

- `TexasTubandtile@gmail.com`
- `contact@blakmarigold.com`

Packaging note:

- this function relies on the AWS SDK v3 included in the Lambda Node.js runtime
- no local `node_modules` packaging is required
