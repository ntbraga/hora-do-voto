/** Unidades da Federação usadas pelo TSE, incluindo o exterior (ZZ). */
export const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
  "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP",
  "TO", "ZZ",
] as const;

export type Uf = (typeof UFS)[number];

/**
 * Fuso oficial do relógio da urna em relação a Brasília.
 * A urna grava hora local. AC está 2h atrás; AM, MT, MS, RO e RR, 1h atrás.
 */
export const FUSO_OFICIAL: Record<string, number> = {
  AC: -2,
  AM: -1,
  MT: -1,
  MS: -1,
  RO: -1,
  RR: -1,
};

/** Hora de Brasília em que a votação regular abre e em que deveria encerrar. */
export const ABERTURA_HORA = 8;
export const ENCERRAMENTO_HORA = 17;

export function normalizarUf(valor: string | undefined): string | undefined {
  if (!valor) return undefined;
  const uf = valor.trim().toUpperCase();
  return (UFS as readonly string[]).includes(uf) ? uf : undefined;
}

export function listarUfs(argumento: string): string[] {
  if (argumento.trim().toUpperCase() === "ALL") return [...UFS];
  const lista = argumento.split(",").map((uf) => uf.trim().toUpperCase()).filter(Boolean);
  const invalidas = lista.filter((uf) => !(UFS as readonly string[]).includes(uf));
  if (invalidas.length) {
    throw new Error(`UF desconhecida: ${invalidas.join(", ")}`);
  }
  return lista;
}
