/* =============================================
   dashboard.js — Lógica do Dashboard
   ============================================= */

let leadsLineChart, segmentsPieChart, statesBarChart, incomeBarChart;
let currentPeriod = '7d';

document.addEventListener('DOMContentLoaded', async () => {
  await loadKPIs();
  await loadCharts('7d');
  await loadRecentLeads();
});

/* ── KPIs ─────────────────────────────────── */
async function loadKPIs() {
  const stats = await getLeadStats();
  document.getElementById('totalLeads').textContent     = stats.total.toLocaleString('pt-BR');
  document.getElementById('qualifiedLeads').textContent = stats.qualified.toLocaleString('pt-BR');
  document.getElementById('avgScore').textContent       = stats.avgScore || '—';
  document.getElementById('statesCovered').textContent  = stats.states;

  const pct = stats.total ? Math.round((stats.qualified / stats.total) * 100) : 0;
  document.getElementById('deltaLeads').textContent    = `${stats.total} cadastrados no total`;
  document.getElementById('deltaQualified').textContent = `${pct}% do total`;
  document.getElementById('deltaScore').textContent    = 'Score baseado no IBGE';
  document.getElementById('deltaStates').textContent   = `de 27 UFs`;
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

  // Segments Doughnut
  const segEntries = Object.entries(stats.segments);
  const ctxPie = document.getElementById('segmentsChart');
  if (segmentsPieChart) segmentsPieChart.destroy();
  segmentsPieChart = new Chart(ctxPie, {
    type: 'doughnut',
    data: {
      labels: segEntries.map(([k]) => k),
      datasets: [{
        data: segEntries.map(([,v]) => v),
        backgroundColor: ['#10B981','#4F46E5','#F59E0B','#94A3B8'],
        borderWidth: 2,
        borderColor: '#fff',
      }],
    },
    options: {
      responsive: true,
      cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 12 } } },
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

  // Income distribution (segmento como proxy)
  const ctxIncome = document.getElementById('incomeChart');
  if (incomeBarChart) incomeBarChart.destroy();
  const labels = ['Premium (80+)', 'Alto (60-79)', 'Médio (40-59)', 'Básico (<40)'];
  const segs = stats.segments;
  const incData = [
    segs['Premium'] || 0,
    segs['Alto Valor'] || 0,
    segs['Médio'] || 0,
    segs['Básico'] || 0,
  ];
  incomeBarChart = new Chart(ctxIncome, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Leads',
        data: incData,
        backgroundColor: ['#10B981','#4F46E5','#F59E0B','#94A3B8'],
        borderRadius: 6,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#F1F5F9' } },
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
    const seg = getSegment(l.score_ibge || 0);
    const statusBadge = {
      'novo':         'badge-blue',
      'contato':      'badge-orange',
      'qualificado':  'badge-green',
      'descartado':   'badge-red',
    }[l.status] || 'badge-gray';
    const score = l.score_ibge || 0;
    return `
      <tr>
        <td><strong>${l.nome}</strong><br><span style="color:var(--text-muted);font-size:12px">${l.email||''}</span></td>
        <td>${l.cidade || '—'}${l.estado ? ', '+l.estado : ''}</td>
        <td>
          <div class="score-bar">
            <div class="score-track"><div class="score-fill" style="width:${score}%;background:${scoreColor(score)}"></div></div>
            <span class="score-num" style="color:${scoreColor(score)}">${score}</span>
          </div>
        </td>
        <td><span class="badge ${seg.badge}">${seg.label}</span></td>
        <td><span class="badge ${statusBadge}">${l.status||'novo'}</span></td>
        <td>${formatDate(l.created_at)}</td>
        <td>
          <a href="pages/leads.html?id=${l.id}" class="btn btn-outline btn-sm">Ver</a>
        </td>
      </tr>`;
  }).join('');
}
