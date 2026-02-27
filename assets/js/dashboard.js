/* =============================================
   dashboard.js — Lógica do Dashboard
   ============================================= */

let leadsLineChart, segmentsPieChart, statesBarChart, incomeBarChart;
let currentPeriod = '7d';

async function initDashboard() {
  await loadKPIs();
  await loadCharts('7d');
  await loadRecentLeads();
}

// Compatível com scripts no final do body e no head
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  initDashboard();
}

// Recarrega dashboard quando Supabase conectar (resolve race condition)
document.addEventListener('supabase:ready', () => {
  console.log('[dashboard] supabase:ready — recarregando dashboard');
  initDashboard();
});

/* ── KPIs ─────────────────────────────────── */
async function loadKPIs() {
  const stats = await getLeadStats();
  const nichoCount = Object.keys(stats.nichoMap || {}).length;

  document.getElementById('totalLeads').textContent     = stats.total.toLocaleString('pt-BR');
  document.getElementById('qualifiedLeads').textContent = stats.qualified.toLocaleString('pt-BR');
  document.getElementById('avgScore').textContent       = nichoCount || '—';
  document.getElementById('statesCovered').textContent  = stats.states;

  const pct = stats.total ? Math.round((stats.qualified / stats.total) * 100) : 0;
  document.getElementById('deltaLeads').textContent     = `${stats.total} cadastrados no total`;
  document.getElementById('deltaQualified').textContent = `${pct}% do total`;
  document.getElementById('deltaScore').textContent     = `tipos de nicho`;
  document.getElementById('deltaStates').textContent    = `de 27 UFs`;
}

/* ── Charts ───────────────────────────────── */
async function loadCharts(period) {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const ts = await getLeadsTimeSeries(days);
  const stats = await getLeadStats();

  // Leads Line
  const ctxLine = document.getElementById('leadsChart');
  if (leadsLineChart) leadsLineChart.destroy();
  leadsLineChart = new Chart(ctxLine, {
    type: 'line',
    data: {
      labels: ts.labels,
      datasets: [{
        label: 'Novos Leads',
        data: ts.values,
        borderColor: '#4F46E5',
        backgroundColor: 'rgba(79,70,229,.08)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: '#4F46E5',
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: '#F1F5F9' } },
      },
    },
  });

  // Nichos Doughnut
  const nichoEntries = Object.entries(stats.nichoMap || {}).sort((a,b)=>b[1]-a[1]);
  const ctxPie = document.getElementById('segmentsChart');
  if (segmentsPieChart) segmentsPieChart.destroy();
  segmentsPieChart = new Chart(ctxPie, {
    type: 'doughnut',
    data: {
      labels: nichoEntries.map(([k]) => k),
      datasets: [{
        data: nichoEntries.map(([,v]) => v),
        backgroundColor: ['#4F46E5','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#F97316','#84CC16','#EC4899','#14B8A6'],
        borderWidth: 2,
        borderColor: '#fff',
      }],
    },
    options: {
      responsive: true,
      cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
      },
    },
  });

  // States Bar
  const stateEntries = Object.entries(stats.stateMap).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const ctxBar = document.getElementById('statesChart');
  if (statesBarChart) statesBarChart.destroy();
  statesBarChart = new Chart(ctxBar, {
    type: 'bar',
    data: {
      labels: stateEntries.map(([k])=>k),
      datasets: [{
        label: 'Leads',
        data: stateEntries.map(([,v])=>v),
        backgroundColor: '#818CF8',
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: '#F1F5F9' } },
      },
    },
  });

  // Top Nichos por estado (barras horizontais)
  const ctxIncome = document.getElementById('incomeChart');
  if (incomeBarChart) incomeBarChart.destroy();
  const topNichos = Object.entries(stats.nichoMap || {}).sort((a,b)=>b[1]-a[1]).slice(0, 6);
  incomeBarChart = new Chart(ctxIncome, {
    type: 'bar',
    data: {
      labels: topNichos.map(([k]) => k),
      datasets: [{
        label: 'Leads',
        data: topNichos.map(([,v]) => v),
        backgroundColor: ['#4F46E5','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4'],
        borderRadius: 6,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#F1F5F9' }, beginAtZero: true },
        y: { grid: { display: false } },
      },
    },
  });
}

function setChartPeriod(period, btn) {
  currentPeriod = period;
  document.querySelectorAll('.chart-actions .chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  loadCharts(period);
}

/* ── Recent Leads Table ───────────────────── */
async function loadRecentLeads() {
  const tbody = document.getElementById('recentLeadsBody');
  const leads = await getLeads({ limit: 8 });

  if (!leads.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="loading-row">
          Nenhum lead cadastrado ainda.
          <a href="pages/leads.html#novo" style="color:var(--primary)">Adicionar o primeiro lead →</a>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = leads.map(l => {
    const statusBadge = {
      'novo':         'badge-blue',
      'contato':      'badge-orange',
      'qualificado':  'badge-green',
      'descartado':   'badge-red',
    }[l.status] || 'badge-gray';
    return `
      <tr>
        <td><strong>${l.nome}</strong><br><span style="color:var(--text-muted);font-size:12px">${l.email||''}</span></td>
        <td>
          ${l.cidade || '—'}${l.estado ? ', '+l.estado : ''}
          ${l.bairro ? `<br><span style="color:var(--text-muted);font-size:12px">📍 ${l.bairro}</span>` : ''}
        </td>
        <td>${l.nicho ? `<span class="badge badge-blue">${l.nicho}</span>` : '—'}</td>
        <td><span class="badge ${statusBadge}">${l.status||'novo'}</span></td>
        <td>${formatDate(l.created_at)}</td>
        <td>
          <a href="pages/leads.html?id=${l.id}" class="btn btn-outline btn-sm">Ver</a>
        </td>
      </tr>`;
  }).join('');
}
