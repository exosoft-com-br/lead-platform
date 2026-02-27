/* =============================================
   leads.js — CRUD de Leads por Nicho/Localização
   ============================================= */

let allLeads = [];
let selectedIds = new Set();

async function initLeads() {
  await IBGE.popularSelectEstados(document.getElementById('fEstado'));
  await IBGE.popularSelectEstados(document.getElementById('filterEstado'));
  _popularNichos(document.getElementById('fNicho'));
  _popularNichos(document.getElementById('filterNicho'));
  await loadLeads();
  if (location.hash === '#novo') openModal();
  const id = new URLSearchParams(location.search).get('id');
  if (id) editLead(id);
}

function _popularNichos(select) {
  if (!select) return;
  APP_CONFIG.nichos.forEach(n => {
    const opt = document.createElement('option');
    opt.value = n;
    opt.textContent = n;
    select.appendChild(opt);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLeads);
} else {
  initLeads();
}

// Recarrega leads quando Supabase conectar (resolve race condition)
document.addEventListener('supabase:ready', () => {
  console.log('[leads] supabase:ready recebido — recarregando leads');
  loadLeads();
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
        <td colspan="8">
          <div class="empty-state">
            <div class="empty-icon">🎯</div>
            <h3>Nenhum lead encontrado</h3>
            <p>Adicione o primeiro lead ou ajuste os filtros.</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  const statusMap = {
    novo: 'badge-blue', contato: 'badge-orange',
    qualificado: 'badge-green', descartado: 'badge-red',
  };

  tbody.innerHTML = leads.map(l => `
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
      <td>
        <div>${l.cidade ? `${l.cidade}${l.estado ? ', '+l.estado : ''}` : (l.estado || '—')}</div>
        ${l.bairro ? `<div style="color:var(--text-muted);font-size:12px">📍 ${l.bairro}${l.cep ? ' · '+l.cep : ''}</div>` : ''}
      </td>
      <td>${l.nicho ? `<span class="badge badge-blue">${l.nicho}</span>` : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td><span class="badge ${statusMap[l.status]||'badge-gray'}">${l.status||'novo'}</span></td>
      <td style="font-size:12px;color:var(--text-muted)">${formatDate(l.created_at)}</td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn btn-outline btn-sm" onclick="editLead('${l.id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="confirmDelete('${l.id}','${l.nome}')">🗑</button>
        </div>
      </td>
    </tr>`).join('');
}

/* ── Filters ──────────────────────────────── */
async function onFilterEstadoChange() {
  const uf = document.getElementById('filterEstado').value;
  const selCidade = document.getElementById('filterCidade');
  selCidade.innerHTML = '<option value="">Todas as cidades</option>';
  selCidade.disabled = true;
  if (uf) {
    selCidade.innerHTML = '<option value="">Carregando...</option>';
    await IBGE.popularSelectMunicipios(selCidade, uf);
    // Re-insere a opção vazia no topo
    const optTodas = document.createElement('option');
    optTodas.value = '';
    optTodas.textContent = 'Todas as cidades';
    selCidade.insertBefore(optTodas, selCidade.firstChild);
    selCidade.value = '';
    selCidade.disabled = false;
  }
  applyFilters();
}

function applyFilters() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const estado = document.getElementById('filterEstado').value;
  const cidade = document.getElementById('filterCidade').value;
  const nicho  = document.getElementById('filterNicho').value;
  const status = document.getElementById('filterStatus').value;

  const filtered = allLeads.filter(l => {
    const matchSearch = !search ||
      l.nome?.toLowerCase().includes(search) ||
      l.email?.toLowerCase().includes(search) ||
      l.bairro?.toLowerCase().includes(search) ||
      l.cidade?.toLowerCase().includes(search);
    const matchEstado = !estado || l.estado === estado;
    const matchCidade = !cidade || l.cidade === cidade;
    const matchNicho  = !nicho  || l.nicho === nicho;
    const matchStatus = !status || l.status === status;
    return matchSearch && matchEstado && matchCidade && matchNicho && matchStatus;
  });
  renderLeads(filtered);
}

/* ── Modal ────────────────────────────────── */
function openModal(data = null) {
  const modal = document.getElementById('leadModal');
  document.getElementById('modalTitle').textContent = data ? 'Editar Lead' : 'Novo Lead';
  document.getElementById('leadId').value = '';

  const cepStatus = document.getElementById('cepStatus');
  if (cepStatus) cepStatus.textContent = '';

  ['fNome','fEmail','fTelefone','fCpf','fBairro','fCep','fNotas','fNichoDesc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('fEstado').value    = '';
  document.getElementById('fCidade').value    = '';
  document.getElementById('fCidade').disabled = true;
  document.getElementById('fStatus').value    = 'novo';
  document.getElementById('fOrigem').value    = '';
  document.getElementById('fNicho').value     = '';

  if (data) {
    document.getElementById('leadId').value     = data.id;
    document.getElementById('fNome').value      = data.nome || '';
    document.getElementById('fEmail').value     = data.email || '';
    document.getElementById('fTelefone').value  = data.telefone || '';
    document.getElementById('fCpf').value       = data.cpf || '';
    document.getElementById('fBairro').value    = data.bairro || '';
    document.getElementById('fCep').value       = data.cep || '';
    document.getElementById('fNotas').value     = data.notas || '';
    document.getElementById('fStatus').value    = data.status || 'novo';
    document.getElementById('fOrigem').value    = data.origem || '';
    document.getElementById('fNicho').value     = data.nicho || '';

    if (data.estado) {
      document.getElementById('fEstado').value = data.estado;
      IBGE.popularSelectMunicipios(document.getElementById('fCidade'), data.estado).then(() => {
        if (data.cidade) document.getElementById('fCidade').value = data.cidade;
      });
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
    estado:   document.getElementById('fEstado').value || null,
    cidade:   document.getElementById('fCidade').value || null,
    bairro:   document.getElementById('fBairro').value.trim() || null,
    cep:      document.getElementById('fCep').value.trim() || null,
    nicho:    document.getElementById('fNicho').value || null,
    notas:    document.getElementById('fNotas').value.trim() || null,
    status:   document.getElementById('fStatus').value,
    origem:   document.getElementById('fOrigem').value || null,
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
    if (master.checked) selectedIds.add(cb.value);
    else selectedIds.delete(cb.value);
  });
  document.getElementById('bulkDeleteBtn').style.display = selectedIds.size ? 'inline-flex' : 'none';
}

async function bulkDelete() {
  const count = selectedIds.size;
  if (!confirm(`Deletar ${count} lead(s)?`)) return;
  for (const id of selectedIds) await deleteLead(id);
  selectedIds.clear();
  toast(`${count} leads deletados`, 'warning');
  await loadLeads();
}

/* ── CEP Auto-fill (ViaCEP) ──────────────── */
function maskCep(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 8);
  if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5);
  input.value = v;
  if (v.replace(/\D/g, '').length === 8) buscarCep();
}

