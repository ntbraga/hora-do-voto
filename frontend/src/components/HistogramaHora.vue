<template>
  <section class="painel-bloco">
    <header class="bloco-titulo">
      <h2>Votos por hora de registro</h2>
      <p>Cada barra é a hora cheia em que a urna gravou “o voto do eleitor foi computado”. Não é o horário da apuração.</p>
    </header>
    <div class="grafico">
      <Bar :data="dados" :options="opcoes" />
    </div>
    <ul class="legenda">
      <li><i class="swatch cinza" /> até 17h</li>
      <li><i class="swatch pt" /> 17h–18h</li>
      <li><i class="swatch pl" /> 18h–19h</li>
      <li><i class="swatch tarde" /> a partir de 19h</li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from "chart.js";
import { computed } from "vue";
import { Bar } from "vue-chartjs";
import type { Hora } from "../services/api";
import { numero } from "../services/formato";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

const props = defineProps<{ horas: Hora[] }>();

const CINZA = "#c4c1ba";
const PT = "#C8102E";
const PL = "#0033A0";
const TARDE = "#4d4b47";

const visiveis = computed(() => {
  let minimo = 8;
  let maximo = 19;
  for (const item of props.horas) {
    if (item.votos > 0) {
      minimo = Math.min(minimo, item.hora);
      maximo = Math.max(maximo, item.hora);
    }
  }
  return props.horas.filter((item) => item.hora >= minimo && item.hora <= maximo);
});

function cor(hora: number): string {
  if (hora === 17) return PT;
  if (hora === 18) return PL;
  if (hora >= 19) return TARDE;
  return CINZA;
}

const dados = computed(() => ({
  labels: visiveis.value.map((item) => `${String(item.hora).padStart(2, "0")}h`),
  datasets: [
    {
      data: visiveis.value.map((item) => item.votos),
      backgroundColor: visiveis.value.map((item) => cor(item.hora)),
      borderRadius: 2,
      maxBarThickness: 42,
    },
  ],
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
        label(contexto: { parsed: { y: number | null } }): string {
          return `${numero(contexto.parsed.y ?? 0)} votos`;
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
