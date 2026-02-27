/* =============================================
   config.js — Configure suas credenciais aqui
   ============================================= */

// Carrega credenciais salvas no navegador (definidas em Configurações)
const _savedUrl = localStorage.getItem('sb_url') || '';
const _savedKey = localStorage.getItem('sb_key') || '';
const _savedWeights = JSON.parse(localStorage.getItem('score_weights') || 'null');

const APP_CONFIG = {
  // ── Supabase ──────────────────────────────
  // 1. Acesse https://app.supabase.com → seu projeto → Settings → API
  // 2. Copie "Project URL" e "anon public" key
  // 3. OU configure via páginal de Configurações da plataforma
  supabaseUrl:  _savedUrl  || 'https://bhargdkruycbrcanfvuz.supabase.co',
  supabaseKey:  _savedKey  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoYXJnZGtydXljYnJjYW5mdnV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NzQ1NzgsImV4cCI6MjA4NzQ1MDU3OH0.jBRK_IhUNzxMzf_4UNjpabgwEB7MpqrTL29qTvZK_os',

  // ── App ───────────────────────────────────
  appName: 'LeadIBGE',
  version: '1.0.0',

  // ── IBGE API ──────────────────────────────
  ibgeBaseUrl: 'https://servicodados.ibge.gov.br/api',

  // ── Score ─────────────────────────────────
  // Pesos para calcular o score do lead baseado em dados regionais do IBGE
  // (ajuste em Configurações → Pesos ou edite aqui diretamente)
  scoreWeights: _savedWeights || {
    pib_per_capita:   0.35,   // peso do PIB per capita municipal
    populacao:        0.15,   // densidade / porte do município
    idh:              0.30,   // IDH municipal
    grau_instrucao:   0.20,   // nível de instrução médio da região
  },

  // ── Segmentos ─────────────────────────────
  segments: {
    premium:   { min: 80, label: 'Premium',    badge: 'badge-green'  },
    alto:      { min: 60, label: 'Alto Valor', badge: 'badge-blue'   },
    medio:     { min: 40, label: 'Médio',      badge: 'badge-orange' },
    baixo:     { min: 0,  label: 'Básico',     badge: 'badge-gray'   },
  },
};
