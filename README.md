# LeadIBGE — Plataforma de Leads Estruturados com Análise IBGE

> Plataforma **100% gratuita** de gestão de leads com score e segmentação automática baseada nos dados do Censo IBGE. Rodando em GitHub Pages + Supabase.

![LeadIBGE Screenshot](assets/img/screenshot.png)

---

## 🚀 Deploy Gratuito (GitHub Pages + Supabase)

### 1. Fork e GitHub Pages

```bash
# 1. Fork este repositório no GitHub
# 2. Vá em: Settings → Pages → Source: Deploy from branch → main → / (root)
# 3. Em alguns minutos seu site estará em: https://SEU_USUARIO.github.io/lead-platform
```

### 2. Criar banco de dados no Supabase (gratuito)

1. Crie conta em [supabase.com](https://supabase.com) (gratuito)
2. Crie um novo projeto
3. Vá em **SQL Editor** e execute o conteúdo do arquivo [`supabase/schema.sql`](supabase/schema.sql)
4. Vá em **Settings → API** e copie:
   - `Project URL`
   - `anon public` key

### 3. Configurar a plataforma

Abra seu site → **Configurações** → preencha URL e Key do Supabase → Salvar.

Ou edite diretamente o arquivo `assets/js/config.js`:

```js
supabaseUrl: 'https://SEU_PROJETO.supabase.co',
supabaseKey: 'SUA_ANON_KEY',
```

---

## ✨ Funcionalidades

| Feature | Descrição |
|---|---|
| 📊 **Dashboard** | KPIs em tempo real: total de leads, qualificados, score médio, estados cobertos |
| 👥 **Gestão de Leads** | CRUD completo, filtros avançados, exportação CSV |
| 🗺️ **Análise IBGE** | Score automático por município usando PIB per capita, IDH e população |
| 🎯 **Segmentação** | Premium / Alto Valor / Médio / Básico baseado no score regional |
| 📈 **Gráficos** | Evolução temporal, distribuição por segmento, leads por estado |
| 📴 **Modo Offline** | Funciona sem Supabase usando localStorage como fallback |

---

## 🏗️ Arquitetura

```
lead-platform/
├── index.html              # Dashboard
├── pages/
│   ├── leads.html          # Gestão de leads
│   ├── analysis.html       # Análise demográfica IBGE
│   ├── segments.html       # Segmentação de leads
│   └── settings.html       # Configuração Supabase
├── assets/
│   ├── css/style.css       # Estilos globais
│   └── js/
│       ├── config.js       # ← Configure aqui suas credenciais
│       ├── supabase-client.js  # CRUD + helpers
│       ├── ibge-api.js     # Integração API IBGE
│       ├── dashboard.js    # Lógica do dashboard
│       ├── leads.js        # Lógica de leads
│       └── analysis.js     # Lógica de análise IBGE
└── supabase/
    └── schema.sql          # Schema do banco de dados
```

---

## 📡 APIs IBGE Utilizadas

| API | Endpoint | Dado |
|---|---|---|
| Localidades | `/v1/localidades/estados` | Lista de estados |
| Localidades | `/v1/localidades/estados/{uf}/municipios` | Municípios por UF |
| SIDRA | `/v3/agregados/5938` | PIB per capita municipal |
| SIDRA | `/v3/agregados/6579` | População estimada |
| Pesquisas | `/v1/pesquisas/indicadores/47001` | IDHM |

Todas as APIs são **públicas e gratuitas**.

---

## 🎯 Fórmula do Score IBGE

```
Score = (PIB per capita / 80.000) × 35%
      + log(População) / log(5.000.000) × 15%
      + IDHM × 30%
      + Proxy instrução × 20%
```

| Score | Segmento | Descrição |
|---|---|---|
| 80–100 | 💎 Premium | Região de alto desenvolvimento |
| 60–79 | ⭐ Alto Valor | Região desenvolvida |
| 40–59 | 📈 Médio | Região em desenvolvimento |
| 0–39 | 🌱 Básico | Região em estágio inicial |

---

## 🛠️ Stack Tecnológica

- **Frontend:** HTML5 + CSS3 + JavaScript Vanilla (sem frameworks)
- **UI:** Design próprio responsivo, sem dependências pesadas
- **Charts:** [Chart.js 4](https://chartjs.org)
- **Database:** [Supabase](https://supabase.com) (PostgreSQL gerenciado)
- **IBGE:** [API Pública IBGE](https://servicodados.ibge.gov.br)
- **Hospedagem:** [GitHub Pages](https://pages.github.com) (gratuito)

---

## 📋 Pré-requisitos

- Conta no GitHub (gratuita)
- Conta no Supabase (gratuita, até 500MB / 2 projetos)
- Nenhuma instalação local necessária!

---

## 🤝 Contribuindo

Pull requests são bem-vindos! Abra uma issue primeiro para discussão.

---

## 📄 Licença

MIT — use livremente.
