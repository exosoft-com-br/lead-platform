/* =============================================
   analysis.js — Análise IBGE por Município
   ============================================= */

let radarChart = null;
let currentMunicipio = null;
let currentScore = null;

// Funções auxiliares locais (não dependem de APP_CONFIG)
function getSegment(score) {
  if (score >= 80) return { label: 'Premium',    color: '#10B981' };
  if (score >= 60) return { label: 'Alto Valor', color: '#4F46E5' };
  if (score >= 40) return { label: 'Médio',      color: '#F59E0B' };
  return              { label: 'Básico',      color: '#94A3B8' };
}
function scoreColor(score) {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#4F46E5';
  if (score >= 40) return '#F59E0B';
  return '#94A3B8';
}

async function initAnalysis() {
  await IBGE.popularSelectEstados(document.getElementById('anaEstado'));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAnalysis);
} else {
  initAnalysis();
}

async function onAnaEstadoChange() {
  const uf = document.getElementById('anaEstado').value;
  if (!uf) return;
  await IBGE.popularSelectMunicipios(document.getElementById('anaCidade'), uf);
  await loadMunicipios(uf);
}

async function onAnaCidadeChange() {
  const cidadeEl = document.getElementById('anaCidade');
  const opt = cidadeEl.options[cidadeEl.selectedIndex];
  if (!opt || !opt.dataset.id) return;

  currentMunicipio = { nome: opt.value, id: opt.dataset.id };
  await analyzemunicipality(opt.dataset.id, opt.value);
}

