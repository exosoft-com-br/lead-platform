-- =============================================
-- LeadIBGE — Migration: corrige colunas ausentes
-- Execute no SQL Editor: https://app.supabase.com
-- Seguro para rodar mesmo que as colunas já existam
-- =============================================

-- Adiciona colunas que podem estar faltando
ALTER TABLE leads ADD COLUMN IF NOT EXISTS nome          TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email         TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS telefone      TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cpf           TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cep           TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS estado        TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cidade        TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS municipio_id  TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score_ibge    INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS segmento      TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS status        TEXT DEFAULT 'novo';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS origem        TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS notas         TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ibge_detalhes JSONB;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT NOW();

-- Garante constraints corretas (não falha se já existirem nomes diferentes)
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_score_ibge_check;
ALTER TABLE leads ADD CONSTRAINT leads_score_ibge_check CHECK (score_ibge BETWEEN 0 AND 100);

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_segmento_check;
ALTER TABLE leads ADD CONSTRAINT leads_segmento_check CHECK (segmento IN ('Premium','Alto Valor','Médio','Básico') OR segmento IS NULL);

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check CHECK (status IN ('novo','contato','qualificado','descartado') OR status IS NULL);

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_origem_check;
ALTER TABLE leads ADD CONSTRAINT leads_origem_check CHECK (origem IN ('site','indicacao','ads','evento','cold') OR origem IS NULL);

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

-- Recria Views
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

CREATE OR REPLACE VIEW vw_leads_por_estado AS
SELECT
  COALESCE(estado, 'N/D') AS estado,
  COUNT(*)                 AS total,
  ROUND(AVG(score_ibge), 1) AS score_medio,
  COUNT(*) FILTER (WHERE status = 'qualificado') AS qualificados
FROM leads
GROUP BY estado
ORDER BY total DESC;

CREATE OR REPLACE VIEW vw_leads_diario AS
SELECT
  DATE(created_at) AS dia,
  COUNT(*)          AS novos_leads
FROM leads
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE(created_at)
ORDER BY dia;

-- Dados de demonstração (não duplica se já existem — checa por nome)
INSERT INTO leads (nome, email, telefone, estado, cidade, municipio_id, score_ibge, segmento, status, origem)
SELECT * FROM (VALUES
  ('Ana Paula Silva',    'ana@email.com',   '(11)99001-1234', 'SP', 'São Paulo',      '3550308', 87, 'Premium',   'qualificado', 'site'),
  ('Carlos Mendes',      'carlos@email.com','(21)98002-5678', 'RJ', 'Rio de Janeiro', '3304557', 82, 'Premium',   'qualificado', 'ads'),
  ('Fernanda Souza',     'fe@email.com',    '(31)97003-9012', 'MG', 'Belo Horizonte', '3106200', 74, 'Alto Valor','contato',     'indicacao'),
  ('Rafael Lima',        'rafa@email.com',  '(41)96004-3456', 'PR', 'Curitiba',       '4106902', 78, 'Alto Valor','contato',     'evento'),
  ('Juliana Costa',      'ju@email.com',    '(51)95005-7890', 'RS', 'Porto Alegre',   '4314902', 71, 'Alto Valor','novo',        'site'),
  ('Marcos Oliveira',    'marcos@email.com','(61)94006-0123', 'DF', 'Brasília',       '5300108', 85, 'Premium',   'qualificado', 'cold'),
  ('Patrícia Santos',    'pat@email.com',   '(71)93007-4567', 'BA', 'Salvador',       '2927408', 58, 'Médio',     'novo',        'site'),
  ('Eduardo Ferreira',   'edu@email.com',   '(81)92008-8901', 'PE', 'Recife',         '2611606', 62, 'Alto Valor','contato',     'ads'),
  ('Beatriz Alves',      'bea@email.com',   '(85)91009-2345', 'CE', 'Fortaleza',      '2304400', 55, 'Médio',     'novo',        'site'),
  ('Thiago Rodrigues',   'thiago@email.com','(92)90010-6789', 'AM', 'Manaus',         '1302603', 50, 'Médio',     'novo',        'indicacao'),
  ('Camila Pereira',     'camila@email.com','(48)99011-1111', 'SC', 'Florianópolis',  '4205407', 81, 'Premium',   'qualificado', 'evento'),
  ('Leonardo Nascimento','leo@email.com',   '(62)99012-2222', 'GO', 'Goiânia',        '5208707', 70, 'Alto Valor','contato',     'cold'),
  ('Isabela Moura',      'isa@email.com',   '(34)99013-3333', 'MG', 'Uberlândia',     '3170206', 73, 'Alto Valor','qualificado', 'site'),
  ('Roberto Castro',     'roberto@email.com','(91)99014-4444','PA', 'Belém',          '1501402', 50, 'Médio',     'descartado',  'ads'),
  ('Amanda Teixeira',    'amanda@email.com','(11)99015-5555', 'SP', 'Campinas',       '3509502', 79, 'Alto Valor','contato',     'indicacao')
) AS v(nome, email, telefone, estado, cidade, municipio_id, score_ibge, segmento, status, origem)
WHERE NOT EXISTS (
  SELECT 1 FROM leads l WHERE l.email = v.email
);
