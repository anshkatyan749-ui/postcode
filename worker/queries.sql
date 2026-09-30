// How to read what people submitted, without a dashboard.
//   npx wrangler d1 execute postcode-leads --command "SELECT * FROM leads ORDER BY created DESC LIMIT 50"
//   npx wrangler d1 execute postcode-leads --command "SELECT kind, COUNT(*) n FROM leads GROUP BY kind"
// The worker also answers GET-free /health with the row count.
