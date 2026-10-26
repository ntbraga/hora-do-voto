const formato = new Intl.NumberFormat("pt-BR");

export function numero(valor: number): string {
  return formato.format(valor);
}

export function percentual(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}
