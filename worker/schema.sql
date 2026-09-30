CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,                 -- signup | signin | questionnaire | booking
  email TEXT NOT NULL,
  provider TEXT DEFAULT '',
  name TEXT DEFAULT '',
  company TEXT DEFAULT '',
  group_kind TEXT DEFAULT '',         -- "part of a group of companies?"
  field TEXT DEFAULT '',
  source TEXT DEFAULT '',             -- how they heard about us
  when_date TEXT DEFAULT '',
  slot TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  meta TEXT DEFAULT '',
  ip TEXT DEFAULT '',
  created INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS leads_kind ON leads(kind);
CREATE INDEX IF NOT EXISTS leads_created ON leads(created);
