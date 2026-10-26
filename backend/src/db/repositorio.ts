import type { DatabaseSync } from "node:sqlite";
import { resumirHoras, percentual } from "../domain/agregacao.js";
import type { Faixas } from "../domain/agregacao.js";

export interface Filtro {
  uf?: string;
  municipio?: number;
}

export interface MunicipioSalvo {
  uf: string;
  cdMunicipio: number;
  nome: string;
}

export interface SecaoGravada {
  uf: string;
  cdMunicipio: number;
  zona: number;
  secao: number;
  porHora: number[];
}

export interface ProgressoUf {
  uf: string;
  status: string;
  arquivos: number;
  erros: number;
  votos: number;
  detalhe: string | null;
  atualizadoEm: string;
}

export interface ResumoConsulta {
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

export interface HoraConsulta {
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

/**
 * Acesso ao SQLite. As rotas não montam SQL; passam por aqui e pelo serviço.
 */
export class Repositorio {
  constructor(private readonly db: DatabaseSync) {}

  transacao(trabalho: () => void): void {
    this.iniciarTransacao();
    try {
      trabalho();
      this.confirmarTransacao();
    } catch (erro) {
      this.desfazerTransacao();
      throw erro;
    }
  }

  /** Abre uma transação que pode atravessar `await` (o ETL lê o zip de forma assíncrona). */
  iniciarTransacao(): void {
    this.db.exec("BEGIN IMMEDIATE");
  }

  confirmarTransacao(): void {
    this.db.exec("COMMIT");
  }

  desfazerTransacao(): void {
    this.db.exec("ROLLBACK");
  }

  salvarMunicipio(municipio: MunicipioSalvo): void {
    this.db
      .prepare(
        `INSERT INTO municipios (uf, cd_municipio, nome)
         VALUES (?, ?, ?)
         ON CONFLICT(uf, cd_municipio) DO UPDATE SET nome = excluded.nome`,
      )
      .run(municipio.uf, municipio.cdMunicipio, municipio.nome);
  }

  /** Remove votos e seções. Municípios e o arquivo físico permanecem. */
  limparVotos(): void {
    this.transacao(() => {
      this.db.exec("DELETE FROM votos_hora");
      this.db.exec("DELETE FROM secoes");
      this.db.exec("DELETE FROM etl_progresso");
    });
  }

  limparUf(uf: string): void {
    this.db.prepare("DELETE FROM votos_hora WHERE uf = ?").run(uf);
    this.db.prepare("DELETE FROM secoes WHERE uf = ?").run(uf);
  }

  /**
   * Soma os votos de uma seção. Dois logs da mesma seção (urna substituída)
   * se acumulam em vez de se substituírem.
   */
  somarSecao(secao: SecaoGravada): void {
    const faixas = resumirHoras(secao.porHora);
    const voto = this.db.prepare(
      `INSERT INTO votos_hora (uf, cd_municipio, hora, votos)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(uf, cd_municipio, hora) DO UPDATE SET votos = votos + excluded.votos`,
    );
    for (let hora = 0; hora < 24; hora += 1) {
      const quantidade = secao.porHora[hora] ?? 0;
      if (quantidade === 0) continue;
      voto.run(secao.uf, secao.cdMunicipio, hora, quantidade);
    }
    this.db
      .prepare(
        `INSERT INTO secoes (
           uf, cd_municipio, zona, secao, votos_total, votos_apos_17,
           votos_17_18, votos_18_19, votos_apos_19
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(uf, cd_municipio, zona, secao) DO UPDATE SET
           votos_total = votos_total + excluded.votos_total,
           votos_apos_17 = votos_apos_17 + excluded.votos_apos_17,
           votos_17_18 = votos_17_18 + excluded.votos_17_18,
           votos_18_19 = votos_18_19 + excluded.votos_18_19,
           votos_apos_19 = votos_apos_19 + excluded.votos_apos_19`,
      )
      .run(
        secao.uf,
        secao.cdMunicipio,
        secao.zona,
        secao.secao,
        faixas.total,
        faixas.apos17,
        faixas.h17,
        faixas.h18,
        faixas.apos19,
      );
  }

