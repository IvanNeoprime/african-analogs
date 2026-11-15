# African Analogs — Plataforma Colaborativa de Análogos Planetários

Aplicação web full-stack para pesquisa, comparação geológica e colaboração científica sobre **lugares na Terra (com foco especial na África e referências globais)** que se parecem com outros **planetas, planetas anões e satélites naturais** do Sistema Solar.

A filosofia central da plataforma é **controle manual pelo pesquisador**: todas as medições de campo, minerais, composição química, gráficos e textos de artigos são inseridos e editados manualmente pelo usuário, enquanto a Inteligência Artificial atua exclusivamente como **copiloto analítico**.

---

## 1. Evolução da Plataforma (Da Base ao Estágio Atual)

A aplicação evoluiu de forma incremental em cinco marcos principais:

1. **Base Geoespacial & Motor Espectral (`Phase 1`)**
   - Estruturação do catálogo inicial de sítios análogos africanos e globais (`src/data/planetaryData.ts`), mapa interativo com Leaflet, motor de cálculo do Índice de Fidelidade Análoga e curvas de reflectância espectral de 400 nm a 2500 nm (`src/services/spectralEngine.ts`).

2. **Organização Visual, Tipografia & Gráficos Legendados (`Phase 2`)**
   - Reestruturação em layout Bento responsivo com espaçamentos equilibrados para qualquer tela, tipografia **Poppins** (títulos), **Roboto** (leitura fluida) e **JetBrains Mono** (números e coordenadas), alternância de tema Claro/Escuro e linguagem simplificada para usuários leigos e estudantes.
   - Criação do painel analítico (`AnalogueDashboard.tsx`) com gráficos fáceis de interpretar e devidamente legendados: **Pizza**, **Estrela (Radar)**, **Arco (Medidor)** e **Linhas Espectrais**.

3. **Persistência Local, Fluxo de Contas & Controle Manual (`Phase 3`)**
   - Implementação de persistência local dupla (`localStorage` no navegador + arquivo `.local-data/african-analogs-db.json` no servidor Express via `/api/local/state`).
   - Fluxo de cadastro e login em linha única estilo redes profissionais (com avatar automático por iniciais ou upload de foto, perfil simplificado e publicação manual de artigos).
   - Separação estrita entre **entrada manual de dados** e **apoio da IA**, permitindo editar manualmente dados da dashboard, conclusão e publicações com base nas análises do copiloto.

4. **Estabilidade de Runtime, Imagens GeoTIFF/Criptografadas & Atalhos NASA (`Phase 4`)**
   - Correção do erro de WebSocket HMR no Vite em modo proxy/middleware (`disable-hmr-client-ws` em `server.ts`).
   - Processamento local de imagens científicas, **TIFF/GeoTIFF** (incluindo extração automática de coordenadas geográficas) e arquivos protegidos por senha/AES/OpenSSL (`cryptoImageProcessor.ts`).
   - Adição de **Atalhos para Fontes Oficiais da NASA** (`NasaDataShortcutsModal.tsx`), camada ao vivo de eventos **NASA EONET** no mapa e download de modelo CSV pronto para importação.

5. **Copiloto NVIDIA Nemotron 3.5 & Catálogo Completo do Sistema Solar (`Phase 5 — Estágio Atual`)**
   - Integração no backend com o modelo **`nvidia/nemotron-3.5-lightning-30b-a3b`** via NVIDIA NIM (`openai` SDK) com streaming e `enable_thinking: true`, exibindo o raciocínio da IA de forma opcional e recolhível (`Ver raciocínio da IA`).
   - Análise visual de fotos via **telemetria de pixels extraída em `<canvas>`** (RGB médio, albedo estimado, índice de óxido de ferro, rugosidade/contraste) somada aos metadados raster e observações manuais do usuário.
   - Expansão completa do catálogo de astros (`src/data/celestialBodies.ts`) para suportar **todos os planetas, planetas anões e principais satélites naturais do Sistema Solar**, além de comparador dinâmico de referência, editor inline de óxidos XRF e exportação CSV na dashboard.

