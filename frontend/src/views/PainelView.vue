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
            Eleições de {{ meta?.ano ?? 2026 }}
            · contagem pela hora em que a urna computou o voto, não pela apuração
          </p>
        </div>
      </div>
    </header>

    <main>
      <AvisoLimitacao v-if="meta" :amostra="meta.modo === 'fixture'" :texto="meta.aviso" />
      <p v-if="erro" class="erro" role="alert">{{ erro }}</p>

      <FiltrosBar
        :visao="visao"
        :uf="uf"
        :municipio="municipio"
        :ufs="ufs"
        :turnos="turnos"
        :municipios="municipios"
        @visao="definirVisao"
        @uf="definirUf"
        @municipio="definirMunicipio"
        @limpar="limpar"
      />

      <p v-if="carregando" class="estado">Atualizando…</p>
      <KpiCards v-if="cartoes.length" :cartoes="cartoes" />
      <HistogramaHora v-if="series.length" :series="series" />

      <div class="colunas">
        <RankingTabela
          :nivel="nivelRanking"
          :linhas="linhas"
          :titulos="titulos"
          :comparar="comparar"
          :selecionado="municipio"
        />
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
const {
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
} = storeToRefs(store);
const { iniciar, definirVisao, definirUf, definirMunicipio, limpar } = store;

onMounted(() => {
  void iniciar().catch((falha: unknown) => {
    store.erro = falha instanceof Error ? falha.message : "API indisponível.";
  });
});
</script>
