-- Tabela de Assinaturas
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES profiles(company_id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'inactive', -- active, inactive, past_due, canceled
    plan_type TEXT NOT NULL DEFAULT 'trial', -- trial, basic, pro, enterprise
    expires_at TIMESTAMPTZ,
    mp_preference_id TEXT, -- ID da preferência do Mercado Pago
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "As empresas podem ver apenas suas próprias assinaturas"
ON subscriptions FOR SELECT
TO authenticated
USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
));

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
