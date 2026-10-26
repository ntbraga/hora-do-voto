<template>
  <section class="kpis" aria-label="Totais do recorte">
    <article>
      <p>Votos no log</p>
      <strong>{{ numero(resumo.votosTotal) }}</strong>
      <span>{{ numero(resumo.secoes) }} seções</span>
    </article>
    <article class="faixa-prorrogacao">
      <p>Após as 17h</p>
      <strong>{{ numero(resumo.votosApos17) }}</strong>
      <span>{{ percentual(resumo.pctApos17) }} do recorte · {{ numero(resumo.secoesComVotoTardio) }} seções</span>
    </article>
    <article class="faixa-pt">
      <p>17h–18h</p>
      <strong>{{ numero(resumo.votos17a18) }}</strong>
      <span>hora 17, horário de Brasília</span>
    </article>
    <article class="faixa-pl">
      <p>18h–19h</p>
      <strong>{{ numero(resumo.votos18a19) }}</strong>
      <span>hora 18, horário de Brasília</span>
    </article>
    <article>
      <p>A partir das 19h</p>
      <strong>{{ numero(resumo.votosApos19) }}</strong>
      <span>fora da janela prorrogada</span>
    </article>
  </section>
</template>

<script setup lang="ts">
import type { Resumo } from "../services/api";
import { numero, percentual } from "../services/formato";

defineProps<{ resumo: Resumo }>();
</script>