---

## 2. Stack Tecnológica

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS 4 (`@tailwindcss/vite`), Lucide Icons
- **Mapas & Dados Raster**: Leaflet (`1.9.4`), `geotiff` (`3.0.5`), HTML5 `<canvas>` e Web Crypto API
- **Backend & Proxy API**: Node.js + Express (`server.ts`, compilado com `esbuild` para `server.js`, executado em dev com `tsx`)
- **Inteligência Artificial (Copiloto)**: `openai` SDK conectado ao endpoint NVIDIA NIM (`https://integrate.api.nvidia.com/v1`, modelo `nvidia/nemotron-3.5-lightning-30b-a3b`)
- **Tipografia**: Google Fonts (`Poppins`, `Roboto`, `JetBrains Mono`)

---

## 3. Estrutura do Projeto

```text
├── index.html                           # Metadados, fontes (Roboto/Poppins/JetBrains Mono), Leaflet CSS e tema inicial
├── metadata.json                        # Identidade e capacidades do applet
├── package.json                         # Scripts (dev, build, start, lint) e dependências
├── server.ts                            # Servidor Express + Vite middleware + rotas IA Nemotron, NASA/SRTM e persistência local
├── .env.example                         # Variáveis de ambiente de referência
└── src/
    ├── App.tsx                          # Estado global, hidratação local e navegação entre as 3 abas principais
    ├── index.css                        # Estilos globais e configuração Tailwind CSS
    ├── types/
    │   └── index.ts                     # Tipos TypeScript (PlanetaryTarget completo, GeologicalSample, AnalogueSite, etc.)
    ├── data/
    │   ├── celestialBodies.ts           # Catálogo oficial de todos os planetas, planetas anões e satélites naturais
    │   └── planetaryData.ts             # Sítios análogos de referência, amostras iniciais, perfis e grupos
    ├── services/
    │   ├── officialApis.ts              # Endpoints oficiais (GIBS, SRTM, EONET), atalhos NASA e gerador de modelo CSV
    │   ├── spectralEngine.ts            # Cálculo do Índice de Fidelidade Análoga (AFI), curvas espectrais e parser CSV/JSON
    │   ├── cryptoImageProcessor.ts      # Leitura de GeoTIFF e descriptografia local (AES-GCM, OpenSSL AES-CBC, Base64/Hex)
    │   └── localAccountStore.ts         # Persistência local (localStorage + sincronização com /api/local/state) e hash SHA-256
    └── components/
        ├── Navigation.tsx               # Cabeçalho responsivo (Pesquisa, Colaboradores, Entrar/Perfil, Tema e Nova Análise)
        ├── UnifiedResearchWorkspace.tsx # Área principal: Dados Manuais, Copiloto IA, Foto/Câmera, Mapa, Diagnósticos e Catálogo
        ├── AnalogueDashboard.tsx        # Painel de gráficos legendados, comparador, prós/contras, edição inline e exportação CSV
        ├── NasaDataShortcutsModal.tsx   # Modal de atalhos diretos para portais gratuitos da NASA e modelo CSV
        ├── ResearcherCollaborationFeed.tsx # Rede de colaboradores, chat, grupos de estudo e buscas em pesquisas anteriores
        └── AccountEcosystemView.tsx     # Cadastro/login, perfil simplificado, histórico próprio e publicação manual de artigos
```

---

## 4. Funcionalidades Principais

### A. Área de Pesquisa (`UnifiedResearchWorkspace`)
- **Dados Manuais (Aba Padrão)**:
  - Entrada manual de nome da amostra, local da coleta (texto livre com sugestões do catálogo), origem dos dados, notas de campo, minerais com percentuais, umidade ($a_w$), acidez (pH), profundidade (cm) e porosidade (%).
  - Atalho direto **"Publicar Artigo"** (se o usuário não estiver logado, preserva a intenção e abre o formulário pré-preenchido assim que concluir o login/cadastro).
