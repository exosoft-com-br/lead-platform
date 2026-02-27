/* =============================================
   supabase-client.js
   ============================================= */

let _sbClient = null;
let _dbReady = false;

function initSupabase() {
  try {
    console.log('[Supabase] window.supabase:', typeof window.supabase);
    // Supabase CDN v2 expõe o módulo como window.supabase
    const sbLib = window.supabase || window.supabaseJs || window['@supabase/supabase-js'];
    if (!sbLib || typeof sbLib.createClient !== 'function') {
      throw new Error('Supabase CDN não carregou (window.supabase não encontrado)');
    }
    _sbClient = sbLib.createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseKey);
    _dbReady = true;
    console.log('[Supabase] Cliente criado com sucesso. isDbReady=true');
    // Limpa dados de demo do localStorage ao conectar com Supabase real
    localStorage.removeItem('leads_local');
    localStorage.removeItem('leads_seeded');
    setDbStatus('online', 'Supabase conectado');
    // testa a query imediatamente
    _sbClient.from('leads_ibge').select('id', { count: 'exact', head: true })
      .then(({ count, error }) => {
        if (error) console.error('[Supabase] Erro ao consultar leads_ibge:', error);
        else console.log('[Supabase] leads_ibge count:', count);
      });
    // Notifica outros módulos que o cliente está pronto
    document.dispatchEvent(new CustomEvent('supabase:ready'));
    return _sbClient;
  } catch(e) {
    console.error('[Supabase] init error:', e);
    setDbStatus('offline', 'Supabase não configurado');
    return null;
  }
}

function isDbReady() {
  return _dbReady && _sbClient !== null;
}

function setDbStatus(state, text) {
  const dot  = document.querySelector('.status-dot');
  const span = document.querySelector('.status-text');
  if (!dot || !span) return;
  dot.className = `status-dot ${state}`;
  span.textContent = text;
}

/* ── LEADS CRUD ───────────────────────────── */

async function getLeads(filters = {}) {
  if (!isDbReady()) return [];
  let q = _sbClient.from('leads_ibge').select('*').order('created_at', { ascending: false });
  if (filters.search)  q = q.ilike('nome', `%${filters.search}%`);
  if (filters.estado)  q = q.eq('estado', filters.estado);
  if (filters.cidade)  q = q.ilike('cidade', `%${filters.cidade}%`);
  if (filters.bairro)  q = q.ilike('bairro', `%${filters.bairro}%`);
  if (filters.nicho)   q = q.eq('nicho', filters.nicho);
  if (filters.status)  q = q.eq('status', filters.status);
  if (filters.limit)   q = q.limit(filters.limit);
  const { data, error } = await q;
  if (error) { console.error(error); return []; }
  return data ?? [];
}

async function getLeadById(id) {
  if (!isDbReady()) return null;
  const { data, error } = await _sbClient.from('leads_ibge').select('*').eq('id', id).single();
  if (error) return null;
  return data;
}

async function createLead(lead) {
  if (!isDbReady()) {
    const stored = JSON.parse(localStorage.getItem('leads_local') || '[]');
    const newLead = { ...lead, id: Date.now().toString(), created_at: new Date().toISOString() };
    stored.unshift(newLead);
    localStorage.setItem('leads_local', JSON.stringify(stored));
    return { data: newLead, error: null };
  }
  const { data, error } = await _sbClient.from('leads_ibge').insert([lead]).select().single();
  return { data, error };
}

async function updateLead(id, updates) {
  if (!isDbReady()) return { error: 'DB offline' };
  const { data, error } = await _sbClient.from('leads_ibge').update(updates).eq('id', id).select().single();
  return { data, error };
}

async function deleteLead(id) {
  if (!isDbReady()) return { error: null };
  const { error } = await _sbClient.from('leads_ibge').delete().eq('id', id);
  return { error };
}

async function getLeadStats() {
  const empty = { total:0, qualified:0, avgScore:0, states:0, nichoMap:{}, stateMap:{}, segMap:{} };
  if (!isDbReady()) return empty;
  const { data, error } = await _sbClient.from('leads_ibge').select('status, nicho, score_ibge, estado');
  if (error || !data) return empty;

  const total     = data.length;
  const qualified = data.filter(l => l.status === 'qualificado').length;
  const states    = [...new Set(data.map(l => l.estado).filter(Boolean))].length;

  const nichoMap = {};
  data.forEach(l => { if(l.nicho) nichoMap[l.nicho] = (nichoMap[l.nicho]||0)+1; });

  const stateMap = {};
  data.forEach(l => { if(l.estado) stateMap[l.estado] = (stateMap[l.estado]||0)+1; });

  // Segmentos IBGE por score
  const segMap = { 'Premium':0, 'Alto Valor':0, 'Médio':0, 'Básico':0 };
  data.forEach(l => {
    const s = getSegment(l.score_ibge || 0);
    segMap[s.label] = (segMap[s.label]||0)+1;
  });

  return { total, qualified, avgScore:0, states, nichoMap, stateMap, segMap };
}

async function getLeadsTimeSeries(days = 30) {
  if (!isDbReady()) {
    const labels=[], values=[];
    for(let i=days-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);labels.push(d.toISOString().slice(5,10));values.push(0);}
    return {labels,values};
  }
  const from = new Date();
  from.setDate(from.getDate() - days);
  const { data, error } = await _sbClient.from('leads_ibge')
    .select('created_at')
    .gte('created_at', from.toISOString())
    .order('created_at');
  if (error || !data) { const labels=[],values=[];for(let i=days-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);labels.push(d.toISOString().slice(5,10));values.push(0);}return{labels,values}; }
  const map = {};
  data.forEach(l => {
    const d = l.created_at.slice(0,10);
    map[d] = (map[d]||0)+1;
  });
  const labels=[], values=[];
  for (let i=days-1; i>=0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i);
    const key = d.toISOString().slice(0,10);
    labels.push(key.slice(5));
    values.push(map[key]||0);
  }
  return { labels, values };
}

/* ── Toast ────────────────────────────────── */

function toast(msg, type='info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

/* ── Helpers ──────────────────────────────── */

function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function getSegment(score) {
  if (score >= 80) return { label: 'Premium',    color: '#10B981', min: 80 };
  if (score >= 60) return { label: 'Alto Valor', color: '#4F46E5', min: 60 };
  if (score >= 40) return { label: 'Médio',      color: '#F59E0B', min: 40 };
  return              { label: 'Básico',      color: '#94A3B8', min:  0 };
}

function scoreColor(score) {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#4F46E5';
  if (score >= 40) return '#F59E0B';
  return '#EF4444';
}

// Init on load
function initSupabaseOnLoad() {
  if (APP_CONFIG.supabaseUrl.includes('SEU_PROJETO')) {
    setDbStatus('offline', 'Modo demo — configure o Supabase para dados reais');
    return;
  }
  setDbStatus('connecting', 'Conectando...');
  initSupabase();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSupabaseOnLoad);
} else {
  initSupabaseOnLoad();
}

// Log de erros de Promise não capturados (não destrói a página)
window.addEventListener('unhandledrejection', function(e) {
  console.error('[NichoLeads] Promise não capturada:', e.reason);
});
