/**
 * seed_ibge.js — Popula Supabase com dados REAIS do IBGE
 * -------------------------------------------------------
 * Busca PIB municipal (SIDRA 2021) e População (Censo 2022)
 * para 50 principais municípios brasileiros.
 *
 * Uso: node supabase/seed_ibge.js
 * Requer: Node.js >= 18 (fetch nativo)
 */

// ── Credenciais (lidas de config.js ou defina aqui) ──────────
const SUPABASE_URL = 'https://bhargdkruycbrcanfvuz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoYXJnZGtydXljYnJjYW5mdnV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NzQ1NzgsImV4cCI6MjA4NzQ1MDU3OH0.jBRK_IhUNzxMzf_4UNjpabgwEB7MpqrTL29qTvZK_os';
const IBGE_BASE    = 'https://servicodados.ibge.gov.br/api';

// ── IDHM por UF (PNUD Atlas — mesma tabela do ibge-api.js) ───
const IDHM_UF = {
  AC:0.663, AL:0.631, AM:0.674, AP:0.708, BA:0.660,
  CE:0.682, DF:0.824, ES:0.740, GO:0.735, MA:0.639,
  MG:0.731, MS:0.729, MT:0.725, PA:0.646, PB:0.658,
  PE:0.673, PI:0.646, PR:0.749, RJ:0.761, RN:0.684,
  RO:0.690, RR:0.707, RS:0.746, SC:0.774, SE:0.665,
  SP:0.783, TO:0.699,
};

// ── Pesos (mesmos de APP_CONFIG) ──────────────────────────────
const W = { pib_per_capita: 0.35, populacao: 0.15, idh: 0.30, grau_instrucao: 0.20 };

// ── 50 municípios brasileiros com código IBGE real ───────────
const MUNICIPIOS = [
  // Capitais
  { id:'3550308', nome:'São Paulo',        uf:'SP' },
  { id:'3304557', nome:'Rio de Janeiro',   uf:'RJ' },
  { id:'5300108', nome:'Brasília',         uf:'DF' },
  { id:'3106200', nome:'Belo Horizonte',   uf:'MG' },
  { id:'4106902', nome:'Curitiba',         uf:'PR' },
  { id:'1302603', nome:'Manaus',           uf:'AM' },
  { id:'2304400', nome:'Fortaleza',        uf:'CE' },
  { id:'4314902', nome:'Porto Alegre',     uf:'RS' },
  { id:'2927408', nome:'Salvador',         uf:'BA' },
  { id:'2611606', nome:'Recife',           uf:'PE' },
  { id:'1501402', nome:'Belém',            uf:'PA' },
  { id:'5208707', nome:'Goiânia',          uf:'GO' },
  { id:'2111300', nome:'São Luís',         uf:'MA' },
  { id:'2704302', nome:'Maceió',           uf:'AL' },
  { id:'2408102', nome:'Natal',            uf:'RN' },
  { id:'2211001', nome:'Teresina',         uf:'PI' },
  { id:'5002704', nome:'Campo Grande',     uf:'MS' },
  { id:'5103403', nome:'Cuiabá',           uf:'MT' },
  { id:'4205407', nome:'Florianópolis',    uf:'SC' },
  { id:'1100205', nome:'Porto Velho',      uf:'RO' },
  { id:'1600303', nome:'Macapá',           uf:'AP' },
  { id:'1200401', nome:'Rio Branco',       uf:'AC' },
  { id:'1721000', nome:'Palmas',           uf:'TO' },
  { id:'1400100', nome:'Boa Vista',        uf:'RR' },
  { id:'2800308', nome:'Aracaju',          uf:'SE' },
  { id:'2507507', nome:'João Pessoa',      uf:'PB' },
  { id:'3205309', nome:'Vitória',          uf:'ES' },
  // Grandes polos econômicos
  { id:'3509502', nome:'Campinas',         uf:'SP' },
  { id:'3548500', nome:'Santos',           uf:'SP' },
  { id:'3543402', nome:'Ribeirão Preto',   uf:'SP' },
  { id:'3549904', nome:'São José dos Campos', uf:'SP' },
  { id:'3552205', nome:'Sorocaba',         uf:'SP' },
  { id:'3534401', nome:'Osasco',           uf:'SP' },
  { id:'3518800', nome:'Guarulhos',        uf:'SP' },
  { id:'3170206', nome:'Uberlândia',       uf:'MG' },
  { id:'3118601', nome:'Contagem',         uf:'MG' },
  { id:'3136702', nome:'Juiz de Fora',     uf:'MG' },
  { id:'4113700', nome:'Londrina',         uf:'PR' },
  { id:'4115200', nome:'Maringá',          uf:'PR' },
  { id:'4209102', nome:'Joinville',        uf:'SC' },
  { id:'4202404', nome:'Blumenau',         uf:'SC' },
  { id:'4305108', nome:'Caxias do Sul',    uf:'RS' },
  { id:'3303302', nome:'Niterói',          uf:'RJ' },
  { id:'3301702', nome:'Duque de Caxias',  uf:'RJ' },
  { id:'2910800', nome:'Feira de Santana', uf:'BA' },
  { id:'2607901', nome:'Jaboatão',         uf:'PE' },
  { id:'2304400', nome:'Fortaleza',        uf:'CE' },
  { id:'1302603', nome:'Manaus',           uf:'AM' },
  { id:'3106705', nome:'Betim',            uf:'MG' },
  { id:'3518305', nome:'Guarujá',          uf:'SP' },
];

