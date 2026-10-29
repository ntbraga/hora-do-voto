<template>
  <aside class="aviso" :class="{ amostra: amostra }">
    <p v-if="amostra"><strong>Demonstração.</strong> {{ texto }}</p>
    <p v-else>{{ texto }}</p>
    <p class="limite">
      O log registra quando o voto foi computado na urna, em horário de Brasília, e não o candidato escolhido.
    </p>
  </aside>
</template>

<script setup lang="ts">
defineProps<{
  texto: string;
  amostra: boolean;
}>();
</script>
