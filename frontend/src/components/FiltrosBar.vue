<template>
  <form class="filtros" @submit.prevent>
    <label>
      UF
      <select :value="uf" @change="aoMudarUf">
        <option value="">Brasil</option>
        <option v-for="sigla in ufs" :key="sigla" :value="sigla">{{ sigla }}</option>
      </select>
    </label>
    <label>
      Município
      <select :value="municipio ?? ''" :disabled="!uf" @change="aoMudarMunicipio">
        <option value="">{{ uf ? "Todos" : "Escolha uma UF" }}</option>
        <option v-for="cidade in municipios" :key="cidade.cdMunicipio" :value="cidade.cdMunicipio">
          {{ cidade.nome }}
        </option>
      </select>
    </label>
    <button type="button" class="limpar" :disabled="!uf && municipio == null" @click="$emit('limpar')">
      Limpar
    </button>
  </form>
</template>

<script setup lang="ts">
import type { Municipio } from "../services/api";

defineProps<{
  uf: string;
  municipio: number | null;
  ufs: string[];
  municipios: Municipio[];
}>();

const emit = defineEmits<{
  uf: [valor: string];
  municipio: [valor: number | null];
  limpar: [];
}>();

function aoMudarUf(evento: Event): void {
  emit("uf", (evento.target as HTMLSelectElement).value);
}

function aoMudarMunicipio(evento: Event): void {
  const valor = (evento.target as HTMLSelectElement).value;
  emit("municipio", valor ? Number(valor) : null);
}
</script>
