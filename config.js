// One place to point the site at real services. Empty values degrade honestly:
// submissions queue in the visitor's browser instead of pretending to be sent.
window.POSTCODE_CONFIG = {
  // Cloudflare Worker that stores sign-ups, questionnaires and bookings (D1).
  // Deploy it with: cd worker && npx wrangler deploy   (needs one `wrangler login`)
  // Then paste the printed URL here and commit.
  endpoint: "",

  // Google sign-in. Paste an OAuth 2.0 Web client ID from Google Cloud Console and
  // add https://anshkatyan749-ui.github.io/postcode/auth/google as a redirect URI.
  googleClientId: "",

  // Where the real agent runs, for the person sitting at this machine.
  localApp: "http://127.0.0.1:7860/",

  // Windows installer, published as a release asset (GitHub replaces spaces with dots).
  release: "https://github.com/anshkatyan749-ui/postcode/releases/latest/download/Postcode.Installer.exe",

  supportEmail: "hello@postcode.dev"
};
