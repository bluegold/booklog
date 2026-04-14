-- Add role marker for admin-only capabilities.
ALTER TABLE users ADD COLUMN user_type TEXT NOT NULL DEFAULT 'user' CHECK (user_type IN ('user', 'admin'));