- **Copiloto IA (`nvidia/nemotron-3.5-lightning-30b-a3b`)**:
  - Chat científico contextualizado pelo planeta/satélite escolhido, coordenadas opcionais e sítio selecionado no mapa.
  - Suporte a anexo de arquivos `.csv`, `.json`, `.txt`, `.md` e `.tsv` para interpretação.
  - Bloco recolhível **"Ver raciocínio da IA"** exibindo o processo de pensamento do modelo sem poluir a resposta principal.
- **Foto / Câmera & Imagens GeoTIFF / Protegidas**:
  - Captura de foto ao vivo pela câmera do dispositivo ou upload de imagens comuns (`PNG`, `JPEG`, `WebP`, `GIF`, `BMP`), rasters **`TIFF`/`GeoTIFF`** e arquivos criptografados (`.enc`, `.aes`, `.bin`, `.dat`, `.pgp`, `.asc`, `.b64`, `.crypt`).
  - Extração client-side de telemetria visual via `<canvas>` (RGB médio, albedo/brilho, índice de óxido de ferro `R-B` e contraste superficial) + notas visuais opcionais enviadas ao copiloto.
  - Botão opcional **"Usar minerais sugeridos no meu formulário manual"** (só aplica mediante clique explícito do usuário).
- **Mapa Interativo & Camadas**:
  - Alternância entre **Relevo do Terreno** (OpenTopoMap / NASA SRTM DEM) e **Foto de Satélite** (NASA GIBS MODIS Terra TrueColor).
  - Camada opcional **Eventos NASA** com marcadores ao vivo da API **NASA EONET v3** (incêndios, vulcões, poeira desértica e tempestades).
  - Botão **Minha Localização** com consulta automática de altitude oficial **NASA SRTM 90m**.
  - Filtro por região (incluindo África), planeta, planeta anão ou satélite natural, além de busca textual na tabela **Lugares Parecidos no Mundo**.
- **Copiloto: Análise Rápida & Resumo**:
  - Diagnósticos especializados (comparação dinâmica para o planeta/satélite escolhido, Marte/Jezero, Lua/Shackleton, chance de água/vida, recursos úteis ISRU, Europa, Encélado, Titã, Vênus e simulação de sonda NASA).
  - Geração de resumo completo estruturado com opções de **Copiar**, **Baixar (.md)**, **Imprimir/PDF** e **Publicar como Artigo**.

### B. Atalhos para Fontes Oficiais da NASA (`NasaDataShortcutsModal`)
Para pesquisadores que ainda não têm arquivos CSV, medições ou imagens próprias, a plataforma oferece acessos rápidos no cabeçalho e dentro das abas **Dados Manuais**, **Copiloto IA** e **Foto / Câmera**:
- **Atalhos contextuais dinâmicos** para o local e astro atuais: abrir região no **NASA Worldview**, buscar fotos em **NASA Images**, buscar datasets no **NASA Open Data**, ativar **Eventos NASA no Mapa** e baixar **Modelo de Planilha `.CSV`** compatível com **Importar Planilha**.
- **Catálogo pesquisável e filtrável** de portais públicos: NASA PDS, PDS Geosciences Node (Rovers), NASA Earthdata Search, NASA Worldview, NASA Mars & Moon Trek, Mars Raw Images, MRO HiRISE, Biblioteca Espectral USGS/NASA, NASA Open Data Portal e NASA SSERVI.

### C. Painel Analítico & Gráficos Legendados (`AnalogueDashboard`)
- **4 Gráficos com Legendas Claras**:
  1. **Gráfico de Pizza**: composição mineral da amostra em porcentagem.
  2. **Gráfico de Estrela (Radar)**: comparação em 5 eixos (Minerais, Terreno, Química do Solo, Luz/Radiação e Temperatura) entre sua amostra e o sítio de referência selecionado.
  3. **Gráfico de Arco (Medidor)**: nível geral de semelhança (0–100%) com faixas coloridas explicadas na legenda.
  4. **Gráfico de Linhas Espectrais (400–2500 nm)**: comparação de reflectância entre a amostra atual e o sítio de referência, com tooltip interativo por comprimento de onda.
