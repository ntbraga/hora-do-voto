export interface Resumo {
  votosTotal: number;
  secoes: number;
}

export interface Hora {
  hora: number;
  votos: number;
}

export interface RankingLinha {
  chave: string;
  nome: string;
  votosTotal: number;
}

export interface Meta {
  ano: number;
  turnos: number[];
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
  turno: number;
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
  params.set("turno", String(filtro.turno));
  if (filtro.uf) params.set("uf", filtro.uf);
  if (filtro.municipio != null) params.set("municipio", String(filtro.municipio));
  return `?${params.toString()}`;
}

export const api = {
  meta: () => obter<Meta>("/api/meta"),
  municipios: (uf: string, turno: number) => obter<Municipio[]>(`/api/municipios?uf=${uf}&turno=${turno}`),
  resumo: (filtro: Filtro) => obter<Resumo>(`/api/resumo${consulta(filtro)}`),
  horaAHora: (filtro: Filtro) => obter<{ horas: Hora[] }>(`/api/hora-a-hora${consulta(filtro)}`),
  ranking: (turno: number, uf?: string) =>
    obter<{ nivel: "uf" | "municipio"; linhas: RankingLinha[] }>(`/api/ranking?turno=${turno}${uf ? `&uf=${uf}` : ""}`),
  resultadoOficial: () => obter<ResultadoOficial>("/api/resultado-oficial"),
};
