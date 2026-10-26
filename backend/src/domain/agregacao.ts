import { horaBrasilia } from "./fuso.js";

export interface Faixas {
  total: number;
  ate17: number;
  h17: number;
  h18: number;
  apos19: number;
  apos17: number;
}

/** Conta votos por hora cheia de Brasília (0–23). */
export function contarPorHora(segundosLocais: number[], fuso: number): number[] {
  const porHora = Array.from({ length: 24 }, () => 0);
  for (const segundos of segundosLocais) {
    porHora[horaBrasilia(segundos, fuso)] += 1;
  }
  return porHora;
}

/**
 * Faixas da prorrogação, em horário de Brasília.
 * 17h–18h é a hora 17 (de 17:00:00 a 17:59:59). Um voto às 17:00:00 já conta como após as 17h.
 */
export function resumirHoras(porHora: number[]): Faixas {
  let ate17 = 0;
  let h17 = 0;
  let h18 = 0;
  let apos19 = 0;
  for (let hora = 0; hora < 24; hora += 1) {
    const votos = porHora[hora] ?? 0;
    if (hora < 17) ate17 += votos;
    else if (hora === 17) h17 += votos;
    else if (hora === 18) h18 += votos;
    else apos19 += votos;
  }
  return { total: ate17 + h17 + h18 + apos19, ate17, h17, h18, apos19, apos17: h17 + h18 + apos19 };
}

export function percentual(parte: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((parte / total) * 10000) / 100;
}
