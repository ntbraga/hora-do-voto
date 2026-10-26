import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { api, type Filtro, type Hora, type Meta, type Municipio, type RankingLinha, type ResultadoOficial, type Resumo } from "../services/api";

export const usePainelStore = defineStore("painel", () => {
  const uf = ref("");
  const municipio = ref<number | null>(null);
  const meta = ref<Meta | null>(null);
  const municipios = ref<Municipio[]>([]);
  const resumo = ref<Resumo | null>(null);
  const horas = ref<Hora[]>([]);
  const ranking = ref<RankingLinha[]>([]);
  const nivelRanking = ref<"uf" | "municipio">("uf");
  const oficial = ref<ResultadoOficial | null>(null);
  const carregando = ref(false);
  const erro = ref("");

  const filtro = computed<Filtro>(() => ({
    uf: uf.value || undefined,
    municipio: municipio.value ?? undefined,
  }));

  const ufs = computed(() => meta.value?.ufs ?? []);

  async function iniciar(): Promise<void> {
    meta.value = await api.meta();
    oficial.value = await api.resultadoOficial().catch(() => null);
    await carregar();
  }

  async function definirUf(valor: string): Promise<void> {
    uf.value = valor;
    municipio.value = null;
    erro.value = "";
    try {
      municipios.value = valor ? await api.municipios(valor) : [];
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

  async function carregar(): Promise<void> {
    carregando.value = true;
    erro.value = "";
    try {
      const [resumoNovo, serie, tabela] = await Promise.all([
        api.resumo(filtro.value),
        api.horaAHora(filtro.value),
        api.ranking(uf.value || undefined),
      ]);
      resumo.value = resumoNovo;
      horas.value = serie.horas;
      ranking.value = tabela.linhas;
      nivelRanking.value = tabela.nivel;
    } catch (falha) {
      erro.value = falha instanceof Error ? falha.message : "Falha ao consultar a API.";
    } finally {
      carregando.value = false;
    }
  }

  return {
    uf,
    municipio,
    meta,
    municipios,
    resumo,
    horas,
    ranking,
    nivelRanking,
    oficial,
    carregando,
    erro,
    ufs,
    iniciar,
    definirUf,
    definirMunicipio,
    limpar,
  };
});
