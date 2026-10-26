<template>
  <div>
    <div class="faixa" aria-hidden="true" />
    <div class="pagina">
    <header class="topo">
      <div class="cabecalho">
        <div>
          <p class="olho">Tribunal Superior Eleitoral · logs das urnas</p>
          <h1>Votos por horário de registro</h1>
          <p class="sub">
            {{ meta ? `${meta.turno}º turno de ${meta.ano}` : "2º turno de 2026" }}
            · contagem pela hora em que a urna computou o voto, não pela apuração
          </p>
        </div>
      </div>
    </header>

    <main>
      <AvisoLimitacao v-if="meta" :amostra="meta.modo === 'fixture'" :texto="meta.aviso" />
      <p v-if="erro" class="erro" role="alert">{{ erro }}</p>

      <FiltrosBar
        :uf="uf"
        :municipio="municipio"
        :ufs="ufs"
        :municipios="municipios"
        @uf="definirUf"
        @municipio="definirMunicipio"
        @limpar="limpar"
      />

      <p v-if="carregando" class="estado">Atualizando…</p>
      <KpiCards v-if="resumo" :resumo="resumo" />
      <HistogramaHora v-if="horas.length" :horas="horas" />

      <div class="colunas">
        <RankingTabela :nivel="nivelRanking" :linhas="ranking" :selecionado="municipio" />
        <ResultadoOficial v-if="oficial" :resultado="oficial" />
      </div>
    </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { storeToRefs } from "pinia";
import AvisoLimitacao from "../components/AvisoLimitacao.vue";
import FiltrosBar from "../components/FiltrosBar.vue";
import HistogramaHora from "../components/HistogramaHora.vue";
import KpiCards from "../components/KpiCards.vue";
import RankingTabela from "../components/RankingTabela.vue";
import ResultadoOficial from "../components/ResultadoOficial.vue";
import { usePainelStore } from "../stores/painel";

const store = usePainelStore();
const { uf, municipio, meta, municipios, resumo, horas, ranking, nivelRanking, oficial, carregando, erro, ufs } =
  storeToRefs(store);
const { iniciar, definirUf, definirMunicipio, limpar } = store;

onMounted(() => {
  void iniciar().catch((falha: unknown) => {
    store.erro = falha instanceof Error ? falha.message : "API indisponível.";
  });
});
</script>
