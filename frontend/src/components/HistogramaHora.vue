<template>
  <section class="painel-bloco">
    <header class="bloco-titulo">
      <h2>Votos por hora de registro</h2>
      <p>Cada barra é a hora cheia em que a urna gravou “o voto do eleitor foi computado”. Não é o horário da apuração.</p>
    </header>
    <div class="grafico">
      <Bar :data="dados" :options="opcoes" />
    </div>
    <ul v-if="series.length > 1" class="legenda">
      <li v-for="serie in series" :key="serie.nome">
        <i class="swatch" :style="{ background: serie.cor }" /> {{ serie.nome }}
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from "chart.js";
import { computed } from "vue";
import { Bar } from "vue-chartjs";
import { numero } from "../services/formato";
import type { SerieHora } from "../stores/painel";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

const props = defineProps<{ series: SerieHora[] }>();

const horasVisiveis = computed(() => {
  let minimo = 8;
  let maximo = 19;
  for (const serie of props.series) {
    for (const item of serie.horas) {
      if (item.votos > 0) {
        minimo = Math.min(minimo, item.hora);
        maximo = Math.max(maximo, item.hora);
      }
    }
  }
  const horas: number[] = [];
  for (let hora = minimo; hora <= maximo; hora += 1) horas.push(hora);
  return horas;
});

const dados = computed(() => ({
  labels: horasVisiveis.value.map((hora) => `${String(hora).padStart(2, "0")}h`),
  datasets: props.series.map((serie) => ({
    label: serie.nome,
    data: horasVisiveis.value.map((hora) => serie.horas.find((item) => item.hora === hora)?.votos ?? 0),
    backgroundColor: serie.cor,
    borderRadius: 2,
    maxBarThickness: 28,
  })),
}));

const opcoes = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#1f1e1c",
      titleFont: { family: "Segoe UI, Helvetica, Arial, sans-serif" },
      bodyFont: { family: "Segoe UI, Helvetica, Arial, sans-serif" },
      callbacks: {
        label(contexto: { dataset: { label?: string }; parsed: { y: number | null } }): string {
          const nome = contexto.dataset.label ? `${contexto.dataset.label}: ` : "";
          return `${nome}${numero(contexto.parsed.y ?? 0)} votos`;
        },
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: "#5f5c57", font: { size: 11 } },
      border: { color: "#e4e0d8" },
    },
    y: {
      beginAtZero: true,
      grid: { color: "#eceae4" },
      ticks: { color: "#5f5c57", precision: 0 },
      border: { display: false },
    },
  },
};
</script>
