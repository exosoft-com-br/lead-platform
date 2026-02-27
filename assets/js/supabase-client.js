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
  if (!isDbReady()) return _localLeads();
  let q = _sbClient.from('leads_ibge').select('*').order('created_at', { ascending: false });
  if (filters.search)  q = q.ilike('nome', `%${filters.search}%`);
  if (filters.estado)  q = q.eq('estado', filters.estado);
  if (filters.cidade)  q = q.ilike('cidade', `%${filters.cidade}%`);
  if (filters.bairro)  q = q.ilike('bairro', `%${filters.bairro}%`);
  if (filters.nicho)   q = q.eq('nicho', filters.nicho);
  if (filters.status)  q = q.eq('status', filters.status);
  if (filters.limit)   q = q.limit(filters.limit);
  const { data, error } = await q;
  if (error) { console.error(error); return _localLeads(); }
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
  if (!isDbReady()) return _localStats();
  const { data, error } = await _sbClient.from('leads_ibge').select('status, segmento, score_ibge, estado');
  if (error || !data) return _localStats();

  const total     = data.length;
  const qualified = data.filter(l => l.status === 'qualificado').length;
  const avgScore  = 0;
  const states    = [...new Set(data.map(l => l.estado).filter(Boolean))].length;

  const nichoMap = {};
  data.forEach(l => { if(l.nicho) nichoMap[l.nicho] = (nichoMap[l.nicho]||0)+1; });

  const stateMap = {};
  data.forEach(l => { if(l.estado) stateMap[l.estado] = (stateMap[l.estado]||0)+1; });

  return { total, qualified, avgScore, states, nichoMap, stateMap };
}

