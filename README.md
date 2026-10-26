# Votos por horário de registro

Painel do 2º turno de 2026 que conta os votos pelo instante em que a urna gravou o evento **"O voto do eleitor foi computado"**. A hora usada é a de Brasília, não a hora em que o boletim entrou na apuração.

O recorte principal é a prorrogação das **17h às 19h**: votos na hora 17 (17h–18h), na hora 18 (18h–19h) e a partir das 19h.

## O que o log não diz

O `logd.dat` não identifica o candidato. A série hora a hora é anônima. Vermelho (`#C8102E`, PT) e azul (`#0033A0`, PL) marcam as faixas de horário e, num bloco separado, os totais da apuração oficial. Um número não explica o outro.

A urna grava a hora local. O Acre fica duas horas atrás de Brasília; AM, MT, MS, RO e RR, uma hora. O ETL converte para Brasília antes de cortar às 17h. Um voto às 15h20 no relógio do Acre entra na faixa 17h–18h.

## Como rodar

Requer Node.js 22 ou mais recente.

```bash
npm install
npm test
npm run dev
```

- API: http://localhost:3333/api/resumo
- Painel: http://localhost:5173

Na primeira subida o banco SQLite está vazio e a API carrega a amostra em `backend/fixtures/`. O aviso no topo deixa isso explícito. Para recarregar a amostra:

```bash
npm run seed
```

## ETL com os arquivos do TSE

Os logs oficiais estão no conjunto [Arquivos transmitidos para totalização](https://dadosabertos.tse.jus.br/dataset/resultados-2026-arquivos-transmitidos-para-totalizacao), um zip por UF. O CLI consulta o CKAN e, se o turno ainda não estiver listado, tenta a URL padrão do CDN:

`https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/arqurnatot/bu_imgbu_logjez_rdv_vscmr_2026_{turno}t_{UF}.zip`

Cada zip tem de centenas de MB a vários GB. O download retoma de onde parou (`*.parcial`). Só os `.logjez` / `-log.jez` são lidos; boletim, RDV e assinatura são ignorados.

```bash
npm run etl -- --turno 2 --ufs AC
npm run etl -- --turno 2 --ufs AC,BA,RJ,SP
npm run etl -- --turno 2 --ufs ALL
npm run etl -- --turno 2 --ufs ALL --paralelo 3
npm run etl -- --zip /caminho/bu_....zip --uf AC
npm run etl -- --turno 1 --ufs AC
```

`--paralelo` define quantos zips baixam ao mesmo tempo (padrão 1, teto 4). A gravação no banco continua uma UF por vez.

Se o 2º turno ainda não foi publicado, o comando para antes de apagar a amostra e explica o motivo. Os nomes dos municípios vêm de [municipio_tse_ibge.zip](https://cdn.tse.jus.br/estatistica/sead/odsele/municipio_tse_ibge/municipio_tse_ibge.zip).

O banco fica em `backend/data/votos.sqlite` (não versionado).

O leitor foi conferido com o zip real do 1º turno do Acre (`-log.jez` com `logd.dat`): 2.270 seções, nenhum arquivo rejeitado, votos concentrados entre 8h e 16h de Brasília.

## API

| Rota | Uso |
| --- | --- |
| `GET /api/health` | saúde |
| `GET /api/meta` | turno, modo (`fixture` ou `etl`) e aviso |
| `GET /api/municipios?uf=SP` | municípios que têm voto na UF |
| `GET /api/resumo?uf=&municipio=` | totais e faixas após as 17h |
| `GET /api/hora-a-hora?uf=&municipio=` | série 0–23 |
| `GET /api/ranking` | UFs, pelos votos após as 17h |
| `GET /api/ranking?uf=SP` | municípios da UF |
| `GET /api/resultado-oficial` | totais PT e PL da apuração, só contexto |

`municipio` é o código TSE (`CD_MUNICIPIO_TSE`).

## Forma do código

- `backend/` — Fastify, TypeScript, SQLite (`node:sqlite`). Repositório → serviço → rotas. O ETL fica em `backend/src/etl/`.
- `frontend/` — Vue 3, Vite, Pinia, Vue Router, Chart.js. A página pede os dados; os componentes só exibem.

Os totais oficiais editáveis estão em `backend/dados/resultado-oficial.json`.
