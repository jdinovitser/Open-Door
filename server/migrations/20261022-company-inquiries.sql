CREATE TABLE IF NOT EXISTS open_door_company_inquiries (
  id UUID PRIMARY KEY,
  company_type TEXT NOT NULL CHECK (company_type IN ('celebrations', 'real-estate', 'hospitality', 'business', 'other')),
  type_description VARCHAR(200) NOT NULL DEFAULT '',
  company VARCHAR(160) NOT NULL,
  contact_name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  website VARCHAR(300) NOT NULL DEFAULT '',
  details VARCHAR(4000) NOT NULL,
  consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'contacted', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS open_door_company_inquiries_status_created
  ON open_door_company_inquiries (status, created_at DESC);
