// One place to point the site at real services. Empty values degrade honestly.
window.POSTCODE_CONFIG = {
  // Cloudflare Worker that stores sign-ups, profiles, downloads and bookings (D1).
  //   cd worker && npx wrangler login && npx wrangler d1 create postcode-leads
  //   npx wrangler d1 execute postcode-leads --file=./schema.sql
  //   npx wrangler deploy      →  paste the URL here
  endpoint: "",

  // Google sign-in. This is the only credential I cannot create for you.
  // 1. console.cloud.google.com → APIs & Services → Credentials
  // 2. Create Credentials → OAuth client ID → Web application
  // 3. Authorised JavaScript origins: https://anshkatyan749-ui.github.io
  // 4. Paste the client id below. The Google button goes live immediately.
  googleClientId: "",

  localApp: "http://127.0.0.1:7860/",
  release: "https://github.com/anshkatyan749-ui/postcode/releases/latest/download/Postcode.Installer.exe",
  supportEmail: "hello@postcode.dev"
};
