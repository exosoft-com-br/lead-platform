-- =============================================
-- LeadIBGE — Schema NOVO (tabela: leads_ibge)
-- Execute no SQL Editor: https://app.supabase.com
-- Projeto: LeandroRibeiro2018/lead-platform
-- =============================================

-- Remove tabela anterior se existir (apenas deste projeto)
DROP TABLE IF EXISTS leads_ibge CASCADE;

-- Tabela principal
CREATE TABLE leads_ibge (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome          TEXT NOT NULL,
  email         TEXT,
  telefone      TEXT,
  cpf           TEXT,
  cep           TEXT,
  estado        TEXT,
  cidade        TEXT,
  municipio_id  TEXT,
  score_ibge    INTEGER DEFAULT 0 CHECK (score_ibge BETWEEN 0 AND 100),
  segmento      TEXT CHECK (segmento IN ('Premium','Alto Valor','Médio','Básico') OR segmento IS NULL),
  status        TEXT DEFAULT 'novo' CHECK (status IN ('novo','contato','qualificado','descartado')),
  origem        TEXT CHECK (origem IN ('site','indicacao','ads','evento','cold') OR origem IS NULL),
  notas         TEXT,
  ibge_detalhes JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION update_leads_ibge_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_ibge_updated_at
  BEFORE UPDATE ON leads_ibge
  FOR EACH ROW
  EXECUTE FUNCTION update_leads_ibge_updated_at();

-- Índices
CREATE INDEX idx_leads_ibge_estado    ON leads_ibge(estado);
CREATE INDEX idx_leads_ibge_segmento  ON leads_ibge(segmento);
CREATE INDEX idx_leads_ibge_status    ON leads_ibge(status);
CREATE INDEX idx_leads_ibge_score     ON leads_ibge(score_ibge DESC);
CREATE INDEX idx_leads_ibge_municipio ON leads_ibge(municipio_id);
CREATE INDEX idx_leads_ibge_created   ON leads_ibge(created_at DESC);
CREATE INDEX idx_leads_ibge_email     ON leads_ibge(email);

-- Views
CREATE OR REPLACE VIEW vw_ibge_por_segmento AS
SELECT
  COALESCE(segmento, 'Sem segmento') AS segmento,
  COUNT(*)                            AS total,
  ROUND(AVG(score_ibge), 1)           AS score_medio,
  COUNT(*) FILTER (WHERE status = 'qualificado') AS qualificados,
  COUNT(*) FILTER (WHERE status = 'novo')        AS novos,
  COUNT(*) FILTER (WHERE status = 'contato')     AS em_contato,
  COUNT(*) FILTER (WHERE status = 'descartado')  AS descartados
FROM leads_ibge
GROUP BY segmento
ORDER BY score_medio DESC NULLS LAST;

CREATE OR REPLACE VIEW vw_ibge_por_estado AS
SELECT
  COALESCE(estado, 'N/D') AS estado,
  COUNT(*)                 AS total,
  ROUND(AVG(score_ibge), 1) AS score_medio,
  COUNT(*) FILTER (WHERE status = 'qualificado') AS qualificados
FROM leads_ibge
GROUP BY estado
ORDER BY total DESC;

CREATE OR REPLACE VIEW vw_ibge_diario AS
SELECT
  DATE(created_at) AS dia,
  COUNT(*)          AS novos_leads
FROM leads_ibge
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE(created_at)
ORDER BY dia;

-- Confirma criação
SELECT 'Tabela leads_ibge criada com sucesso!' AS resultado;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'leads_ibge'
ORDER BY ordinal_position;