- **Comparador Dinâmico & Exportação**: seletor de sítio de referência no cabeçalho e botão **CSV** para exportar os dados completos da amostra e do local comparado.
- **Edição Manual no Painel**: edição direta de nome, local, umidade ($a_w$), pH, profundidade, minerais, óxidos **XRF** (`SiO2`, `Fe2O3`, `Al2O3`, `MgO`, `CaO`), eixos do radar e texto de conclusão.

### D. Rede de Colaboradores & Grupos (`ResearcherCollaborationFeed`)
- Diretório de pesquisadores (base científica + perfis criados localmente) com conexões e chat direto.
- Criação e participação em **Grupos de Pesquisa** por planeta ou satélite natural.
- Aba **Pesquisas Anteriores** com filtro por escopo (*Minhas*, *Todas*), filtro por planeta/satélite, busca textual, revisão por pares, comentários, endosso e carregamento direto no painel comparativo.

### E. Contas, Perfis & Publicação de Artigos (`AccountEcosystemView`)
- Cadastro e login validados **no servidor**: senhas com scrypt + sal (`.local-data/auth.json`), sessões por token, mínimo de 8 caracteres e limite de tentativas. Nenhum hash de senha é guardado no navegador nem devolvido pela API. Contas criadas por versões antigas são migradas no primeiro login.
- Perfil simples e editável (nome, apelido `@codename`, foto, instituição, interesses em planetas/luas e bio).
- Editor manual para **Publicar Novo Artigo**, pré-preenchido opcionalmente com os dados manuais ou anotações do copiloto, mantendo total controle editorial do autor.

---

## 5. Planetas, Planetas Anões e Satélites Naturais Suportados

Todos os seletores, filtros, cálculos de fidelidade e consultas da IA listam o conjunto completo:

- **Planetas do Sistema Solar**: Mercúrio, Vênus, Terra (Referência), Marte, Júpiter, Saturno, Urano e Netuno.
- **Planetas Anões**: Ceres e Plutão.
- **Satélites Naturais (Luas)**:
  - **Terra**: Lua
  - **Marte**: Fobos, Deimos
  - **Júpiter**: Io, Europa, Ganimedes, Calisto
  - **Saturno**: Mimas, Encélado, Tétis, Dione, Reia, Titã, Jápeto
  - **Urano**: Miranda, Ariel, Umbriel, Titânia, Oberon
  - **Netuno**: Tritão
  - **Plutão**: Caronte

---

## 6. Sítios Análogos de Referência no Catálogo

- **África**:
  - *Depressão de Danakil & Vulcão Dallol* (Etiópia · Marte)
  - *Estrutura de Richat / Guelb er Richat* (Mauritânia · Marte)
  - *Mar de Areia do Namibe & Planícies de Cascalho* (Namíbia · Titã)
  - *Domo de Impacto de Vredefort* (África do Sul · Lua)
  - *Lago Natron & Rift da África Oriental* (Tanzânia · Encélado)
- **Referências Globais**:
  - *Deserto do Atacama — Salar de Pajonales & Yungay* (Chile · Marte)
  - *Geopark de Lanzarote — Tubo de Lava de La Corona* (Espanha · Lua)
  - *Borup Fiord Pass — Ilha Ellesmere* (Canadá / Ártico · Europa)

Cada sítio tem pelo menos uma **referência revista por pares com DOI** (verificados na Crossref), visível no cartão do sítio e no mapa. A "semelhança" de cada sítio do catálogo é uma **estimativa editorial**; a da amostra do utilizador é calculada (ver secção 9).

Os perfis de colaboradores, mensagens e amostras que vêm com a aplicação são **fictícios e marcados "Demo"** — não representam pessoas reais.

---

## 7. APIs do Servidor (`server.ts`)

