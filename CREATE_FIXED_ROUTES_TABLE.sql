-- Tabela de Trechos Fixos (Fretes pré-combinados)
CREATE TABLE IF NOT EXISTS fixed_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    freight_value NUMERIC NOT NULL,
    distance_km NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Row Level Security) - Assumindo que o padrão do projeto é isolamento por empresa
ALTER TABLE fixed_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their company fixed routes" ON fixed_routes
    FOR SELECT USING (auth.uid() IN (
        SELECT id FROM profiles WHERE company_id = fixed_routes.company_id
    ));

CREATE POLICY "Users can insert their company fixed routes" ON fixed_routes
    FOR INSERT WITH CHECK (auth.uid() IN (
        SELECT id FROM profiles WHERE company_id = fixed_routes.company_id
    ));

CREATE POLICY "Users can update their company fixed routes" ON fixed_routes
    FOR UPDATE USING (auth.uid() IN (
        SELECT id FROM profiles WHERE company_id = fixed_routes.company_id
    ));

CREATE POLICY "Users can delete their company fixed routes" ON fixed_routes
    FOR DELETE USING (auth.uid() IN (
        SELECT id FROM profiles WHERE company_id = fixed_routes.company_id
    ));