// Remove duplicatas por id
const municipiosList = [...new Map(MUNICIPIOS.map(m => [m.id, m])).values()];

// ── Nomes brasileiros para os leads (dados sintéticos + geo real) ─
const PRIMEIROS = ['Ana','Carlos','Fernanda','Rafael','Juliana','Marcos','Patrícia','Eduardo','Beatriz','Thiago','Camila','Leonardo','Isabela','Roberto','Amanda','Rodrigo','Larissa','Felipe','Mariana','Bruno','Letícia','Diego','Vanessa','Gustavo','Renata','André','Priscila','Lucas','Débora','Fábio','Carolina','Henrique','Aline','Vinicius','Cláudia','Mateus','Adriana','Leandro','Monique','Sérgio'];
const SOBRENOMES = ['Silva','Souza','Santos','Oliveira','Pereira','Costa','Ferreira','Rodrigues','Almeida','Nascimento','Lima','Araújo','Vieira','Alves','Moreira','Barbosa','Ribeiro','Carvalho','Monteiro','Rocha','Cunha','Pinto','Simões','Cardoso','Teixeira','Moura','Castro','Ramos','Correia','Mendes'];

function nomeFake(i) {
  return `${PRIMEIROS[i % PRIMEIROS.length]} ${SOBRENOMES[i % SOBRENOMES.length]}`;
}
function emailFake(nome, cidade) {
  const n = nome.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,'.');
  const c = cidade.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,'');
  return `${n}@${c}.com.br`;
}
function telefoneFake(uf) {
  const ddds = { SP:'11',RJ:'21',MG:'31',RS:'51',PR:'41',SC:'48',BA:'71',CE:'85',PE:'81',GO:'62',DF:'61',AM:'92',PA:'91',MA:'98',MT:'65',MS:'67',ES:'27',PB:'83',RN:'84',AL:'82',SE:'79',PI:'86',RO:'69',TO:'63',AP:'96',AC:'68',RR:'95' };
  const d = ddds[uf] || '11';
  const n = String(Math.floor(Math.random()*90000+10000));
  return `(${d}) 9${n.slice(0,4)}-${n.slice(4)}`;
}

// ── Score (mesma fórmula de ibge-api.js) ─────────────────────
function calcScore(pibPerCapita, populacao, siglaUF) {
  const idh = IDHM_UF[siglaUF] ?? 0.68;
  const scorePIB = pibPerCapita
    ? Math.min(100, (pibPerCapita / 80000) * 100)
    : 40;
  const scorePop = Math.min(100,
    (Math.log10(Math.max(populacao, 1)) / Math.log10(5_000_000)) * 100
  );
  const scoreIDH = Math.min(100, idh * 100);
  const total = Math.round(
    scorePIB * (W.pib_per_capita + W.grau_instrucao) +
    scorePop *  W.populacao +
    scoreIDH *  W.idh
  );
  return { score: Math.min(100, Math.max(0, total)), scorePIB, scorePop, scoreIDH, idh };
}

function getSegmento(score) {
  if (score >= 80) return 'Premium';
  if (score >= 60) return 'Alto Valor';
  if (score >= 40) return 'Médio';
  return 'Básico';
}

function getStatus(score) {
  if (score >= 80) return 'qualificado';
  if (score >= 60) return 'contato';
  if (score >= 40) return 'novo';
  return 'descartado';
}

const ORIGENS = ['site','indicacao','ads','evento','cold'];

// ── SIDRA batch helper ────────────────────────────────────────
async function fetchSIDRABatch(agregado, variavel, periodo, ids) {
  const loc = `N6[${ids.join(',')}]`;
  const url  = `${IBGE_BASE}/v3/agregados/${agregado}/periodos/${periodo}/variaveis/${variavel}?localidades=${loc}`;
  try {
    const r = await fetch(url);
    if (!r.ok) { console.warn(`  SIDRA ${agregado}/${variavel} HTTP ${r.status}`); return {}; }
    const data = await r.json();
    // data[0].resultados → array de series, cada series[i] tem localidade.id e serie[periodo]
    const map = {};
    const resultados = data?.[0]?.resultados ?? [];
    for (const res of resultados) {
      for (const s of (res.series ?? [])) {
        const idMun = s.localidade?.id;
        const val   = s.serie?.[String(periodo)];
        if (idMun && val && val !== '-') map[idMun] = parseFloat(val);
      }
    }
    return map;
  } catch(e) {
    console.warn(`  SIDRA fetch error: ${e.message}`);
    return {};
  }
}

