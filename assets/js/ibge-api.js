/* =============================================
   ibge-api.js — Integração com APIs do IBGE
   Endpoints testados e validados (fev/2026)
   ============================================= */

const IBGE = {
  base: 'https://servicodados.ibge.gov.br/api',

  // ── Fallback estático: todos os 27 estados ─────────
  // Usado quando a API do IBGE não responde
  _estados_fallback: [
    {sigla:'AC',nome:'Acre',id:12},{sigla:'AL',nome:'Alagoas',id:27},
    {sigla:'AM',nome:'Amazonas',id:13},{sigla:'AP',nome:'Amapá',id:16},
    {sigla:'BA',nome:'Bahia',id:29},{sigla:'CE',nome:'Ceará',id:23},
    {sigla:'DF',nome:'Distrito Federal',id:53},{sigla:'ES',nome:'Espírito Santo',id:32},
    {sigla:'GO',nome:'Goiás',id:52},{sigla:'MA',nome:'Maranhão',id:21},
    {sigla:'MG',nome:'Minas Gerais',id:31},{sigla:'MS',nome:'Mato Grosso do Sul',id:50},
    {sigla:'MT',nome:'Mato Grosso',id:51},{sigla:'PA',nome:'Pará',id:15},
    {sigla:'PB',nome:'Paraíba',id:25},{sigla:'PE',nome:'Pernambuco',id:26},
    {sigla:'PI',nome:'Piauí',id:22},{sigla:'PR',nome:'Paraná',id:41},
    {sigla:'RJ',nome:'Rio de Janeiro',id:33},{sigla:'RN',nome:'Rio Grande do Norte',id:24},
    {sigla:'RO',nome:'Rondônia',id:11},{sigla:'RR',nome:'Roraima',id:14},
    {sigla:'RS',nome:'Rio Grande do Sul',id:43},{sigla:'SC',nome:'Santa Catarina',id:42},
    {sigla:'SE',nome:'Sergipe',id:28},{sigla:'SP',nome:'São Paulo',id:35},
    {sigla:'TO',nome:'Tocantins',id:17},
  ].sort((a,b) => a.nome.localeCompare(b.nome)),

  // ── IDHM de referência por UF (Atlas 2010/PNUD) ──
  // Usado como fallback pois o IBGE não tem API live para IDHM
  _idhm_uf: {
    AC:0.663, AL:0.631, AM:0.674, AP:0.708, BA:0.660,
    CE:0.682, DF:0.824, ES:0.740, GO:0.735, MA:0.639,
    MG:0.731, MS:0.729, MT:0.725, PA:0.646, PB:0.658,
    PE:0.673, PI:0.646, PR:0.749, RJ:0.761, RN:0.684,
    RO:0.690, RR:0.707, RS:0.746, SC:0.774, SE:0.665,
    SP:0.783, TO:0.699,
  },

  /* ── Localidades ─────────────────────────── */
  async getEstados() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const r = await fetch(`${this.base}/v1/localidades/estados?orderBy=nome`, { signal: controller.signal });
      clearTimeout(timeout);
      if (r.ok) return r.json();
      console.warn('[IBGE] getEstados: resposta não-ok, usando fallback.');
      return this._estados_fallback;
    } catch(e) {
      console.warn('[IBGE] getEstados: erro de rede, usando fallback.', e.message);
      return this._estados_fallback;
    }
  },

  async getMunicipios(uf) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const r = await fetch(`${this.base}/v1/localidades/estados/${uf}/municipios?orderBy=nome`, { signal: controller.signal });
      clearTimeout(timeout);
      if (r.ok) return r.json();
      console.warn('[IBGE] getMunicipios: resposta não-ok para UF', uf);
      return [];
    } catch(e) {
      console.warn('[IBGE] getMunicipios: erro de rede para UF', uf, e.message);
      return [];
    }
  },

  /* ── SIDRA helper genérico ────────────────── */
  // Estrutura real: data[0].resultados[0].series[0].serie[periodo]
  async _getSIDRA(agregado, variavel, periodo, codMunicipio) {
    try {
      const url = `${this.base}/v3/agregados/${agregado}/periodos/${periodo}/variaveis/${variavel}?localidades=N6[${codMunicipio}]`;
      const r = await fetch(url);
      if (!r.ok) return null;
      const data = await r.json();
      const val = data?.[0]?.resultados?.[0]?.series?.[0]?.serie?.[String(periodo)];
      return (val && val !== '-') ? parseFloat(val) : null;
    } catch(e) { return null; }
  },

  /* ── PIB Total Municipal (Var 37, Mil Reais) ─
     Agregado 5938 — último dado disponível: 2021 */
  async getPIBTotal(codMunicipio) {
    // Tenta 2021, 2020, 2019 em sequência
    for (const ano of [2021, 2020, 2019]) {
      const val = await this._getSIDRA(5938, 37, ano, codMunicipio);
      if (val !== null) return { valor: val, ano };
    }
    return null;
  },

  /* ── População (Censo 2022) ───────────────────
     Agregado 9514, Variável 93 — Censo 2022 */
  async getPopulacao(codMunicipio) {
    const val = await this._getSIDRA(9514, 93, 2022, codMunicipio);
    if (val !== null) return val;
    // Fallback: estimativa 6579 de 2021
    return this._getSIDRA(6579, 9324, 2021, codMunicipio);
  },

  /* ── IDHM por UF (referência estática PNUD) ── */
  getIDHM_UF(siglaUF) {
    return this._idhm_uf[siglaUF?.toUpperCase()] ?? 0.68;
  },

  /* ── Score Composto ──────────────────────────
     Calcula score 0-100 baseado em:
     - PIB per capita calculado (PIB/Pop)
     - Tamanho da população
     - IDHM da UF (referência) */
  async calcularScoreLead(codMunicipio, siglaUF) {
    const [pibResult, popVal] = await Promise.all([
      this.getPIBTotal(codMunicipio),
      this.getPopulacao(codMunicipio),
    ]);

    const pop     = popVal ?? 50000;
    const pibMilR = pibResult?.valor ?? null;

    // PIB per capita em R$ = (PIB em mil R$ × 1000) / população
    const pibPerCapita = (pibMilR && pop > 0)
      ? Math.round((pibMilR * 1000) / pop)
      : null;

    const idh = this.getIDHM_UF(siglaUF);

    // Normaliza 0-100
    const scorePIB = pibPerCapita
      ? Math.min(100, (pibPerCapita / 80000) * 100)
      : 40; // fallback neutro

    const scorePop = Math.min(100,
      (Math.log10(Math.max(pop, 1)) / Math.log10(5_000_000)) * 100
    );

    const scoreIDH = Math.min(100, idh * 100);

    const w = { pib_per_capita: 0.35, populacao: 0.25, idh: 0.40 };
    const total = Math.round(
      scorePIB * (w.pib_per_capita) +
      scorePop *  w.populacao +
      scoreIDH *  w.idh
    );

    return {
      score: Math.min(100, Math.max(0, total)),
      detalhes: {
        pib_per_capita: pibPerCapita,
        pib_total_mil:  pibMilR,
        populacao:      pop,
        idh:            idh,
        score_pib:      Math.round(scorePIB),
        score_pop:      Math.round(scorePop),
        score_idh:      Math.round(scoreIDH),
        fonte_pib:      pibResult ? `IBGE SIDRA ${pibResult.ano}` : 'estimado',
        fonte_pop:      popVal    ? 'IBGE Censo 2022'             : 'estimado',
        fonte_idh:      `PNUD Atlas — UF ${siglaUF ?? '?'}`,
      }
    };
  },

  /* ── Dados Regionais por UF ───────────────── */
  async getDadosRegionais(uf) {
    const municipios = await this.getMunicipios(uf);
    return {
      total_municipios: municipios.length,
      municipios: municipios.slice(0, 20),
    };
  },

  /* ── Preenche selects ── */
  async popularSelectEstados(selectEl) {
    selectEl.innerHTML = '<option value="">⏳ Carregando estados...</option>';
    selectEl.disabled = true;
    const estados = await this.getEstados();
    selectEl.innerHTML = '<option value="">Selecione o estado</option>';
    if (!estados.length) {
      selectEl.innerHTML = '<option value="">⚠️ Erro ao carregar estados</option>';
      selectEl.disabled = false;
      return;
    }
    estados.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.sigla;
      opt.textContent = `${e.nome} (${e.sigla})`;
      opt.dataset.id = e.id;
      selectEl.appendChild(opt);
    });
    selectEl.disabled = false;
  },

  async popularSelectMunicipios(selectEl, uf) {
    selectEl.innerHTML = '<option value="">Carregando...</option>';
    selectEl.disabled = true;
    const municipios = await this.getMunicipios(uf);
    selectEl.innerHTML = '<option value="">Selecione a cidade</option>';
    municipios.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.nome;
      opt.textContent = m.nome;
      opt.dataset.id = m.id;
      selectEl.appendChild(opt);
    });
    selectEl.disabled = false;
  },
};
