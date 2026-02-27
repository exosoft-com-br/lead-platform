-- =============================================
-- LeadIBGE — Schema Supabase
-- Execute no SQL Editor: https://app.supabase.com
-- =============================================

-- Tabela principal de leads
CREATE TABLE IF NOT EXISTS leads (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome          TEXT NOT NULL,
  email         TEXT,
  telefone      TEXT,
  cpf           TEXT,
  cep           TEXT,
  estado        TEXT,            -- Sigla UF (ex: SP)
  cidade        TEXT,            -- Nome do município
  municipio_id  TEXT,            -- Código IBGE do município
  score_ibge    INTEGER DEFAULT 0 CHECK (score_ibge BETWEEN 0 AND 100),
  segmento      TEXT CHECK (segmento IN ('Premium','Alto Valor','Médio','Básico')),
  status        TEXT DEFAULT 'novo' CHECK (status IN ('novo','contato','qualificado','descartado')),
  origem        TEXT CHECK (origem IN ('site','indicacao','ads','evento','cold') OR origem IS NULL),
  notas         TEXT,
  ibge_detalhes JSONB,           -- JSON com detalhes do score IBGE
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_updated_at ON leads;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_leads_estado    ON leads(estado);
CREATE INDEX IF NOT EXISTS idx_leads_segmento  ON leads(segmento);
CREATE INDEX IF NOT EXISTS idx_leads_status    ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_score     ON leads(score_ibge DESC);
CREATE INDEX IF NOT EXISTS idx_leads_municipio ON leads(municipio_id);
CREATE INDEX IF NOT EXISTS idx_leads_created   ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email     ON leads(email);

-- View: resumo por segmento (útil para relatórios)
CREATE OR REPLACE VIEW vw_leads_por_segmento AS
SELECT
  COALESCE(segmento, 'Sem segmento') AS segmento,
  COUNT(*)                            AS total,
  ROUND(AVG(score_ibge), 1)           AS score_medio,
  COUNT(*) FILTER (WHERE status = 'qualificado') AS qualificados,
  COUNT(*) FILTER (WHERE status = 'novo')        AS novos,
  COUNT(*) FILTER (WHERE status = 'contato')     AS em_contato,
  COUNT(*) FILTER (WHERE status = 'descartado')  AS descartados
FROM leads
GROUP BY segmento
ORDER BY score_medio DESC NULLS LAST;

-- View: resumo por estado (útil para mapa)
CREATE OR REPLACE VIEW vw_leads_por_estado AS
SELECT
  COALESCE(estado, 'N/D') AS estado,
  COUNT(*)                 AS total,
  ROUND(AVG(score_ibge), 1) AS score_medio,
  COUNT(*) FILTER (WHERE status = 'qualificado') AS qualificados
FROM leads
GROUP BY estado
ORDER BY total DESC;

-- View: evolução diária (últimos 90 dias)
CREATE OR REPLACE VIEW vw_leads_diario AS
SELECT
  DATE(created_at) AS dia,
  COUNT(*)          AS novos_leads
FROM leads
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE(created_at)
ORDER BY dia;

-- Row Level Security (RLS)
-- Descomente as linhas abaixo para restringir acesso em produção
-- ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Leitura pública" ON leads FOR SELECT USING (true);
-- CREATE POLICY "Inserção pública" ON leads FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Atualização pública" ON leads FOR UPDATE USING (true);
-- CREATE POLICY "Exclusão pública" ON leads FOR DELETE USING (true);

-- Dados de demonstração (opcional — remova em produção)
INSERT INTO leads (nome, email, telefone, estado, cidade, municipio_id, score_ibge, segmento, status, origem)
VALUES
  ('Ana Paula Silva',    'ana@email.com',   '(11)99001-1234', 'SP', 'São Paulo',      '3550308', 87, 'Premium',   'qualificado', 'site'),
  ('Carlos Mendes',      'carlos@email.com','(21)98002-5678', 'RJ', 'Rio de Janeiro', '3304557', 82, 'Premium',   'qualificado', 'ads'),
  ('Fernanda Souza',     'fe@email.com',    '(31)97003-9012', 'MG', 'Belo Horizonte', '3106200', 74, 'Alto Valor','contato',     'indicacao'),
  ('Rafael Lima',        'rafa@email.com',  '(41)96004-3456', 'PR', 'Curitiba',       '4106902', 78, 'Alto Valor','contato',     'evento'),
  ('Juliana Costa',      'ju@email.com',    '(51)95005-7890', 'RS', 'Porto Alegre',   '4314902', 71, 'Alto Valor','novo',        'site'),
  ('Marcos Oliveira',    'marcos@email.com','(61)94006-0123', 'DF', 'Brasília',       '5300108', 85, 'Premium',   'qualificado', 'cold'),
  ('Patrícia Santos',    'pat@email.com',   '(71)93007-4567', 'BA', 'Salvador',       '2927408', 58, 'Médio',     'novo',        'site'),
  ('Eduardo Ferreira',   'edu@email.com',   '(81)92008-8901', 'PE', 'Recife',         '2611606', 62, 'Alto Valor','contato',     'ads'),
  ('Beatriz Alves',      'bea@email.com',   '(85)91009-2345', 'CE', 'Fortaleza',      '2304400', 55, 'Médio',     'novo',        'site'),
  ('Thiago Rodrigues',   'thiago@email.com','(92)90010-6789', 'AM', 'Manaus',         '1302603', 50, 'Médio',     'novo',        'indicacao')
ON CONFLICT DO NOTHING;
