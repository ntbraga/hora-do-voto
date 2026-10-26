import { horaBrasilia } from "./fuso.js";

/** Conta votos por hora cheia de Brasília (0–23). */
export function contarPorHora(segundosLocais: number[], fuso: number): number[] {
  const porHora = Array.from({ length: 24 }, () => 0);
  for (const segundos of segundosLocais) {
    porHora[horaBrasilia(segundos, fuso)] += 1;
  }
  return porHora;
}