async function buscarCep() {
  const cep = document.getElementById('fCep').value.replace(/\D/g, '');
  const status = document.getElementById('cepStatus');
  if (cep.length !== 8) return;

  status.textContent = '⏳ buscando...';
  status.style.color = 'var(--text-muted)';

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await res.json();

    if (data.erro) {
      status.textContent = '⚠️ CEP não encontrado';
      status.style.color = '#e53e3e';
      return;
    }

    // Preenche bairro se estiver vazio
    const bairroField = document.getElementById('fBairro');
    if (!bairroField.value && data.bairro) bairroField.value = data.bairro;

    // Seleciona estado e carrega cidades
    const estadoSel = document.getElementById('fEstado');
    if (data.uf && estadoSel.value !== data.uf) {
      estadoSel.value = data.uf;
      const cidadeSel = document.getElementById('fCidade');
      await IBGE.popularSelectMunicipios(cidadeSel, data.uf);
      // Seleciona a cidade pelo nome (normalizado)
      const norm = s => s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const target = norm(data.localidade);
      const opt = Array.from(cidadeSel.options).find(o => norm(o.text) === target);
      if (opt) cidadeSel.value = opt.value;
    } else if (data.localidade) {
      // Estado já selecionado — só tenta casar a cidade
      const cidadeSel = document.getElementById('fCidade');
      const norm = s => s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const target = norm(data.localidade);
      const opt = Array.from(cidadeSel.options).find(o => norm(o.text) === target);
      if (opt) cidadeSel.value = opt.value;
    }

    status.textContent = '✅ ' + data.localidade + ', ' + data.uf;
    status.style.color = '#38a169';
  } catch (err) {
    status.textContent = '⚠️ Erro ao buscar CEP';
    status.style.color = '#e53e3e';
  }
}

/* ── Estado/Cidade (IBGE localidades) ─────── */
async function onEstadoChange() {
  const uf = document.getElementById('fEstado').value;
  const selCidade = document.getElementById('fCidade');
  if (!uf) {
    selCidade.innerHTML = '<option value="">Selecione o estado primeiro</option>';
    selCidade.disabled = true;
    return;
  }
  await IBGE.popularSelectMunicipios(selCidade, uf);
}

/* ── Tabs ─────────────────────────────────── */
function switchTab(tab, btn) {
  ['dados','nicho','notas'].forEach(t => {
    document.getElementById(`tab-${t}`).style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('.tab-btn').forEach(b => {
    const t = b.getAttribute('onclick')?.match(/'(\w+)'/)?.[1];
    b.classList.toggle('active', t === tab);
  });
}

/* ── Export CSV ───────────────────────────── */
function exportCSV() {
  const headers = ['Nome','Email','Telefone','CPF','Estado','Cidade','Bairro','CEP','Nicho','Status','Origem','Data'];
  const rows = allLeads.map(l => [
    l.nome, l.email, l.telefone, l.cpf,
    l.estado, l.cidade, l.bairro, l.cep,
    l.nicho, l.status, l.origem, formatDate(l.created_at)
  ].map(v => `"${v||''}"`).join(','));

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `leads_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  toast('CSV exportado!', 'success');
}
