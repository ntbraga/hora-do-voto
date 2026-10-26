<template>
  <aside class="aviso" :class="{ amostra: amostra }">
    <p v-if="amostra"><strong>Demonstração.</strong> {{ texto }}</p>
    <p v-else>{{ texto }}</p>
    <p class="limite">
      O log registra quando o voto foi computado na urna, em horário de Brasília, e não o candidato escolhido.
      Por isso a série hora a hora não separa PT e PL. As cores vermelho e azul marcam só as faixas 17h–18h e 18h–19h.
    </p>
  </aside>
</template>

<script setup lang="ts">
defineProps<{
  texto: string;
  amostra: boolean;
}>();
</script>
