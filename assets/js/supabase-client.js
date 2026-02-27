/* =============================================
   supabase-client.js
   ============================================= */

let supabase = null;
let _dbReady = false;

function initSupabase() {
  try {
    // Supabase CDN v2 expõe o módulo como window.supabase
    const sbLib = window.supabase || window.supabaseJs || window['@supabase/supabase-js'];
    if (!sbLib || typeof sbLib.createClient !== 'function') {
      throw new Error('Supabase CDN não carregou (window.supabase não encontrado)');
    }
    supabase = sbLib.createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseKey);
    _dbReady = true;
    setDbStatus('online', 'Supabase conectado');
    return supabase;
  } catch(e) {
    console.error('Supabase init error:', e);
    setDbStatus('offline', 'Supabase não configurado');
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
  let q = supabase.from('leads_ibge').select('*').order('created_at', { ascending: false });
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
  const { data, error } = await supabase.from('leads_ibge').select('*').eq('id', id).single();
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
  const { data, error } = await supabase.from('leads_ibge').insert([lead]).select().single();
  return { data, error };
}

async function updateLead(id, updates) {
  if (!isDbReady()) return { error: 'DB offline' };
  const { data, error } = await supabase.from('leads_ibge').update(updates).eq('id', id).select().single();
  return { data, error };
}

async function deleteLead(id) {
  if (!isDbReady()) return { error: null };
  const { error } = await supabase.from('leads_ibge').delete().eq('id', id);
  return { error };
}

