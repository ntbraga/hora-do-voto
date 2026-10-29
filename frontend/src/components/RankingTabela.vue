<template>
  <section class="painel-bloco">
    <header class="bloco-titulo">
      <h2>{{ nivel === "uf" ? "Por UF" : "Por município" }}</h2>
      <p>{{ comparar ? "Totais de cada turno e a diferença do 2º em relação ao 1º." : "Ordenado pelo total de votos." }}</p>
    </header>
    <div class="tabela-wrap">
      <table>
        <thead>
          <tr>
            <th>{{ nivel === "uf" ? "UF" : "Município" }}</th>
            <th v-for="titulo in titulos" :key="titulo">{{ titulo }}</th>
            <th v-if="comparar">Diferença</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="linha in linhas" :key="linha.chave" :class="{ ativa: selecionado != null && linha.chave === String(selecionado) }">
            <td>{{ linha.nome }}</td>
            <td v-for="(valor, indice) in linha.colunas" :key="indice">{{ numero(valor) }}</td>
            <td v-if="comparar">{{ numero(linha.diferenca ?? 0) }}</td>
          </tr>
          <tr v-if="linhas.length === 0">
            <td :colspan="1 + titulos.length + (comparar ? 1 : 0)">Nenhum voto neste recorte.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { numero } from "../services/formato";
import type { LinhaTabela } from "../stores/painel";

defineProps<{
  nivel: "uf" | "municipio";
  linhas: LinhaTabela[];
  titulos: string[];
  comparar: boolean;
  selecionado: number | null;
}>();
</script>
