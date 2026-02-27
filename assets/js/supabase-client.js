/* =============================================
   supabase-client.js
   ============================================= */

let supabase = null;
let _dbReady = false;

function initSupabase() {
  try {
    const { createClient } = window.supabase;
    supabase = createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseKey);
    _dbReady = true;
    setDbStatus('online', 'Supabase conectado');
    return supabase;
  } catch(e) {
    console.error('Supabase init error:', e);
    setDbStatus('offline', 'Erro na conexão');
    return null;
  }
}

function isDbReady() {
  return _dbReady && supabase !== null;
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
  if (!isDbReady()) return _localLeads();
  let q = supabase.from('leads').select('*').order('created_at', { ascending: false });
  if (filters.search)  q = q.ilike('nome', `%${filters.search}%`);
  if (filters.estado)  q = q.eq('estado', filters.estado);
  if (filters.segment) q = q.eq('segmento', filters.segment);
  if (filters.status)  q = q.eq('status', filters.status);
  if (filters.limit)   q = q.limit(filters.limit);
  const { data, error } = await q;
  if (error) { console.error(error); return _localLeads(); }
  return data ?? [];
}

async function getLeadById(id) {
  if (!isDbReady()) return null;
  const { data, error } = await supabase.from('leads').select('*').eq('id', id).single();
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
  const { data, error } = await supabase.from('leads').insert([lead]).select().single();
  return { data, error };
}

async function updateLead(id, updates) {
  if (!isDbReady()) return { error: 'DB offline' };
  const { data, error } = await supabase.from('leads').update(updates).eq('id', id).select().single();
  return { data, error };
}

async function deleteLead(id) {
  if (!isDbReady()) return { error: null };
  const { error } = await supabase.from('leads').delete().eq('id', id);
  return { error };
}

async function getLeadStats() {
  if (!isDbReady()) return _localStats();
  const { data, error } = await supabase.from('leads').select('status, segmento, score_ibge, estado');
  if (error || !data) return _localStats();

  const total     = data.length;
  const qualified = data.filter(l => l.status === 'qualificado').length;
  const avgScore  = total ? Math.round(data.reduce((s,l) => s + (l.score_ibge||0), 0) / total) : 0;
  const states    = [...new Set(data.map(l => l.estado).filter(Boolean))].length;

  const segments = {};
  data.forEach(l => { if(l.segmento) segments[l.segmento] = (segments[l.segmento]||0)+1; });

  const stateMap = {};
  data.forEach(l => { if(l.estado) stateMap[l.estado] = (stateMap[l.estado]||0)+1; });

  return { total, qualified, avgScore, states, segments, stateMap };
}

async function getLeadsTimeSeries(days = 30) {
  if (!isDbReady()) return _demoTimeSeries(days);
  const from = new Date();
  from.setDate(from.getDate() - days);
  const { data, error } = await supabase.from('leads')
    .select('created_at')
    .gte('created_at', from.toISOString())
    .order('created_at');
  if (error || !data) return _demoTimeSeries(days);
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

/* ── Local Fallback (sem Supabase) ─────────── */

function _localLeads() {
  return JSON.parse(localStorage.getItem('leads_local') || '[]');
}

function _localStats() {
  const data = _localLeads();
  const total = data.length;
  const qualified = data.filter(l => l.status === 'qualificado').length;
  const avgScore  = total ? Math.round(data.reduce((s,l) => s + (l.score_ibge||0), 0) / total) : 0;
  const states = [...new Set(data.map(l => l.estado).filter(Boolean))].length;
  const segments = {};
  data.forEach(l => { if(l.segmento) segments[l.segmento] = (segments[l.segmento]||0)+1; });
  const stateMap = {};
  data.forEach(l => { if(l.estado) stateMap[l.estado] = (stateMap[l.estado]||0)+1; });
  return { total, qualified, avgScore, states, segments, stateMap };
}

function _demoTimeSeries(days) {
  const labels=[], values=[];
  for (let i=days-1; i>=0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i);
    labels.push(d.toISOString().slice(5,10));
    values.push(Math.floor(Math.random()*8));
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
  const s = APP_CONFIG.segments;
  if (score >= s.premium.min) return s.premium;
  if (score >= s.alto.min)    return s.alto;
  if (score >= s.medio.min)   return s.medio;
  return s.baixo;
}

function scoreColor(score) {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#4F46E5';
  if (score >= 40) return '#F59E0B';
  return '#EF4444';
}

// Init on load
document.addEventListener('DOMContentLoaded', () => {
  if (APP_CONFIG.supabaseUrl.includes('SEU_PROJETO')) {
    setDbStatus('offline', 'Configure o Supabase');
    return;
  }
  setDbStatus('connecting', 'Conectando...');
  initSupabase();
});