async function getLeadStats() {
  if (!isDbReady()) return _localStats();
  const { data, error } = await supabase.from('leads_ibge').select('status, segmento, score_ibge, estado');
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
  const { data, error } = await supabase.from('leads_ibge')
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

// Seed automático: popula localStorage com leads de demo se vazio
function _seedDemoLeads() {
  if (localStorage.getItem('leads_seeded')) return;
  const hoje = new Date();
  const dias = n => { const d = new Date(hoje); d.setDate(d.getDate()-n); return d.toISOString(); };

  const demos = [
    { id:'demo-1',  nome:'Ana Paula Silva',    email:'ana.silva@empresa.com',    telefone:'(11) 99001-1234', estado:'SP', cidade:'São Paulo',       municipio_id:'3550308', score_ibge:87, segmento:'Premium',   status:'qualificado', origem:'site',      created_at:dias(0),  ibge_detalhes:'{"pib_per_capita":72387,"populacao":11451999,"idh":0.783,"score_pib":90,"score_pop":100,"score_idh":78}' },
    { id:'demo-2',  nome:'Carlos Mendes',       email:'carlos@negocio.com.br',    telefone:'(21) 98002-5678', estado:'RJ', cidade:'Rio de Janeiro',  municipio_id:'3304557', score_ibge:82, segmento:'Premium',   status:'qualificado', origem:'ads',       created_at:dias(1),  ibge_detalhes:'{"pib_per_capita":44000,"populacao":6211223,"idh":0.761,"score_pib":55,"score_pop":95,"score_idh":76}' },
    { id:'demo-3',  nome:'Fernanda Souza',      email:'fernanda@tech.com',        telefone:'(31) 97003-9012', estado:'MG', cidade:'Belo Horizonte',  municipio_id:'3106200', score_ibge:74, segmento:'Alto Valor', status:'contato',     origem:'indicacao', created_at:dias(2),  ibge_detalhes:'{"pib_per_capita":35000,"populacao":2315560,"idh":0.810,"score_pib":44,"score_pop":90,"score_idh":81}' },
    { id:'demo-4',  nome:'Rafael Lima',         email:'rafael@consultoria.com',   telefone:'(41) 96004-3456', estado:'PR', cidade:'Curitiba',        municipio_id:'4106902', score_ibge:78, segmento:'Alto Valor', status:'contato',     origem:'evento',    created_at:dias(3),  ibge_detalhes:'{"pib_per_capita":42000,"populacao":1718421,"idh":0.823,"score_pib":52,"score_pop":88,"score_idh":82}' },
    { id:'demo-5',  nome:'Juliana Costa',       email:'ju.costa@financas.com',    telefone:'(51) 95005-7890', estado:'RS', cidade:'Porto Alegre',    municipio_id:'4314902', score_ibge:76, segmento:'Alto Valor', status:'novo',        origem:'site',      created_at:dias(4),  ibge_detalhes:'{"pib_per_capita":40000,"populacao":1290491,"idh":0.805,"score_pib":50,"score_pop":86,"score_idh":80}' },
    { id:'demo-6',  nome:'Marcos Oliveira',     email:'marcos@gov.df.br',         telefone:'(61) 94006-0123', estado:'DF', cidade:'Brasília',        municipio_id:'5300108', score_ibge:88, segmento:'Premium',   status:'qualificado', origem:'cold',      created_at:dias(5),  ibge_detalhes:'{"pib_per_capita":75000,"populacao":2817381,"idh":0.824,"score_pib":94,"score_pop":91,"score_idh":82}' },
    { id:'demo-7',  nome:'Patrícia Santos',     email:'pat.santos@varejo.com',    telefone:'(71) 93007-4567', estado:'BA', cidade:'Salvador',        municipio_id:'2927408', score_ibge:56, segmento:'Médio',     status:'novo',        origem:'site',      created_at:dias(6),  ibge_detalhes:'{"pib_per_capita":18000,"populacao":2418005,"idh":0.759,"score_pib":22,"score_pop":91,"score_idh":76}' },
    { id:'demo-8',  nome:'Eduardo Ferreira',    email:'edu.fe@industria.pe',      telefone:'(81) 92008-8901', estado:'PE', cidade:'Recife',          municipio_id:'2611606', score_ibge:61, segmento:'Alto Valor', status:'contato',     origem:'ads',       created_at:dias(8),  ibge_detalhes:'{"pib_per_capita":22000,"populacao":1488920,"idh":0.772,"score_pib":27,"score_pop":88,"score_idh":77}' },
    { id:'demo-9',  nome:'Beatriz Alves',       email:'bia@startup.ce',           telefone:'(85) 91009-2345', estado:'CE', cidade:'Fortaleza',       municipio_id:'2304400', score_ibge:58, segmento:'Médio',     status:'novo',        origem:'site',      created_at:dias(10), ibge_detalhes:'{"pib_per_capita":16000,"populacao":2428678,"idh":0.754,"score_pib":20,"score_pop":91,"score_idh":75}' },
    { id:'demo-10', nome:'Thiago Rodrigues',    email:'thiago@amazon.am',         telefone:'(92) 90010-6789', estado:'AM', cidade:'Manaus',          municipio_id:'1302603', score_ibge:62, segmento:'Alto Valor', status:'novo',        origem:'indicacao', created_at:dias(12), ibge_detalhes:'{"pib_per_capita":28000,"populacao":2063547,"idh":0.737,"score_pib":35,"score_pop":89,"score_idh":74}' },
    { id:'demo-11', nome:'Camila Pereira',      email:'camila@logistica.sc',      telefone:'(48) 99011-1111', estado:'SC', cidade:'Florianópolis',   municipio_id:'4205407', score_ibge:81, segmento:'Premium',   status:'qualificado', origem:'evento',    created_at:dias(14), ibge_detalhes:'{"pib_per_capita":48000,"populacao":516524,"idh":0.847,"score_pib":60,"score_pop":79,"score_idh":85}' },
    { id:'demo-12', nome:'Leonardo Nascimento', email:'leo@agro.go',              telefone:'(62) 99012-2222', estado:'GO', cidade:'Goiânia',         municipio_id:'5208707', score_ibge:70, segmento:'Alto Valor', status:'contato',     origem:'cold',      created_at:dias(16), ibge_detalhes:'{"pib_per_capita":30000,"populacao":1466105,"idh":0.799,"score_pib":37,"score_pop":87,"score_idh":80}' },
    { id:'demo-13', nome:'Isabela Moura',       email:'isa.moura@saude.mg',       telefone:'(34) 99013-3333', estado:'MG', cidade:'Uberlândia',      municipio_id:'3170206', score_ibge:73, segmento:'Alto Valor', status:'qualificado', origem:'site',      created_at:dias(18), ibge_detalhes:'{"pib_per_capita":38000,"populacao":699097,"idh":0.789,"score_pib":47,"score_pop":83,"score_idh":79}' },
    { id:'demo-14', nome:'Roberto Castro',      email:'roberto@energia.pa',       telefone:'(91) 99014-4444', estado:'PA', cidade:'Belém',           municipio_id:'1501402', score_ibge:50, segmento:'Médio',     status:'descartado',  origem:'ads',       created_at:dias(20), ibge_detalhes:'{"pib_per_capita":15000,"populacao":1303403,"idh":0.746,"score_pib":19,"score_pop":86,"score_idh":75}' },
    { id:'demo-15', nome:'Amanda Teixeira',     email:'amanda@moda.sp',           telefone:'(11) 99015-5555', estado:'SP', cidade:'Campinas',        municipio_id:'3509502', score_ibge:79, segmento:'Alto Valor', status:'contato',     origem:'indicacao', created_at:dias(22), ibge_detalhes:'{"pib_per_capita":45000,"populacao":1139047,"idh":0.805,"score_pib":56,"score_pop":85,"score_idh":80}' },
  ];

  localStorage.setItem('leads_local', JSON.stringify(demos));
  localStorage.setItem('leads_seeded', '1');
  console.log('[LeadIBGE] 15 leads de demonstração carregados no localStorage');
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
function initSupabaseOnLoad() {
  // Sempre semeia dados de demo no localStorage na primeira visita
  // (usado como fallback se Supabase não conectar ou tabela estiver vazia)
  _seedDemoLeads();

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
