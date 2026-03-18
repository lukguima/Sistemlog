-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#2563EB',
    system_name TEXT DEFAULT 'LogiSaaS',
    active_modules JSONB DEFAULT '["portal", "driver_app", "monitoring"]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Enable all access for authenticated users" ON settings
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Grant access
GRANT ALL ON settings TO authenticated;
