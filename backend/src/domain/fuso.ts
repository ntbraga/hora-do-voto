import { ABERTURA_HORA, FUSO_OFICIAL } from "./ufs.js";

/**
 * Estima a diferença, em horas inteiras, entre o relógio da urna e Brasília.
 *
 * A votação oficial começa às 8h de Brasília. Se a urna abre perto de
 * `8 + fuso oficial`, usa-se o fuso da UF. Se a abertura destoa mais de 45
 * minutos (oeste do Amazonas, Fernando de Noronha, leste de MT), o fuso sai
 * da própria abertura. No exterior (ZZ) vale só o dado da urna.
 *
 * Convenção: horário de Brasília = hora local − fuso.
 * Ex.: Acre, fuso −2, voto às 15h locais → 17h em Brasília.
 */
export function estimarFuso(
  aberturaSegundos: number | null,
  primeiroVotoSegundos: number | null,
  uf: string,
): number {
  const referencia = aberturaSegundos ?? primeiroVotoSegundos;
  if (referencia == null) return FUSO_OFICIAL[uf] ?? 0;

  const horas = referencia / 3600;
  const oficial = FUSO_OFICIAL[uf] ?? 0;
  if (uf && uf !== "ZZ" && Math.abs(horas - ABERTURA_HORA - oficial) <= 0.75) {
    return oficial;
  }
  return limitar(Math.round(horas - ABERTURA_HORA), -3, 2);
}

/** Converte um instante local (segundos desde a meia-noite) para a hora cheia em Brasília. */
export function horaBrasilia(segundosLocal: number, fuso: number): number {
  const hora = Math.floor((segundosLocal - fuso * 3600) / 3600);
  return limitar(hora, 0, 23);
}

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor));
}