| Rota | Método | Descrição |
| :--- | :--- | :--- |
| `/api/ai/chat` | `POST` | Chat copiloto com contexto de amostra, planilha CSV/JSON e coordenadas opcionais via NVIDIA Nemotron |
| `/api/ai/vision-analyze` | `POST` | Análise visual por telemetria RGB/albedo/contraste + metadados raster (o modelo não recebe a imagem) |
| `/api/ai/diagnostics` | `POST` | Diagnósticos especializados para qualquer planeta, planeta anão ou satélite natural |
| `/api/ai/generate-report` | `POST` | Síntese estruturada de pesquisa pronta para revisão e publicação manual |
| `/api/auth/register` · `/login` · `/password` · `/logout` | `POST` | Contas no servidor (scrypt, tokens de sessão, limite de tentativas) |
| `/api/official/catalog` | `GET` | Catálogo ativo de endpoints NASA/DEM, modelo de IA e modo de armazenamento |
| `/api/official/elevation` | `GET` | Consulta altimetria oficial SRTM 90m (`?lat=...&lng=...`) via OpenTopoData |
| `/api/official/nasa-events` | `GET` | Busca eventos naturais ativos da API oficial NASA EONET v3 |
| `/api/local/state` | `GET`/`POST` | Estado partilhado em `.local-data/african-analogs-db.json`. `GET` nunca inclui senhas; `POST` exige sessão válida e só aceita chaves conhecidas |

As rotas `/api/ai/*` têm limite de 30 pedidos por 10 minutos por IP e respondem `503` se `NVIDIA_API_KEY` não estiver definida.

---

## 8. Como Executar Localmente

```bash
# 0. Configurar a chave da IA (o ficheiro .env não vai para o git)
cp .env.example .env   # e preencha NVIDIA_API_KEY

# 1. Instalar dependências
npm install

# 2. Iniciar servidor full-stack de desenvolvimento (Express + Vite na porta 3000)
npm run dev

# 3. Verificar tipos TypeScript e correr os testes
npm run lint
npm test

# 4. Gerar build de produção (frontend dist/ + servidor server.js)
npm run build

# 5. Iniciar em modo produção
npm start
```

Após iniciar com `npm run dev` ou `npm start`, acesse **`http://localhost:3000`**.


---

## 9. Como a Semelhança (AFI) é Calculada

Implementado em `src/services/analogueFidelity.ts` e testado em `src/services/scientific.test.ts`.

- **Mineralogia (60%)** — parte da massa mineral informada que pertence às classes indicadoras do corpo-alvo (ex.: Marte → sulfatos, óxidos de ferro, argilas, cloretos/percloratos, máficos, carbonatos, sílica) e quantas classes diferentes estão presentes.
- **Geoquímica (40%)** — distância da atividade de água (aw) e do pH à faixa de referência do corpo-alvo (100 dentro da faixa, a descer linearmente fora dela).
- **Terreno, radiação e clima** descrevem o *sítio*, não a amostra: são copiados do sítio de referência para o gráfico radar e **não entram na nota**.
- Dados em falta ou provisórios (marcados `unmeasured`, por exemplo numa importação CSV incompleta) **não contam**: uma amostra vazia tem 0%, e a interface mostra a cobertura dos dados.
- Gigantes gasosos não têm superfície sólida, por isso não têm análogo mineral (0%).

As faixas de referência são resumos amplos da literatura, úteis para triagem — não substituem uma comparação publicada.

### Importação CSV/JSON

O modelo de planilha (botão "Modelo CSV") inclui as colunas `minerals` (`"Jarosita: 30; Halita: 25"`) e óxidos XRF (`SiO2`, `Fe2O3`, …). Aceita vírgula ou ponto e vírgula como separador, campos entre aspas e decimais com vírgula. Células vazias ficam marcadas como **não medidas** — nada é inventado.

### Impressão digital das amostras

Cada amostra guarda `hash: "sha256:…"`, calculado sobre os dados científicos (medições, local, autor). Qualquer alteração aos dados produz um valor diferente.
