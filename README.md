# Postcode

A local coding agent that plans, writes, runs and **proves** an app on your own machine.
This repository holds the public website. The agent itself ships as a release asset.

- Site: https://anshkatyan749-ui.github.io/postcode/
- Windows installer: [releases/latest](https://github.com/anshkatyan749-ui/postcode/releases/latest)
- Source: [anshkatyan749-ui/postcode](https://github.com/anshkatyan749-ui/postcode)

## How a visitor signs up

Everything happens on `index.html`; the URL never changes to a second page.

| Piece | What it does |
| --- | --- |
| **Create New Account** (header) | Pops the sign-up up on the page itself: meadow on the left, Google + email on the right |
| Google button | The real Google Identity Services button as soon as `googleClientId` exists |
| Email sign-up | Works with no server; the account lives in the visitor's browser and the submission is queued |
| The questions | A step-by-step wizard inside the same overlay: a 30% header, one question per screen, no scrolling form |

Clicking a role card (Company, Solo developer, Founder, Doctor, Engineer, …) jumps straight to
the next screen. Choosing Company or Group of companies adds the company-name question; every
other role goes down the personal path. Signing in and downloading stay two different things:
the sign-up always succeeds or you stay on the sign-in screen.

### The questions, one screen each

1. Tell us about you — Company / Group of companies / Solo developer / Founder / Doctor / Engineer / Teacher / Student / Other
2. What is your company called? — company path only
3. What's your date of birth?
4. What will be your username? — **required, no skip**
5. What is your name?
6. How did you hear about us? — including Codex
7. Anything else we should know?

Every question except the username can be skipped, and you can go back a screen at any point.
```
index.html            the whole site: landing, sign-up overlay, question wizard,
                      download pop-up, booking, cookie policy
auth.js               validation, the stored account, the send queue, Google Identity Services
meadow.js             the calm canvas meadow behind the sign-up overlay
app.js                sign-up overlay, question wizard, download, booking, cookies, welcome
config.js             one file to point the site at real services
manifest.webmanifest   installable app (PWA) metadata
sw.js                 offline shell for the site
icons/                app icons generated from the mark
assets/               screenshots and the vendored animation library
worker/               Cloudflare Worker + D1, stores sign-ups, profiles, downloads and bookings
sitemap.xml robots.txt 404.html   search engine plumbing
```

## Where the form submissions go

`app.js` posts every sign-up, questionnaire answer and booking to the `endpoint` in
`config.js`.

- **While `endpoint` is empty** the submission is kept in the visitor's browser
  (`localStorage`, key `postcode_pending`) and the page says so plainly. Nothing is lost,
  and it is sent on a later visit once an endpoint exists.
- **The local agent** also accepts the same payload at `POST /api/leads` and stores it in the
  `leads` table of `data/harness.db`. Admins read it with `GET /api/leads`, and it is counted
  in `GET /api/admin/stats`.

## Turning on the public data store (Cloudflare Worker + D1)

```bash
cd worker
npx wrangler login
npx wrangler d1 create postcode-leads        # paste the id into wrangler.toml
npx wrangler d1 execute postcode-leads --file=./schema.sql
npx wrangler deploy
```

Then paste the worker URL into `config.js` as `endpoint` and commit. Read the data with:

```bash
npx wrangler d1 execute postcode-leads --command "SELECT kind, email, group_kind, field, source, when_date, slot, created FROM leads ORDER BY created DESC LIMIT 50"
```

The worker validates every field with the same rules as the site, so a direct `POST` with a
fake address, query-shaped text or a `.sql` filename is refused.

## Turning on Google sign-in

The Google button in the sign-up overlay becomes the real Google Identity Services button the
moment a client id exists. A visitor then signs up with their Google account in one click —
no forms, nothing to fill in.

1. Google Cloud Console > APIs & Services > Credentials > Create Credentials > OAuth client ID.
2. Application type: **Web application**.
3. Authorised JavaScript origin: `https://anshkatyan749-ui.github.io`.
4. Paste the client id into `config.js` as `googleClientId` and commit.

Google returns a credential; the site checks the token was minted for that client id and that
the address is verified, then signs the person in exactly like the email path. No redirect
URI is needed in this flow.

## Validation rules, everywhere

A real address is required, and these are refused in the browser, the Worker and the agent:
`plainword`, `@nowhere.com`, `' OR '1'='1'@x.com`, `a@b.com; DROP TABLE users`,
`dump.sql@x.com`, `../../etc/passwd@x.com`, quotes, comments and `union select`.
Passwords need 8 or more characters with at least one letter and one number, and cannot be the
email address. Queries are parameterised everywhere, so injection is not possible even if a
rule were missed.

## Search engines

`sitemap.xml` and `robots.txt` are published, with canonical, Open Graph, Twitter and
`SoftwareApplication` + `FAQPage` structured data. Ranking for a term like "postcode" is
decided by Google, not by markup. To get indexed, submit the sitemap in
[Google Search Console](https://search.google.com/search-console) and keep the URL stable.

## Privacy

No analytics or marketing scripts are loaded at all. One first-party cookie
(`pc_consent`) is written only if you accept all; the essential-only choice is stored locally.
The site's own sign-up is for the demo and updates, the agent's accounts live in the agent.
