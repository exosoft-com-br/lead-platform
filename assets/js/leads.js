/* =============================================
   leads.js — CRUD de Leads
   ============================================= */

let allLeads = [];
let selectedIds = new Set();
let ibgeScoreData = null;

document.addEventListener('DOMContentLoaded', async () => {
  await IBGE.popularSelectEstados(document.getElementById('fEstado'));
  await IBGE.popularSelectEstados(document.getElementById('filterEstado'));
  await loadLeads();
  // Handle #novo hash
  if (location.hash === '#novo') openModal();
  // Handle ?id= param
  const id = new URLSearchParams(location.search).get('id');
  if (id) editLead(id);
});

/* ── Load & Render ────────────────────────── */
async function loadLeads() {
  allLeads = await getLeads();
  renderLeads(allLeads);
}

function renderLeads(leads) {
  const tbody = document.getElementById('leadsBody');
  document.getElementById('totalCount').textContent = `${leads.length} leads`;

  if (!leads.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="empty-state">
            <div class="empty-icon">👤</div>
            <h3>Nenhum lead encontrado</h3>
            <p>Adicione o primeiro lead ou ajuste os filtros.</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = leads.map(l => {
    const seg = getSegment(l.score_ibge || 0);
    const score = l.score_ibge || 0;
    const statusMap = {
      novo: 'badge-blue', contato: 'badge-orange',
      qualificado: 'badge-green', descartado: 'badge-red',
    };
    return `
      <tr>
        <td><input type="checkbox" class="row-check" value="${l.id}" onchange="toggleSelect('${l.id}', this)"></td>
        <td>
          <div style="font-weight:600">${l.nome}</div>
          ${l.origem ? `<span class="badge badge-gray" style="margin-top:2px">${l.origem}</span>` : ''}
        </td>
        <td>
          <div>${l.email || '—'}</div>
          <div style="color:var(--text-muted);font-size:12px">${l.telefone || ''}</div>
        </td>
        <td>${l.cidade ? `${l.cidade}, ${l.estado}` : (l.estado || '—')}</td>
        <td>
          <div class="score-bar">
            <div class="score-track"><div class="score-fill" style="width:${score}%;background:${scoreColor(score)}"></div></div>
            <span class="score-num" style="color:${scoreColor(score)}">${score}</span>
          </div>
        </td>
        <td><span class="badge ${seg.badge}">${seg.label}</span></td>
        <td><span class="badge ${statusMap[l.status]||'badge-gray'}">${l.status||'novo'}</span></td>
        <td style="font-size:12px;color:var(--text-muted)">${formatDate(l.created_at)}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-outline btn-sm" onclick="editLead('${l.id}')">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="confirmDelete('${l.id}','${l.nome}')">🗑</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

/* ── Filters ──────────────────────────────── */
function applyFilters() {
  const search  = document.getElementById('searchInput').value.toLowerCase();
  const estado  = document.getElementById('filterEstado').value;
  const segmento= document.getElementById('filterSegmento').value;
  const status  = document.getElementById('filterStatus').value;

  const filtered = allLeads.filter(l => {
    const matchSearch  = !search || l.nome?.toLowerCase().includes(search) || l.email?.toLowerCase().includes(search);
    const matchEstado  = !estado  || l.estado === estado;
    const matchSeg     = !segmento|| l.segmento === segmento;
    const matchStatus  = !status  || l.status === status;
    return matchSearch && matchEstado && matchSeg && matchStatus;
  });
  renderLeads(filtered);
}

/* ── Modal ────────────────────────────────── */
function openModal(data = null) {
  ibgeScoreData = null;
  const modal = document.getElementById('leadModal');
  const title = document.getElementById('modalTitle');
  title.textContent = data ? 'Editar Lead' : 'Novo Lead';
  document.getElementById('leadId').value = '';

  // Reset form
  ['fNome','fEmail','fTelefone','fCpf','fCep','fNotas'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('fEstado').value  = '';
  document.getElementById('fCidade').value  = '';
  document.getElementById('fCidade').disabled = true;
  document.getElementById('fStatus').value  = 'novo';
  document.getElementById('fOrigem').value  = '';
  document.getElementById('fScoreIbge').value = '';
  document.getElementById('fSegmento').value  = '';

  if (data) {
    document.getElementById('leadId').value  = data.id;
    document.getElementById('fNome').value   = data.nome || '';
    document.getElementById('fEmail').value  = data.email || '';
    document.getElementById('fTelefone').value= data.telefone || '';
    document.getElementById('fCpf').value    = data.cpf || '';
    document.getElementById('fCep').value    = data.cep || '';
    document.getElementById('fNotas').value  = data.notas || '';
    document.getElementById('fStatus').value = data.status || 'novo';
    document.getElementById('fOrigem').value = data.origem || '';
    document.getElementById('fScoreIbge').value = data.score_ibge || '';
    document.getElementById('fSegmento').value  = data.segmento || '';

    if (data.estado) {
      document.getElementById('fEstado').value = data.estado;
      IBGE.popularSelectMunicipios(document.getElementById('fCidade'), data.estado).then(() => {
        if (data.cidade) document.getElementById('fCidade').value = data.cidade;
      });
    }

    if (data.score_ibge) {
      showIbgeData({ score: data.score_ibge, detalhes: JSON.parse(data.ibge_detalhes || '{}') });
    }
  }

  switchTab('dados', document.querySelector('.tab-btn'));
  modal.classList.add('open');
  document.getElementById('fNome').focus();
}

function closeModal() {
  document.getElementById('leadModal').classList.remove('open');
}

async function editLead(id) {
  const lead = await getLeadById(id);
  if (!lead) { toast('Lead não encontrado', 'error'); return; }
  openModal(lead);
}

/* ── Save ─────────────────────────────────── */
async function saveLead() {
  const nome = document.getElementById('fNome').value.trim();
  if (!nome) { toast('Nome é obrigatório', 'error'); return; }

  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  const lead = {
    nome,
    email:    document.getElementById('fEmail').value.trim() || null,
    telefone: document.getElementById('fTelefone').value.trim() || null,
    cpf:      document.getElementById('fCpf').value.trim() || null,
    cep:      document.getElementById('fCep').value.trim() || null,
    estado:   document.getElementById('fEstado').value || null,
    cidade:   document.getElementById('fCidade').value || null,
    notas:    document.getElementById('fNotas').value.trim() || null,
    status:   document.getElementById('fStatus').value,
    origem:   document.getElementById('fOrigem').value || null,
    score_ibge:    parseInt(document.getElementById('fScoreIbge').value) || null,
    segmento:      document.getElementById('fSegmento').value || null,
    municipio_id:  document.getElementById('fMunicipioId').value || null,
    ibge_detalhes: document.getElementById('fIbgeDetalhes').value || null,
  };

  const existingId = document.getElementById('leadId').value;
  let result;

  if (existingId) {
    result = await updateLead(existingId, lead);
    if (result.error) toast('Erro ao atualizar: ' + result.error.message, 'error');
    else toast('Lead atualizado!', 'success');
  } else {
    result = await createLead(lead);
    if (result.error) toast('Erro ao criar: ' + result.error.message, 'error');
    else toast('Lead criado com sucesso!', 'success');
  }

  btn.disabled = false;
  btn.textContent = 'Salvar Lead';

  if (!result.error) {
    closeModal();
    await loadLeads();
  }
}

/* ── Delete ───────────────────────────────── */
function confirmDelete(id, nome) {
  if (!confirm(`Deletar lead "${nome}"?`)) return;
  deleteLead(id).then(r => {
    if (r.error) toast('Erro ao deletar', 'error');
    else { toast('Lead deletado', 'warning'); loadLeads(); }
  });
}

/* ── Bulk ─────────────────────────────────── */
function toggleSelect(id, checkbox) {
  if (checkbox.checked) selectedIds.add(id);
  else selectedIds.delete(id);
  document.getElementById('bulkDeleteBtn').style.display = selectedIds.size ? 'inline-flex' : 'none';
}

function toggleSelectAll(master) {
  document.querySelectorAll('.row-check').forEach(cb => {
    cb.checked = master.checked;
    const id = cb.value;
    if (master.checked) selectedIds.add(id);
    else selectedIds.delete(id);
  });
  document.getElementById('bulkDeleteBtn').style.display = selectedIds.size ? 'inline-flex' : 'none';
}

async function bulkDelete() {
  if (!confirm(`Deletar ${selectedIds.size} lead(s)?`)) return;
  for (const id of selectedIds) await deleteLead(id);
  selectedIds.clear();
  toast(`${selectedIds.size} leads deletados`, 'warning');
  await loadLeads();
}

/* ── IBGE Integration ─────────────────────── */
async function onEstadoChange() {
  const uf = document.getElementById('fEstado').value;
  if (!uf) return;
  await IBGE.popularSelectMunicipios(document.getElementById('fCidade'), uf);
  resetIbgePanel();
}

async function onCidadeChange() {
  const cidadeOpt = document.getElementById('fCidade');
  const selectedOpt = cidadeOpt.options[cidadeOpt.selectedIndex];
  if (!selectedOpt || !selectedOpt.dataset.id) return;

  const codMunicipio = selectedOpt.dataset.id;
  const siglaUF = document.getElementById('fEstado').value;
  document.getElementById('fMunicipioId').value = codMunicipio;
  document.getElementById('ibgeLoading').textContent = 'Buscando dados IBGE (PIB, população)...';
  document.getElementById('ibgeLoading').style.display = 'block';
  document.getElementById('ibgeData').style.display = 'none';

  const result = await IBGE.calcularScoreLead(codMunicipio, siglaUF);
  ibgeScoreData = result;

  document.getElementById('fScoreIbge').value = result.score;
  const seg = getSegment(result.score);
  document.getElementById('fSegmento').value = seg.label;
  document.getElementById('fIbgeDetalhes').value = JSON.stringify(result.detalhes);

  showIbgeData(result);
}

function showIbgeData(result) {
  document.getElementById('ibgeLoading').style.display = 'none';
  document.getElementById('ibgeData').style.display = 'block';

  const seg = getSegment(result.score);
  document.getElementById('ibgeScore').textContent   = result.score;
  document.getElementById('ibgeSegmento').textContent = `Segmento: ${seg.label}`;

  const d = result.detalhes || {};
  document.getElementById('ibgePib').textContent = d.pib_per_capita
    ? `R$ ${Number(d.pib_per_capita).toLocaleString('pt-BR')}` : '—';
  document.getElementById('ibgePop').textContent = d.populacao
    ? Number(d.populacao).toLocaleString('pt-BR') : '—';
  document.getElementById('ibgeIdh').textContent = d.idh
    ? Number(d.idh).toFixed(3) : '—';
  document.getElementById('ibgeScorePib').textContent = d.score_pib ? `${d.score_pib}/100` : '—';
  document.getElementById('ibgeScoreIdh').textContent = d.score_idh ? `${d.score_idh}/100 (${d.fonte_idh||'PNUD'})` : '—';
  document.getElementById('ibgeScorePop').textContent = d.score_pop ? `${d.score_pop}/100` : '—';
}

function resetIbgePanel() {
  document.getElementById('ibgeLoading').textContent = 'Selecione estado e cidade para carregar dados do IBGE';
  document.getElementById('ibgeLoading').style.display = 'block';
  document.getElementById('ibgeData').style.display = 'none';
  document.getElementById('fScoreIbge').value = '';
  document.getElementById('fSegmento').value  = '';
}

/* ── Tabs ─────────────────────────────────── */
function switchTab(tab, btn) {
  ['dados','ibge','notas'].forEach(t => {
    document.getElementById(`tab-${t}`).style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  // Find the button either directly or by text
  const allBtns = document.querySelectorAll('.tab-btn');
  allBtns.forEach(b => {
    const tabName = b.getAttribute('onclick')?.match(/'(\w+)'/)?.[1];
    if (tabName === tab) b.classList.add('active');
  });
}

/* ── Export CSV ───────────────────────────── */
function exportCSV() {
  const headers = ['Nome','Email','Telefone','CPF','Estado','Cidade','Score IBGE','Segmento','Status','Data'];
  const rows = allLeads.map(l => [
    l.nome, l.email, l.telefone, l.cpf, l.estado, l.cidade,
    l.score_ibge, l.segmento, l.status, formatDate(l.created_at)
  ].map(v => `"${v||''}"`).join(','));

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `leads_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  toast('CSV exportado!', 'success');
}
