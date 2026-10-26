<template>
  <section class="painel-bloco oficial">
    <header class="bloco-titulo">
      <h2>Apuração oficial — {{ resultado.cargo }}</h2>
      <p>{{ resultado.observacao }}</p>
    </header>
    <ul class="candidatos">
      <li v-for="candidato in resultado.candidatos" :key="candidato.sigla">
        <div class="identidade">
          <span class="marca" :class="candidato.sigla.toLowerCase()" />
          <div>
            <strong>{{ candidato.sigla }}</strong>
            <span>{{ candidato.nome }}</span>
          </div>
          <em>{{ numero(candidato.votos) }}</em>
        </div>
        <div class="trilho" aria-hidden="true">
          <span :class="candidato.sigla.toLowerCase()" :style="{ width: `${candidato.percentual}%` }" />
        </div>
        <small>{{ percentual(candidato.percentual) }} dos votos válidos divulgados</small>
      </li>
    </ul>
    <p class="diferenca">
      Diferença entre os dois candidatos na apuração: <strong>{{ numero(resultado.diferencaVotos) }}</strong> votos.
      Esse número não sai do log e não se reparte pelas horas.
    </p>
    <p class="fonte">{{ resultado.fonte }}</p>
  </section>
</template>

<script setup lang="ts">
import type { ResultadoOficial } from "../services/api";
import { numero, percentual } from "../services/formato";

defineProps<{ resultado: ResultadoOficial }>();
</script>