async function analyzemunicipality(codMunicipio, nome) {
  document.getElementById('emptyAnalysis').style.display  = 'none';
  document.getElementById('resultPanel').style.display    = 'block';

  // Hero placeholders
  document.getElementById('heroMunicipio').textContent = `📍 ${nome} — Carregando dados IBGE...`;
  document.getElementById('heroScore').textContent    = '...';
  document.getElementById('heroSegmento').textContent = '...';

  const uf = document.getElementById('anaEstado').value;
  const result = await IBGE.calcularScoreLead(codMunicipio, uf);
  const seg = getSegment(result.score);

  // Hero
  currentScore = result.score;
  document.getElementById('heroMunicipio').textContent = `📍 ${nome}`;
  document.getElementById('heroScore').textContent    = result.score;
  document.getElementById('heroSegmento').textContent = seg.label;

  const d = result.detalhes;

  // KPI cards
  const grid = document.getElementById('indicatorsGrid');
  grid.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-icon blue">💰</div>
      <div class="kpi-info">
        <p class="kpi-label">PIB per capita est.</p>
        <h2 class="kpi-value">R$${d.pib_per_capita ? Number(d.pib_per_capita).toLocaleString('pt-BR',{maximumFractionDigits:0}) : '—'}</h2>
        <span class="kpi-delta">Score: ${d.score_pib||'—'}/100 · ${d.fonte_pib||'IBGE SIDRA'}</span>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon green">👥</div>
      <div class="kpi-info">
        <p class="kpi-label">População</p>
        <h2 class="kpi-value">${d.populacao ? Number(d.populacao).toLocaleString('pt-BR') : '—'}</h2>
        <span class="kpi-delta">Score: ${d.score_pop||'—'}/100 · ${d.fonte_pop||'IBGE Censo 2022'}</span>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon orange">📚</div>
      <div class="kpi-info">
        <p class="kpi-label">IDHM ref. UF</p>
        <h2 class="kpi-value">${d.idh ? Number(d.idh).toFixed(3) : '—'}</h2>
        <span class="kpi-delta">Score: ${d.score_idh||'—'}/100 · ${d.fonte_idh||'PNUD'}</span>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon purple">🏆</div>
      <div class="kpi-info">
        <p class="kpi-label">Score Geral</p>
        <h2 class="kpi-value" style="color:${scoreColor(result.score)}">${result.score}</h2>
        <span class="kpi-delta">${seg.label}</span>
      </div>
    </div>
  `;

  // Radar Chart
  const ctx = document.getElementById('scoreRadar');
  if (radarChart) radarChart.destroy();
  radarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['PIB per capita', 'População', 'IDH', 'Qualificação Est.'],
      datasets: [{
        label: nome,
        data: [d.score_pib||0, d.score_pop||0, d.score_idh||0, Math.round((d.score_pib+d.score_idh)/2)||0],
        backgroundColor: 'rgba(79,70,229,.15)',
        borderColor: '#4F46E5',
        pointBackgroundColor: '#4F46E5',
        pointRadius: 5,
      }],
    },
    options: {
      responsive: true,
      scales: {
        r: {
          min: 0, max: 100,
          ticks: { stepSize: 20, font: { size: 11 } },
          pointLabels: { font: { size: 12 } },
        },
      },
    },
  });

  // Raw data list
  document.getElementById('rawDataList').innerHTML = `
    <div class="info-row"><span>Código IBGE</span><strong>${codMunicipio}</strong></div>
    <div class="info-row"><span>PIB per capita est.</span><strong>${d.pib_per_capita ? 'R$ '+Number(d.pib_per_capita).toLocaleString('pt-BR') : 'N/D'}</strong></div>
    <div class="info-row" style="font-size:11px;color:var(--text-muted)"><span>Fonte PIB</span><span>${d.fonte_pib||'IBGE SIDRA'}</span></div>
    <div class="info-row"><span>População</span><strong>${d.populacao ? Number(d.populacao).toLocaleString('pt-BR') : 'N/D'}</strong></div>
    <div class="info-row" style="font-size:11px;color:var(--text-muted)"><span>Fonte Pop</span><span>${d.fonte_pop||'IBGE Censo 2022'}</span></div>
    <div class="info-row"><span>IDHM (ref. UF)</span><strong>${d.idh ? Number(d.idh).toFixed(3) : 'N/D'}</strong></div>
    <div class="info-row" style="font-size:11px;color:var(--text-muted)"><span>Fonte IDH</span><span>${d.fonte_idh||'PNUD Atlas'}</span></div>
    <div class="info-row"><span>Score PIB</span><strong>${d.score_pib||0}/100</strong></div>
    <div class="info-row"><span>Score Pop</span><strong>${d.score_pop||0}/100</strong></div>
    <div class="info-row"><span>Score IDH</span><strong>${d.score_idh||0}/100</strong></div>
    <div class="info-row"><span><strong>Score Total</strong></span><strong style="color:${scoreColor(result.score)};font-size:16px">${result.score}/100</strong></div>
  `;
}

let _allMunicipios = [];

async function loadMunicipios(uf) {
  const tbody = document.getElementById('municipiosBody');
  const searchEl = document.getElementById('municipioSearch');
  if (searchEl) { searchEl.value = ''; }
  tbody.innerHTML = '<tr><td colspan="4" class="loading-row">Carregando municípios...</td></tr>';
  _allMunicipios = await IBGE.getMunicipios(uf);
  document.getElementById('municipiosTitle').textContent = `Municípios de ${uf}`;
  document.getElementById('municipiosCount').textContent = `${_allMunicipios.length} municípios`;
  renderMunicipiosTable(_allMunicipios);
}

function renderMunicipiosTable(list) {
  const tbody = document.getElementById('municipiosBody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="loading-row">Nenhum município encontrado.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map((m, i) => `
    <tr>
      <td>${i+1}</td>
      <td>${m.nome}</td>
      <td style="color:var(--text-muted);font-family:monospace">${m.id}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="selectMunicipio('${m.id}', '${m.nome.replace(/'/g,"\\'")}')">Analisar</button>
      </td>
    </tr>`).join('');
}

function filtrarMunicipios(term) {
  const t = term.trim().toLowerCase();
  const filtered = t ? _allMunicipios.filter(m => m.nome.toLowerCase().includes(t)) : _allMunicipios;
  document.getElementById('municipiosCount').textContent = `${filtered.length} de ${_allMunicipios.length} municípios`;
  renderMunicipiosTable(filtered);
}

function selectMunicipio(id, nome) {
  // Update cidade select
  const cidadeEl = document.getElementById('anaCidade');
  Array.from(cidadeEl.options).forEach(opt => {
    if (opt.dataset.id === String(id)) { cidadeEl.value = opt.value; }
  });
  analyzemunicipality(id, nome);
}

function addLeadFromAnalysis() {
  const uf     = document.getElementById('anaEstado').value;
  const cidade = document.getElementById('anaCidade').value;
  const score  = currentScore ?? '';
  const params = new URLSearchParams({ novo:'1', estado:uf, cidade, municipio:cidade, score });
  window.location.href = `leads.html?${params.toString()}`;
}
