# Votos por horário de registro

Painel das eleições de 2026 que conta os votos pelo instante em que a urna gravou o evento **"O voto do eleitor foi computado"**. A hora usada é a de Brasília, não a hora em que o boletim entrou na apuração. Dá para ver o 1º turno, o 2º turno ou os dois lado a lado.

## O que o log não diz

O `logd.dat` não identifica o candidato. A série hora a hora é anônima. Os totais da apuração oficial ficam num bloco separado e não explicam o horário dos votos.

A urna grava a hora local. O Acre fica duas horas atrás de Brasília; AM, MT, MS, RO e RR, uma hora. O ETL converte para Brasília. Um voto às 15h20 no relógio do Acre entra às 17h20.

## Como rodar

Requer Node.js 22 ou mais recente.

```bash
npm install
npm test
npm run dev
```

- API: http://localhost:3333/api/resumo?turno=1
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
npm run etl -- --ufs AC
npm run etl -- --ufs AC,BA,RJ,SP
npm run etl -- --ufs ALL
npm run etl -- --ufs ALL --paralelo 3
npm run etl -- --turno 1 --ufs AC
npm run etl -- --zip /caminho/bu_....zip --uf AC --turno 1
```

Sem `--turno`, o ETL baixa o 1º e o 2º turno. Se um deles ainda não foi publicado, o outro segue. Se nenhum existir, a amostra permanece. `--paralelo` define quantos zips baixam ao mesmo tempo (padrão 1, teto 4). A gravação no banco continua uma UF por vez.

Os nomes dos municípios vêm de [municipio_tse_ibge.zip](https://cdn.tse.jus.br/estatistica/sead/odsele/municipio_tse_ibge/municipio_tse_ibge.zip).

O banco fica em `backend/data/votos.sqlite` (não versionado).

O leitor foi conferido com o zip real do 1º turno do Acre (`-log.jez` com `logd.dat`): 2.270 seções, nenhum arquivo rejeitado, votos concentrados entre 8h e 16h de Brasília.

## API

| Rota | Uso |
| --- | --- |
| `GET /api/health` | saúde |
| `GET /api/meta` | turnos carregados, modo (`fixture` ou `etl`) e aviso |
| `GET /api/municipios?turno=1&uf=SP` | municípios que têm voto na UF naquele turno |
| `GET /api/resumo?turno=1&uf=&municipio=` | total de votos e de seções |
| `GET /api/hora-a-hora?turno=1&uf=&municipio=` | série 0–23 |
| `GET /api/ranking?turno=1` | UFs, pelo total de votos |
| `GET /api/ranking?turno=1&uf=SP` | municípios da UF |
| `GET /api/resultado-oficial` | totais PT e PL da apuração, só contexto |

`municipio` é o código TSE (`CD_MUNICIPIO_TSE`).

## Forma do código

- `backend/` — Fastify, TypeScript, SQLite (`node:sqlite`). Repositório → serviço → rotas. O ETL fica em `backend/src/etl/`.
- `frontend/` — Vue 3, Vite, Pinia, Vue Router, Chart.js. A página pede os dados; os componentes só exibem.

Os totais oficiais editáveis estão em `backend/dados/resultado-oficial.json`.
