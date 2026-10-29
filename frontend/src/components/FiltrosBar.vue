<template>
  <form class="filtros" @submit.prevent>
    <label>
      Turno
      <select :value="visao" @change="aoMudarVisao">
        <option value="1" :disabled="!turnos.includes(1)">1º turno</option>
        <option value="2" :disabled="!turnos.includes(2)">2º turno</option>
        <option value="comparar" :disabled="!turnos.includes(1) || !turnos.includes(2)">Comparar</option>
      </select>
    </label>
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
import type { Visao } from "../stores/painel";

defineProps<{
  visao: Visao;
  uf: string;
  municipio: number | null;
  ufs: string[];
  turnos: number[];
  municipios: Municipio[];
}>();

const emit = defineEmits<{
  visao: [valor: Visao];
  uf: [valor: string];
  municipio: [valor: number | null];
  limpar: [];
}>();

function aoMudarVisao(evento: Event): void {
  emit("visao", (evento.target as HTMLSelectElement).value as Visao);
}

function aoMudarUf(evento: Event): void {
  emit("uf", (evento.target as HTMLSelectElement).value);
}

function aoMudarMunicipio(evento: Event): void {
  const valor = (evento.target as HTMLSelectElement).value;
  emit("municipio", valor ? Number(valor) : null);
}
</script>