async function getLeadsTimeSeries(days = 30) {
  if (!isDbReady()) return _demoTimeSeries(days);
  const from = new Date();
  from.setDate(from.getDate() - days);
  const { data, error } = await _sbClient.from('leads_ibge')
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

// Seed automático: popula localStorage com leads de demo se vazio ou desatualizado
function _seedDemoLeads() {
  const stored = JSON.parse(localStorage.getItem('leads_local') || '[]');
  // Re-seed se não tem dados, ou se os dados são do formato antigo (sem campo nicho)
  const isOutdated = stored.length > 0 && !stored[0].hasOwnProperty('nicho');
  if (localStorage.getItem('leads_seeded') && stored.length > 0 && !isOutdated) return;
  const hoje = new Date();
  const dias = n => { const d = new Date(hoje); d.setDate(d.getDate()-n); return d.toISOString(); };

  const demos = [
    { id:'demo-1',  nome:'Ana Paula Silva',    email:'ana@beleza.com',      telefone:'(11) 99001-1234', estado:'SP', cidade:'São Paulo',      bairro:'Vila Madalena',  nicho:'Estética e Beleza',          status:'qualificado', origem:'site',      created_at:dias(0)  },
    { id:'demo-2',  nome:'Carlos Mendes',       email:'carlos@burger.com',   telefone:'(21) 98002-5678', estado:'RJ', cidade:'Rio de Janeiro', bairro:'Barra da Tijuca', nicho:'Alimentação e Gastronomia',  status:'qualificado', origem:'ads',       created_at:dias(1)  },
    { id:'demo-3',  nome:'Fernanda Souza',      email:'fer@clinica.com',     telefone:'(31) 97003-9012', estado:'MG', cidade:'Belo Horizonte', bairro:'Savassi',        nicho:'Saúde e Bem-estar',          status:'contato',     origem:'indicacao', created_at:dias(2)  },
    { id:'demo-4',  nome:'Rafael Lima',         email:'rafael@moda.com',     telefone:'(41) 96004-3456', estado:'PR', cidade:'Curitiba',       bairro:'Batel',          nicho:'Moda e Vestuário',           status:'contato',     origem:'evento',    created_at:dias(3)  },
    { id:'demo-5',  nome:'Juliana Costa',       email:'ju@fintech.com',      telefone:'(51) 95005-7890', estado:'RS', cidade:'Porto Alegre',   bairro:'Moinhos de Vento',nicho:'Finanças e Investimentos',  status:'novo',        origem:'site',      created_at:dias(4)  },
    { id:'demo-6',  nome:'Marcos Oliveira',     email:'marcos@ti.com',       telefone:'(61) 94006-0123', estado:'DF', cidade:'Brasília',       bairro:'Asa Sul',        nicho:'Tecnologia e TI',            status:'qualificado', origem:'cold',      created_at:dias(5)  },
    { id:'demo-7',  nome:'Patrícia Santos',     email:'pat@imoveis.com',     telefone:'(71) 93007-4567', estado:'BA', cidade:'Salvador',       bairro:'Pituba',         nicho:'Imóveis',                    status:'novo',        origem:'site',      created_at:dias(6)  },
    { id:'demo-8',  nome:'Eduardo Ferreira',    email:'edu@cursos.com',      telefone:'(81) 92008-8901', estado:'PE', cidade:'Recife',         bairro:'Boa Viagem',     nicho:'Educação e Cursos',          status:'contato',     origem:'ads',       created_at:dias(8)  },
    { id:'demo-9',  nome:'Beatriz Alves',       email:'bia@ecommerce.com',   telefone:'(85) 91009-2345', estado:'CE', cidade:'Fortaleza',      bairro:'Aldeota',        nicho:'E-commerce',                 status:'novo',        origem:'site',      created_at:dias(10) },
    { id:'demo-10', nome:'Thiago Rodrigues',    email:'thiago@pet.com',      telefone:'(92) 90010-6789', estado:'AM', cidade:'Manaus',         bairro:'Adrianópolis',   nicho:'Pet Shop',                   status:'novo',        origem:'indicacao', created_at:dias(12) },
    { id:'demo-11', nome:'Camila Pereira',      email:'camila@academia.com', telefone:'(48) 99011-1111', estado:'SC', cidade:'Florianópolis',  bairro:'Trindade',       nicho:'Academia e Fitness',         status:'qualificado', origem:'evento',    created_at:dias(14) },
    { id:'demo-12', nome:'Leonardo Nascimento', email:'leo@auto.com',        telefone:'(62) 99012-2222', estado:'GO', cidade:'Goiânia',        bairro:'Setor Bueno',    nicho:'Automotivo',                 status:'contato',     origem:'cold',      created_at:dias(16) },
    { id:'demo-13', nome:'Isabela Moura',       email:'isa@reforma.com',     telefone:'(34) 99013-3333', estado:'MG', cidade:'Uberlândia',     bairro:'Centro',         nicho:'Construção e Reformas',      status:'qualificado', origem:'site',      created_at:dias(18) },
    { id:'demo-14', nome:'Roberto Castro',      email:'roberto@servicos.com',telefone:'(91) 99014-4444', estado:'PA', cidade:'Belém',          bairro:'Nazaré',         nicho:'Serviços Domésticos',        status:'descartado',  origem:'ads',       created_at:dias(20) },
    { id:'demo-15', nome:'Amanda Teixeira',     email:'amanda@beleza.sp',    telefone:'(11) 99015-5555', estado:'SP', cidade:'Campinas',       bairro:'Cambuí',         nicho:'Estética e Beleza',          status:'contato',     origem:'indicacao', created_at:dias(22) },
  ];

  localStorage.setItem('leads_local', JSON.stringify(demos));
  localStorage.setItem('leads_seeded', '1');
  console.log('[NichoLeads] 15 leads de demonstração carregados no localStorage');
}

function _localStats() {
  const data = _localLeads();
  const total = data.length;
  const qualified = data.filter(l => l.status === 'qualificado').length;
  const states = [...new Set(data.map(l => l.estado).filter(Boolean))].length;
  const nichoMap = {};
  data.forEach(l => { if(l.nicho) nichoMap[l.nicho] = (nichoMap[l.nicho]||0)+1; });
  const stateMap = {};
  data.forEach(l => { if(l.estado) stateMap[l.estado] = (stateMap[l.estado]||0)+1; });
  return { total, qualified, avgScore: 0, states, nichoMap, stateMap };
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
