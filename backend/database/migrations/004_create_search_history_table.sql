-- Migration: Create search_history table
-- Description: Creates the search history logging table with UUIDs for audit compliance.

CREATE TABLE IF NOT EXISTS search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    ic_number VARCHAR(20) NULL,
    dispatcher_id VARCHAR(100) NULL,
    duration INTEGER NOT NULL, -- in milliseconds
    ip_address VARCHAR(45) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for searching history queries
CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON search_history(created_at);
