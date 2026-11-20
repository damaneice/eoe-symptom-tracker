-- One patient per deployment, so there are no tenant keys.
-- Dates are local YYYY-MM-DD strings chosen by the browser. Times are ISO 8601 UTC.

CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  patient_name TEXT NOT NULL,
  first_dose TEXT,
  interval_days INTEGER NOT NULL CHECK (interval_days IN (7, 14, 28)),
  dose_mg INTEGER NOT NULL
);

CREATE TABLE daily_logs (
  date TEXT PRIMARY KEY,
  swallow INTEGER NOT NULL DEFAULT 0 CHECK (swallow BETWEEN 0 AND 3),
  vomit INTEGER NOT NULL DEFAULT 0 CHECK (vomit >= 0),
  impaction INTEGER NOT NULL DEFAULT 0 CHECK (impaction IN (0, 1)),
  eating INTEGER NOT NULL DEFAULT 0 CHECK (eating IN (0, 1)),
  sleep INTEGER NOT NULL DEFAULT 0 CHECK (sleep IN (0, 1)),
  overall INTEGER CHECK (overall BETWEEN 0 AND 10),
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE day_notes (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  text TEXT NOT NULL,
  author TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX day_notes_date ON day_notes (date);

CREATE TABLE doses (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  mg INTEGER NOT NULL,
  interval_days INTEGER NOT NULL,
  site TEXT NOT NULL,
  side_effect TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL
);

CREATE TABLE scopes (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  peak_eos_hpf INTEGER NOT NULL,
  proximal_eos_hpf INTEGER,
  mid_eos_hpf INTEGER,
  distal_eos_hpf INTEGER,
  findings TEXT NOT NULL DEFAULT ''
);
