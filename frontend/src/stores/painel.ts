import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  api,
  type Filtro,
  type Hora,
  type Meta,
  type Municipio,
  type RankingLinha,
  type ResultadoOficial,
} from "../services/api";

export type Visao = "1" | "2" | "comparar";

export interface Cartao {
  titulo: string;
  votos: number;
  secoes: number;
}

export interface SerieHora {
  nome: string;
  cor: string;
  horas: Hora[];
}

export interface LinhaTabela {
  chave: string;
  nome: string;
  colunas: number[];
  diferenca: number | null;
}

const COR_TURNO: Record<1 | 2, string> = { 1: "#4d4b47", 2: "#1f6f8b" };

export const usePainelStore = defineStore("painel", () => {
  const visao = ref<Visao>("1");
  const uf = ref("");
  const municipio = ref<number | null>(null);
  const meta = ref<Meta | null>(null);
  const municipios = ref<Municipio[]>([]);
  const cartoes = ref<Cartao[]>([]);
  const series = ref<SerieHora[]>([]);
  const linhas = ref<LinhaTabela[]>([]);
  const titulos = ref<string[]>(["Votos"]);
  const nivelRanking = ref<"uf" | "municipio">("uf");
  const oficial = ref<ResultadoOficial | null>(null);
  const carregando = ref(false);
  const erro = ref("");

  const ufs = computed(() => meta.value?.ufs ?? []);
  const turnos = computed(() => meta.value?.turnos ?? []);
  const comparar = computed(() => visao.value === "comparar");

  function filtroDe(turno: number): Filtro {
    return {
      turno,
      uf: uf.value || undefined,
      municipio: municipio.value ?? undefined,
    };
  }

  async function iniciar(): Promise<void> {
    meta.value = await api.meta();
    const disponiveis = meta.value.turnos;
    if (!disponiveis.includes(Number(visao.value)) && disponiveis[0]) visao.value = String(disponiveis[0]) as Visao;
    oficial.value = await api.resultadoOficial().catch(() => null);
    await carregar();
  }

  async function definirVisao(valor: Visao): Promise<void> {
    visao.value = valor;
    await atualizarMunicipios();
    await carregar();
  }

  async function definirUf(valor: string): Promise<void> {
    uf.value = valor;
    municipio.value = null;
    erro.value = "";
    try {
      await atualizarMunicipios();
    } catch (falha) {
      municipios.value = [];
      erro.value = falha instanceof Error ? falha.message : "Falha ao consultar a API.";
      return;
    }
    await carregar();
  }

  async function definirMunicipio(valor: number | null): Promise<void> {
    municipio.value = valor;
    await carregar();
  }

  async function limpar(): Promise<void> {
    uf.value = "";
    municipio.value = null;
    municipios.value = [];
    await carregar();
  }

  async function atualizarMunicipios(): Promise<void> {
    if (!uf.value) {
      municipios.value = [];
      return;
    }
    const pedidos = comparar.value ? [1, 2] : [Number(visao.value)];
    const listas = await Promise.all(pedidos.map((turno) => api.municipios(uf.value, turno)));
    const mapa = new Map<number, Municipio>();
    for (const lista of listas) {
      for (const cidade of lista) mapa.set(cidade.cdMunicipio, cidade);
    }
    municipios.value = [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    if (municipio.value != null && !mapa.has(municipio.value)) municipio.value = null;
  }

  async function carregar(): Promise<void> {
    carregando.value = true;
    erro.value = "";
    try {
      if (comparar.value) await carregarComparacao();
      else await carregarTurno(Number(visao.value) as 1 | 2);
    } catch (falha) {
      erro.value = falha instanceof Error ? falha.message : "Falha ao consultar a API.";
    } finally {
      carregando.value = false;
    }
  }

  async function carregarTurno(turno: 1 | 2): Promise<void> {
    const [resumo, serie, tabela] = await Promise.all([
      api.resumo(filtroDe(turno)),
      api.horaAHora(filtroDe(turno)),
      api.ranking(turno, uf.value || undefined),
    ]);
    cartoes.value = [{ titulo: `${turno}º turno`, votos: resumo.votosTotal, secoes: resumo.secoes }];
    series.value = [{ nome: `${turno}º turno`, cor: COR_TURNO[turno], horas: serie.horas }];
    titulos.value = ["Votos"];
    nivelRanking.value = tabela.nivel;
    linhas.value = tabela.linhas.map((linha) => ({
      chave: linha.chave,
      nome: linha.nome,
      colunas: [linha.votosTotal],
      diferenca: null,
    }));
  }

  async function carregarComparacao(): Promise<void> {
    const [resumo1, resumo2, serie1, serie2, tabela1, tabela2] = await Promise.all([
      api.resumo(filtroDe(1)),
      api.resumo(filtroDe(2)),
      api.horaAHora(filtroDe(1)),
      api.horaAHora(filtroDe(2)),
      api.ranking(1, uf.value || undefined),
      api.ranking(2, uf.value || undefined),
    ]);
    cartoes.value = [
      { titulo: "1º turno", votos: resumo1.votosTotal, secoes: resumo1.secoes },
      { titulo: "2º turno", votos: resumo2.votosTotal, secoes: resumo2.secoes },
      { titulo: "Diferença", votos: resumo2.votosTotal - resumo1.votosTotal, secoes: resumo2.secoes - resumo1.secoes },
    ];
    series.value = [
      { nome: "1º turno", cor: COR_TURNO[1], horas: serie1.horas },
      { nome: "2º turno", cor: COR_TURNO[2], horas: serie2.horas },
    ];
    titulos.value = ["1º turno", "2º turno"];
    nivelRanking.value = uf.value ? "municipio" : "uf";
    linhas.value = juntarRankings(tabela1.linhas, tabela2.linhas);
  }

  return {
    visao,
    uf,
    municipio,
    meta,
    municipios,
    cartoes,
    series,
    linhas,
    titulos,
    nivelRanking,
    oficial,
    carregando,
    erro,
    ufs,
    turnos,
    comparar,
    iniciar,
    definirVisao,
    definirUf,
    definirMunicipio,
    limpar,
  };
});

function juntarRankings(primeiro: RankingLinha[], segundo: RankingLinha[]): LinhaTabela[] {
  const mapa = new Map<string, { nome: string; votos1: number; votos2: number }>();
  for (const linha of primeiro) mapa.set(linha.chave, { nome: linha.nome, votos1: linha.votosTotal, votos2: 0 });
  for (const linha of segundo) {
    const atual = mapa.get(linha.chave) ?? { nome: linha.nome, votos1: 0, votos2: 0 };
    atual.nome = linha.nome;
    atual.votos2 = linha.votosTotal;
    mapa.set(linha.chave, atual);
  }
  return [...mapa.entries()]
    .map(([chave, linha]) => ({
      chave,
      nome: linha.nome,
      colunas: [linha.votos1, linha.votos2],
      diferenca: linha.votos2 - linha.votos1,
    }))
    .sort((a, b) => b.colunas[0] + b.colunas[1] - (a.colunas[0] + a.colunas[1]) || a.nome.localeCompare(b.nome, "pt-BR"));
}
