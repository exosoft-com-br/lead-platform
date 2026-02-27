-- =============================================
-- ROLLBACK: restaura tabela leads ao estado original
-- Execute no Supabase SQL Editor do OUTRO projeto
-- =============================================

-- Remove views criadas pela migration
DROP VIEW IF EXISTS vw_leads_diario;
DROP VIEW IF EXISTS vw_leads_por_estado;
DROP VIEW IF EXISTS vw_leads_por_segmento;

-- Remove trigger e função criados pela migration
DROP TRIGGER IF EXISTS leads_updated_at ON leads;
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Remove índices adicionados
DROP INDEX IF EXISTS idx_leads_score;
DROP INDEX IF EXISTS idx_leads_municipio;
DROP INDEX IF EXISTS idx_leads_segmento;
DROP INDEX IF EXISTS idx_leads_status;
DROP INDEX IF EXISTS idx_leads_estado;
DROP INDEX IF EXISTS idx_leads_created;
DROP INDEX IF EXISTS idx_leads_email;

-- Remove constraints adicionadas
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_score_ibge_check;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_segmento_check;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_origem_check;

-- Remove colunas adicionadas pela migration
ALTER TABLE leads DROP COLUMN IF EXISTS cpf;
ALTER TABLE leads DROP COLUMN IF EXISTS cep;
ALTER TABLE leads DROP COLUMN IF EXISTS municipio_id;
ALTER TABLE leads DROP COLUMN IF EXISTS score_ibge;
ALTER TABLE leads DROP COLUMN IF EXISTS segmento;
ALTER TABLE leads DROP COLUMN IF EXISTS origem;
ALTER TABLE leads DROP COLUMN IF EXISTS notas;
ALTER TABLE leads DROP COLUMN IF EXISTS ibge_detalhes;
ALTER TABLE leads DROP COLUMN IF EXISTS updated_at;

-- Confirma estado final
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'leads'
ORDER BY ordinal_position;