// ── Supabase REST ─────────────────────────────────────────────
async function upsertLeads(rows) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/leads_ibge`, {
    method: 'POST',
    headers: {
      'apikey':       SUPABASE_KEY,
      'Authorization':`Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer':       'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Supabase POST ${r.status}: ${txt}`);
  }
  return r.status;
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('\n🌎  LeadIBGE — Seed com dados REAIS do IBGE');
  console.log('================================================');
  console.log(`  Municípios: ${municipiosList.length}`);
  console.log(`  Supabase:   ${SUPABASE_URL}\n`);

  const BATCH = 20;
  const pibMap = {};
  const popMap = {};

  // Busca PIB em batches
  console.log('📦 Buscando PIB municipal (SIDRA 5938/var37/2021)...');
  for (let i = 0; i < municipiosList.length; i += BATCH) {
    const slice = municipiosList.slice(i, i + BATCH);
    const ids   = slice.map(m => m.id);
    const batch = await fetchSIDRABatch(5938, 37, 2021, ids);
    Object.assign(pibMap, batch);
    process.stdout.write(`  batch ${Math.ceil((i+1)/BATCH)}/${Math.ceil(municipiosList.length/BATCH)} — ${Object.keys(batch).length} valores\n`);
    await new Promise(r => setTimeout(r, 300)); // respeita rate limit
  }

  // Busca População em batches
  console.log('\n👥 Buscando população (SIDRA 9514/var93/2022 — Censo)...');
  for (let i = 0; i < municipiosList.length; i += BATCH) {
    const slice = municipiosList.slice(i, i + BATCH);
    const ids   = slice.map(m => m.id);
    const batch = await fetchSIDRABatch(9514, 93, 2022, ids);
    Object.assign(popMap, batch);
    process.stdout.write(`  batch ${Math.ceil((i+1)/BATCH)}/${Math.ceil(municipiosList.length/BATCH)} — ${Object.keys(batch).length} valores\n`);
    await new Promise(r => setTimeout(r, 300));
  }

  // Gera leads com dados reais
  console.log('\n⚙️  Calculando scores e gerando leads...\n');
  const leads = [];
  const now = new Date();

  for (let idx = 0; idx < municipiosList.length; idx++) {
    const m   = municipiosList[idx];
    const pib = pibMap[m.id] ?? null;   // Mil R$
    const pop = popMap[m.id] ?? null;
    const idh = IDHM_UF[m.uf] ?? 0.68;

    const pibPerCapita = (pib && pop) ? Math.round((pib * 1000) / pop) : null;
    const { score, scorePIB, scorePop, scoreIDH } = calcScore(pibPerCapita, pop ?? 100000, m.uf);
    const segmento = getSegmento(score);
    const status   = getStatus(score);
    const nome     = nomeFake(idx);
    const email    = emailFake(nome, m.nome);

    // Espalha created_at nos últimos 60 dias
    const diasAtras = Math.floor(Math.random() * 60);
    const created = new Date(now);
    created.setDate(created.getDate() - diasAtras);

    const lead = {
      nome,
      email,
      telefone:     telefoneFake(m.uf),
      estado:       m.uf,
      cidade:       m.nome,
      municipio_id: m.id,
      score_ibge:   score,
      segmento,
      status,
      origem:       ORIGENS[idx % ORIGENS.length],
      created_at:   created.toISOString(),
      ibge_detalhes: JSON.stringify({
        pib_per_capita: pibPerCapita,
        pib_total_mil:  pib,
        populacao:      pop,
        idh,
        score_pib:  Math.round(scorePIB),
        score_pop:  Math.round(scorePop),
        score_idh:  Math.round(scoreIDH),
        fonte_pib:  pib ? 'IBGE SIDRA 2021' : 'indisponível',
        fonte_pop:  pop ? 'IBGE Censo 2022' : 'indisponível',
        fonte_idh:  `PNUD Atlas — UF ${m.uf}`,
      }),
    };

    leads.push(lead);
    console.log(`  [${String(idx+1).padStart(2)}] ${m.nome.padEnd(22)} ${m.uf}  score:${String(score).padStart(3)}  ${segmento.padEnd(10)}  PIB p.c.: ${pibPerCapita ? 'R$'+pibPerCapita.toLocaleString('pt-BR') : 'N/D'}`);
  }

  // Insere no Supabase em lotes de 20
  console.log(`\n⬆️  Inserindo ${leads.length} leads no Supabase...`);
  let total = 0;
  for (let i = 0; i < leads.length; i += BATCH) {
    const slice = leads.slice(i, i + BATCH);
    try {
      const status = await upsertLeads(slice);
      total += slice.length;
      console.log(`  ✅ Lote ${Math.ceil((i+1)/BATCH)}: ${slice.length} leads (HTTP ${status})`);
    } catch(e) {
      console.error(`  ❌ Lote ${Math.ceil((i+1)/BATCH)} falhou: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n✅ Concluído! ${total} leads inseridos com dados reais do IBGE.`);
  console.log('   Dashboard: http://localhost:3000\n');
}

main().catch(e => { console.error('\n❌ Erro fatal:', e.message); process.exit(1); });
