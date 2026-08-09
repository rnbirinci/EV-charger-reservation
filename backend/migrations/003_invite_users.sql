-- Admin-invited users: pin_hash may be NULL, meaning the account has been
-- created (invited) or reset by an admin but the resident hasn't chosen a PIN
-- yet. They set it themselves on first login.
ALTER TABLE users ALTER COLUMN pin_hash DROP NOT NULL;
