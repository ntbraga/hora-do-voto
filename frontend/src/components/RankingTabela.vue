<template>
  <section class="painel-bloco">
    <header class="bloco-titulo">
      <h2>{{ nivel === "uf" ? "Por UF, depois das 17h" : "Por município, depois das 17h" }}</h2>
      <p>Ordenado pelos votos registrados a partir das 17h. A cor não indica candidato.</p>
    </header>
    <div class="tabela-wrap">
      <table>
        <thead>
          <tr>
            <th>{{ nivel === "uf" ? "UF" : "Município" }}</th>
            <th>Votos</th>
            <th>Após 17h</th>
            <th>17h–18h</th>
            <th>18h–19h</th>
            <th>Após 19h</th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="linha in linhas" :key="linha.chave" :class="{ ativa: selecionado != null && linha.chave === String(selecionado) }">
            <td>{{ linha.nome }}</td>
            <td>{{ numero(linha.votosTotal) }}</td>
            <td>{{ numero(linha.votosApos17) }}</td>
            <td class="pt">{{ numero(linha.votos17a18) }}</td>
            <td class="pl">{{ numero(linha.votos18a19) }}</td>
            <td>{{ numero(linha.votosApos19) }}</td>
            <td>{{ percentual(linha.pctApos17) }}</td>
          </tr>
          <tr v-if="linhas.length === 0">
            <td colspan="7">Nenhum voto neste recorte.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { RankingLinha } from "../services/api";
import { numero, percentual } from "../services/formato";

defineProps<{
  nivel: "uf" | "municipio";
  linhas: RankingLinha[];
  selecionado: number | null;
}>();
</script>
