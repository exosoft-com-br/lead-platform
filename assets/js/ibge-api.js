/* =============================================
   ibge-api.js — Integração com APIs do IBGE
   ============================================= */

const IBGE = {
  base: 'https://servicodados.ibge.gov.br/api',

  /* ── Localidades ─────────────────────────── */
  async getEstados() {
    const r = await fetch(`${this.base}/v1/localidades/estados?orderBy=nome`);
    return r.ok ? r.json() : [];
  },

  async getMunicipios(uf) {
    const r = await fetch(`${this.base}/v1/localidades/estados/${uf}/municipios?orderBy=nome`);
    return r.ok ? r.json() : [];
  },

  async getMunicipioByNome(nome, uf) {
    const list = await this.getMunicipios(uf);
    return list.find(m => m.nome.toLowerCase() === nome.toLowerCase()) || null;
  },

  /* ── Indicadores Municipais (SIDRA) ──────── */
  // PIB per capita municipal — Tabela 5938
  async getPIBPerCapita(codMunicipio) {
    return this._getSIDRA(5938, codMunicipio, ['V'][0]);
  },

  // Renda média domiciliar — proxy via PNAD
  async getRendaMedia(codMunicipio) {
    // Utiliza agregado 7169 (Rendimento médio mensal per capita)
    return this._getSIDRA(7169, codMunicipio);
  },

  // Population — Tabela 6579 (Projeções de população)
  async getPopulacao(codMunicipio) {
    return this._getSIDRA(6579, codMunicipio);
  },

  async _getSIDRA(tabela, codMunicipio) {
    try {
      const url = `${this.base}/v3/agregados/${tabela}/periodos/2022/variaveis?localidades=N6[${codMunicipio}]`;
      const r = await fetch(url);
      if (!r.ok) return null;
      const data = await r.json();
      const val = data?.[0]?.resultados?.[0]?.series?.[0]?.serie?.['2022'];
      return val ? parseFloat(val) : null;
    } catch(e) {
      return null;
    }
  },

  /* ── IDH e dados IDHM ────────────────────── */
  async getIDHM(codMunicipio) {
    // Atlas do Desenvolvimento Humano — via IBGE cidades
    try {
      const url = `${this.base}/v1/pesquisas/indicadores/47001/resultados/${codMunicipio}`;
      const r = await fetch(url);
      if (!r.ok) return null;
      const data = await r.json();
      return data?.[0]?.res?.[0]?.res ?? null;
    } catch(e) {
      return null;
    }
  },

  /* ── Score Composto ──────────────────────── */
  async calcularScoreLead(codMunicipio) {
    const [pib, pop, idh] = await Promise.allSettled([
      this.getPIBPerCapita(codMunicipio),
      this.getPopulacao(codMunicipio),
      this.getIDHM(codMunicipio),
    ]);

    const pibVal = pib.value ?? 30000;
    const popVal = pop.value ?? 50000;
    const idhVal = idh.value ?? 0.65;

    // Normaliza cada indicador para 0-100
    const scorePIB  = Math.min(100, (pibVal / 80000) * 100);
    const scorePop  = Math.min(100, Math.log10(popVal > 0 ? popVal : 1) / Math.log10(5000000) * 100);
    const scoreIDH  = idhVal ? Math.min(100, idhVal * 100) : 65;

    const w = APP_CONFIG.scoreWeights;
    const total = Math.round(
      scorePIB  * (w.pib_per_capita + w.grau_instrucao) +
      scorePop  * w.populacao +
      scoreIDH  * w.idh
    );

    return {
      score: Math.min(100, Math.max(0, total)),
      detalhes: {
        pib_per_capita: pibVal,
        populacao:      popVal,
        idh:            idhVal,
        score_pib:      Math.round(scorePIB),
        score_pop:      Math.round(scorePop),
        score_idh:      Math.round(scoreIDH),
      }
    };
  },

  /* ── Dados Agregados para Análise Regional ─ */
  async getDadosRegionais(uf) {
    const municipios = await this.getMunicipios(uf);
    return {
      total_municipios: municipios.length,
      municipios: municipios.slice(0, 20), // top 20 para exibição
    };
  },

  /* ── Preenche selects de UF/Município ─────── */
  async popularSelectEstados(selectEl) {
    const estados = await this.getEstados();
    selectEl.innerHTML = '<option value="">Selecione o estado</option>';
    estados.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.sigla;
      opt.textContent = `${e.nome} (${e.sigla})`;
      opt.dataset.id = e.id;
      selectEl.appendChild(opt);
    });
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
