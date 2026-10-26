import fs from "node:fs";
import { ARQUIVO_RESULTADO } from "../caminhos.js";
import type { Filtro, RankingLinha, Repositorio, ResumoConsulta, HoraConsulta, ProgressoUf } from "../db/repositorio.js";

export interface MetaPainel {
  ano: number;
  turno: number;
  modo: string;
  atualizadoEm: string | null;
  ufs: string[];
  aviso: string;
  progresso: ProgressoUf[];
}

export interface CandidatoOficial {
  nome: string;
  partido: string;
  sigla: string;
  votos: number;
  percentual: number;
}

export interface ResultadoOficial {
  ano: number;
  turno: number;
  cargo: string;
  fonte: string;
  observacao: string;
  candidatos: CandidatoOficial[];
  diferencaVotos: number;
}

/**
 * Regras de leitura do painel. O repositório devolve linhas; aqui o formato
 * da API fica estável.
 */
export class VotosService {
  constructor(private readonly repositorio: Repositorio) {}

  meta(): MetaPainel {
    const ano = Number(this.repositorio.obterMeta("ano") ?? 2026);
    const turno = Number(this.repositorio.obterMeta("turno") ?? 2);
    const modo = this.repositorio.obterMeta("modo") ?? "vazio";
    return {
      ano,
      turno,
      modo,
      atualizadoEm: this.repositorio.obterMeta("atualizado_em"),
      ufs: this.repositorio.ufsComVoto(),
      aviso: this.repositorio.obterMeta("aviso") ?? "",
      progresso: this.repositorio.listarProgresso(),
    };
  }

  municipios(uf: string): { cdMunicipio: number; nome: string }[] {
    return this.repositorio.municipiosDaUf(uf);
  }

  resumo(filtro: Filtro): ResumoConsulta {
    return this.repositorio.resumo(filtro);
  }

  horaAHora(filtro: Filtro): HoraConsulta[] {
    return this.repositorio.horaAHora(filtro);
  }

  ranking(uf?: string): { nivel: "uf" | "municipio"; linhas: RankingLinha[] } {
    if (uf) return { nivel: "municipio", linhas: this.repositorio.rankingMunicipios(uf) };
    return { nivel: "uf", linhas: this.repositorio.rankingUf() };
  }

  resultadoOficial(): ResultadoOficial | null {
    if (!fs.existsSync(ARQUIVO_RESULTADO)) return null;
    const bruto = JSON.parse(fs.readFileSync(ARQUIVO_RESULTADO, "utf8")) as Omit<ResultadoOficial, "diferencaVotos">;
    const votos = bruto.candidatos.map((candidato) => candidato.votos).sort((a, b) => b - a);
    const diferencaVotos = votos.length >= 2 ? votos[0] - votos[1] : 0;
    return { ...bruto, diferencaVotos };
  }
}
