/* =============================================
   config.js — Configure suas credenciais aqui
   ============================================= */

// Carrega credenciais salvas no navegador (definidas em Configurações)
const _savedUrl = localStorage.getItem('sb_url') || '';
const _savedKey = localStorage.getItem('sb_key') || '';

const APP_CONFIG = {
  // ── Supabase ──────────────────────────────
  supabaseUrl: _savedUrl || 'https://bhargdkruycbrcanfvuz.supabase.co',
  supabaseKey: _savedKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoYXJnZGtydXljYnJjYW5mdnV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NzQ1NzgsImV4cCI6MjA4NzQ1MDU3OH0.jBRK_IhUNzxMzf_4UNjpabgwEB7MpqrTL29qTvZK_os',

  // ── App ───────────────────────────────────
  appName: 'NichoLeads',
  version: '2.0.0',

  // ── IBGE API ──────────────────────────────
  ibgeBaseUrl: 'https://servicodados.ibge.gov.br/api',

  // ── Nichos de Produto ─────────────────────
  nichos: [
    'Estética e Beleza',
    'Alimentação e Gastronomia',
    'Saúde e Bem-estar',
    'Moda e Vestuário',
    'Tecnologia e TI',
    'Imóveis',
    'Educação e Cursos',
    'Finanças e Investimentos',
    'Serviços Domésticos',
    'E-commerce',
    'Automotivo',
    'Pet Shop',
    'Academia e Fitness',
    'Construção e Reformas',
    'Outros',
  ],

  // ── Status ────────────────────────────────
  statusList: [
    { value: 'novo',        label: 'Novo',         badge: 'badge-blue'   },
    { value: 'contato',     label: 'Em Contato',   badge: 'badge-orange' },
    { value: 'qualificado', label: 'Qualificado',  badge: 'badge-green'  },
    { value: 'descartado',  label: 'Descartado',   badge: 'badge-red'    },
  ],
};