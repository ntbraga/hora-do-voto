import { createRouter, createWebHistory } from "vue-router";
import PainelView from "./views/PainelView.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: "/", name: "painel", component: PainelView }],
});
