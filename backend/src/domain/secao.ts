/** Chave da seção eleitoral como o TSE numera no nome do log. */
export interface ChaveSecao {
  cdMunicipio: number;
  zona: number;
  secao: number;
}

/**
 * O nome do log de urna termina com município (5) + zona (4) + seção (4).
 * Ex.: `o00406-7107200010001.logjez` → São Paulo, zona 1, seção 1.
 * Em 2026 o pacote também aparece como `*-log.jez`.
 */
const RE_NOME = /(\d{5})(\d{4})(\d{4})(?:\.logjez|-log\.jez)$/i;

export function identificarPeloNome(nomeArquivo: string): ChaveSecao | null {
  const encontrado = nomeArquivo.match(RE_NOME);
  if (!encontrado) return null;
  return {
    cdMunicipio: Number(encontrado[1]),
    zona: Number(encontrado[2]),
    secao: Number(encontrado[3]),
  };
}

export function ehArquivoDeLog(nome: string): boolean {
  const normalizado = nome.toLowerCase();
  return normalizado.endsWith(".logjez") || normalizado.endsWith("-log.jez");
}
