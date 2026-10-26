export interface Resumo {
  votosTotal: number;
  votosAte17: number;
  votos17a18: number;
  votos18a19: number;
  votosApos19: number;
  votosApos17: number;
  pctApos17: number;
  secoes: number;
  secoesComVotoTardio: number;
}

export interface Hora {
  hora: number;
  votos: number;
}

export interface RankingLinha {
  chave: string;
  nome: string;
  votosTotal: number;
  votosApos17: number;
  votos17a18: number;
  votos18a19: number;
  votosApos19: number;
  pctApos17: number;
}

export interface Meta {
  ano: number;
  turno: number;
  modo: string;
  atualizadoEm: string | null;
  ufs: string[];
  aviso: string;
}

export interface Municipio {
  cdMunicipio: number;
  nome: string;
}

export interface Candidato {
  nome: string;
  partido: string;
  sigla: string;
  votos: number;
  percentual: number;
}

export interface ResultadoOficial {
  cargo: string;
  fonte: string;
  observacao: string;
  candidatos: Candidato[];
  diferencaVotos: number;
}

export interface Filtro {
  uf?: string;
  municipio?: number;
}

async function obter<T>(caminho: string): Promise<T> {
  const resposta = await fetch(caminho);
  if (!resposta.ok) {
    const corpo = (await resposta.json().catch(() => null)) as { erro?: string } | null;
    throw new Error(corpo?.erro ?? `Erro ${resposta.status} em ${caminho}`);
  }
  return resposta.json() as Promise<T>;
}

function consulta(filtro: Filtro): string {
  const params = new URLSearchParams();
  if (filtro.uf) params.set("uf", filtro.uf);
  if (filtro.municipio != null) params.set("municipio", String(filtro.municipio));
  const texto = params.toString();
  return texto ? `?${texto}` : "";
}

export const api = {
  meta: () => obter<Meta>("/api/meta"),
  municipios: (uf: string) => obter<Municipio[]>(`/api/municipios?uf=${uf}`),
  resumo: (filtro: Filtro) => obter<Resumo>(`/api/resumo${consulta(filtro)}`),
  horaAHora: (filtro: Filtro) => obter<{ horas: Hora[] }>(`/api/hora-a-hora${consulta(filtro)}`),
  ranking: (uf?: string) => obter<{ nivel: "uf" | "municipio"; linhas: RankingLinha[] }>(`/api/ranking${uf ? `?uf=${uf}` : ""}`),
  resultadoOficial: () => obter<ResultadoOficial>("/api/resultado-oficial"),
};