  registrarProgresso(progresso: Omit<ProgressoUf, "atualizadoEm"> & { atualizadoEm?: string }): void {
    const quando = progresso.atualizadoEm ?? new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO etl_progresso (uf, status, arquivos, erros, votos, detalhe, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(uf) DO UPDATE SET
           status = excluded.status,
           arquivos = excluded.arquivos,
           erros = excluded.erros,
           votos = excluded.votos,
           detalhe = excluded.detalhe,
           atualizado_em = excluded.atualizado_em`,
      )
      .run(progresso.uf, progresso.status, progresso.arquivos, progresso.erros, progresso.votos, progresso.detalhe, quando);
  }

  definirMeta(chave: string, valor: string): void {
    this.db
      .prepare(
        `INSERT INTO meta (chave, valor) VALUES (?, ?)
         ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`,
      )
      .run(chave, valor);
  }

  obterMeta(chave: string): string | null {
    const linha = this.db.prepare("SELECT valor FROM meta WHERE chave = ?").get(chave) as { valor: string } | undefined;
    return linha?.valor ?? null;
  }

  ufsComVoto(): string[] {
    const linhas = this.db.prepare("SELECT DISTINCT uf FROM votos_hora ORDER BY uf").all() as { uf: string }[];
    return linhas.map((linha) => linha.uf);
  }

  listarProgresso(): ProgressoUf[] {
    const linhas = this.db
      .prepare(
        `SELECT uf, status, arquivos, erros, votos, detalhe, atualizado_em AS atualizadoEm
         FROM etl_progresso ORDER BY uf`,
      )
      .all() as unknown as ProgressoUf[];
    return linhas.map(numeroProgresso);
  }

  municipiosDaUf(uf: string): { cdMunicipio: number; nome: string }[] {
    const linhas = this.db
      .prepare(
        `SELECT m.cd_municipio AS cdMunicipio, m.nome AS nome
         FROM municipios m
         WHERE m.uf = ?
           AND EXISTS (
             SELECT 1 FROM votos_hora v
             WHERE v.uf = m.uf AND v.cd_municipio = m.cd_municipio
           )
         ORDER BY m.nome`,
      )
      .all(uf) as { cdMunicipio: number; nome: string }[];
    return linhas;
  }

  nomeMunicipio(uf: string, cdMunicipio: number): string | null {
    const linha = this.db
      .prepare("SELECT nome FROM municipios WHERE uf = ? AND cd_municipio = ?")
      .get(uf, cdMunicipio) as { nome: string } | undefined;
    return linha?.nome ?? null;
  }

  resumo(filtro: Filtro): ResumoConsulta {
    const votos = this.where("votos_hora", filtro);
    const linha = this.db
      .prepare(
        `SELECT
           COALESCE(SUM(votos), 0) AS total,
           COALESCE(SUM(CASE WHEN hora < 17 THEN votos ELSE 0 END), 0) AS ate17,
           COALESCE(SUM(CASE WHEN hora = 17 THEN votos ELSE 0 END), 0) AS h17,
           COALESCE(SUM(CASE WHEN hora = 18 THEN votos ELSE 0 END), 0) AS h18,
           COALESCE(SUM(CASE WHEN hora >= 19 THEN votos ELSE 0 END), 0) AS apos19
         FROM votos_hora ${votos.sql}`,
      )
      .get(...votos.params) as Record<string, number>;

    const secoes = this.where("secoes", filtro);
    const contagem = this.db
      .prepare(
        `SELECT
           COUNT(*) AS secoes,
           COALESCE(SUM(CASE WHEN votos_apos_17 > 0 THEN 1 ELSE 0 END), 0) AS tardias
         FROM secoes ${secoes.sql}`,
      )
      .get(...secoes.params) as { secoes: number; tardias: number };

    const faixas: Faixas = {
      total: Number(linha.total),
      ate17: Number(linha.ate17),
      h17: Number(linha.h17),
      h18: Number(linha.h18),
      apos19: Number(linha.apos19),
      apos17: Number(linha.h17) + Number(linha.h18) + Number(linha.apos19),
    };
    return {
      votosTotal: faixas.total,
      votosAte17: faixas.ate17,
      votos17a18: faixas.h17,
      votos18a19: faixas.h18,
      votosApos19: faixas.apos19,
      votosApos17: faixas.apos17,
      pctApos17: percentual(faixas.apos17, faixas.total),
      secoes: Number(contagem.secoes),
      secoesComVotoTardio: Number(contagem.tardias),
    };
  }

  horaAHora(filtro: Filtro): HoraConsulta[] {
    const votos = this.where("votos_hora", filtro);
    const linhas = this.db
      .prepare(`SELECT hora, SUM(votos) AS votos FROM votos_hora ${votos.sql} GROUP BY hora`)
      .all(...votos.params) as { hora: number; votos: number }[];
    const porHora = Array.from({ length: 24 }, (_, hora) => ({ hora, votos: 0 }));
    for (const linha of linhas) porHora[linha.hora] = { hora: linha.hora, votos: Number(linha.votos) };
    return porHora;
  }

  rankingUf(): RankingLinha[] {
    const linhas = this.db
      .prepare(
        `SELECT
           uf AS chave,
           uf AS nome,
           SUM(votos) AS votosTotal,
           SUM(CASE WHEN hora >= 17 THEN votos ELSE 0 END) AS votosApos17,
           SUM(CASE WHEN hora = 17 THEN votos ELSE 0 END) AS votos17a18,
           SUM(CASE WHEN hora = 18 THEN votos ELSE 0 END) AS votos18a19,
           SUM(CASE WHEN hora >= 19 THEN votos ELSE 0 END) AS votosApos19
         FROM votos_hora
         GROUP BY uf
         ORDER BY votosApos17 DESC, uf`,
      )
      .all() as unknown as RankingLinha[];
    return linhas.map(completarRanking);
  }

  rankingMunicipios(uf: string): RankingLinha[] {
    const linhas = this.db
      .prepare(
        `SELECT
           CAST(v.cd_municipio AS TEXT) AS chave,
           COALESCE(m.nome, CAST(v.cd_municipio AS TEXT)) AS nome,
           SUM(v.votos) AS votosTotal,
           SUM(CASE WHEN v.hora >= 17 THEN v.votos ELSE 0 END) AS votosApos17,
           SUM(CASE WHEN v.hora = 17 THEN v.votos ELSE 0 END) AS votos17a18,
           SUM(CASE WHEN v.hora = 18 THEN v.votos ELSE 0 END) AS votos18a19,
           SUM(CASE WHEN v.hora >= 19 THEN v.votos ELSE 0 END) AS votosApos19
         FROM votos_hora v
         LEFT JOIN municipios m ON m.uf = v.uf AND m.cd_municipio = v.cd_municipio
         WHERE v.uf = ?
         GROUP BY v.cd_municipio
         ORDER BY votosApos17 DESC, nome`,
      )
      .all(uf) as unknown as RankingLinha[];
    return linhas.map(completarRanking);
  }

  private where(_tabela: string, filtro: Filtro): { sql: string; params: (string | number)[] } {
    const partes: string[] = [];
    const params: (string | number)[] = [];
    if (filtro.uf) {
      partes.push("uf = ?");
      params.push(filtro.uf);
    }
    if (filtro.municipio != null) {
      partes.push("cd_municipio = ?");
      params.push(filtro.municipio);
    }
    return { sql: partes.length ? `WHERE ${partes.join(" AND ")}` : "", params };
  }
}

function completarRanking(linha: RankingLinha): RankingLinha {
  const votosTotal = Number(linha.votosTotal);
  const votosApos17 = Number(linha.votosApos17);
  return {
    chave: String(linha.chave),
    nome: linha.nome,
    votosTotal,
    votosApos17,
    votos17a18: Number(linha.votos17a18),
    votos18a19: Number(linha.votos18a19),
    votosApos19: Number(linha.votosApos19),
    pctApos17: percentual(votosApos17, votosTotal),
  };
}

function numeroProgresso(linha: ProgressoUf): ProgressoUf {
  return {
    ...linha,
    arquivos: Number(linha.arquivos),
    erros: Number(linha.erros),
    votos: Number(linha.votos),
  };
}
