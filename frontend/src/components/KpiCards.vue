<template>
  <section class="kpis" aria-label="Totais">
    <article v-for="cartao in cartoes" :key="cartao.titulo">
      <p>{{ cartao.titulo }}</p>
      <strong>{{ numero(cartao.votos) }}</strong>
      <span>{{ rotuloSecoes(cartao) }}</span>
    </article>
  </section>
</template>

<script setup lang="ts">
import type { Cartao } from "../stores/painel";
import { numero } from "../services/formato";

defineProps<{ cartoes: Cartao[] }>();

function rotuloSecoes(cartao: Cartao): string {
  if (cartao.titulo !== "Diferença") return `${numero(cartao.secoes)} seções`;
  if (cartao.secoes === 0) return "mesmas seções";
  const sentido = cartao.secoes > 0 ? "a mais" : "a menos";
  return `${numero(Math.abs(cartao.secoes))} seções ${sentido}`;
}
</script>
