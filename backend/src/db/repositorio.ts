import type { DatabaseSync } from "node:sqlite";

export interface Filtro {
  turno: number;
  uf?: string;
  municipio?: number;
}

export interface MunicipioSalvo {
  uf: string;
  cdMunicipio: number;
  nome: string;
}

export interface SecaoGravada {
  turno: number;
  uf: string;
  cdMunicipio: number;
  zona: number;
  secao: number;
  porHora: number[];
}

export interface ProgressoUf {
  turno: number;
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
  secoes: number;
}

export interface HoraConsulta {
  hora: number;
  votos: number;
}

export interface RankingLinha {
  chave: string;
  nome: string;
  votosTotal: number;
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

  limparUf(turno: number, uf: string): void {
    this.db.prepare("DELETE FROM votos_hora WHERE turno = ? AND uf = ?").run(turno, uf);
    this.db.prepare("DELETE FROM secoes WHERE turno = ? AND uf = ?").run(turno, uf);
  }

  /**
   * Soma os votos de uma seção. Dois logs da mesma seção (urna substituída)
   * se acumulam em vez de se substituírem.
   */
  somarSecao(secao: SecaoGravada): void {
    const total = secao.porHora.reduce((soma, quantidade) => soma + quantidade, 0);
    const voto = this.db.prepare(
      `INSERT INTO votos_hora (turno, uf, cd_municipio, hora, votos)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(turno, uf, cd_municipio, hora) DO UPDATE SET votos = votos + excluded.votos`,
    );
    for (let hora = 0; hora < 24; hora += 1) {
      const quantidade = secao.porHora[hora] ?? 0;
      if (quantidade === 0) continue;
      voto.run(secao.turno, secao.uf, secao.cdMunicipio, hora, quantidade);
    }
    this.db
      .prepare(
        `INSERT INTO secoes (turno, uf, cd_municipio, zona, secao, votos_total)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(turno, uf, cd_municipio, zona, secao) DO UPDATE SET
           votos_total = votos_total + excluded.votos_total`,
      )
      .run(secao.turno, secao.uf, secao.cdMunicipio, secao.zona, secao.secao, total);
  }

  registrarProgresso(progresso: Omit<ProgressoUf, "atualizadoEm"> & { atualizadoEm?: string }): void {
    const quando = progresso.atualizadoEm ?? new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO etl_progresso (turno, uf, status, arquivos, erros, votos, detalhe, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(turno, uf) DO UPDATE SET
           status = excluded.status,
           arquivos = excluded.arquivos,
           erros = excluded.erros,
           votos = excluded.votos,
           detalhe = excluded.detalhe,
           atualizado_em = excluded.atualizado_em`,
      )
      .run(
        progresso.turno,
        progresso.uf,
        progresso.status,
        progresso.arquivos,
        progresso.erros,
        progresso.votos,
        progresso.detalhe,
        quando,
      );
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

  turnosComVoto(): number[] {
    const linhas = this.db.prepare("SELECT DISTINCT turno FROM votos_hora ORDER BY turno").all() as { turno: number }[];
    return linhas.map((linha) => Number(linha.turno));
  }

  listarProgresso(): ProgressoUf[] {
    const linhas = this.db
      .prepare(
        `SELECT turno, uf, status, arquivos, erros, votos, detalhe, atualizado_em AS atualizadoEm
         FROM etl_progresso ORDER BY turno, uf`,
      )
      .all() as unknown as ProgressoUf[];
    return linhas.map(numeroProgresso);
  }

  municipiosDaUf(uf: string, turno: number): { cdMunicipio: number; nome: string }[] {
    const linhas = this.db
      .prepare(
        `SELECT m.cd_municipio AS cdMunicipio, m.nome AS nome
         FROM municipios m
         WHERE m.uf = ?
           AND EXISTS (
             SELECT 1 FROM votos_hora v
             WHERE v.turno = ? AND v.uf = m.uf AND v.cd_municipio = m.cd_municipio
           )
         ORDER BY m.nome`,
      )
      .all(uf, turno) as { cdMunicipio: number; nome: string }[];
    return linhas;
  }

  nomeMunicipio(uf: string, cdMunicipio: number): string | null {
    const linha = this.db
      .prepare("SELECT nome FROM municipios WHERE uf = ? AND cd_municipio = ?")
      .get(uf, cdMunicipio) as { nome: string } | undefined;
    return linha?.nome ?? null;
  }

  resumo(filtro: Filtro): ResumoConsulta {
    const votos = this.where(filtro);
    const linha = this.db
      .prepare(`SELECT COALESCE(SUM(votos), 0) AS total FROM votos_hora ${votos.sql}`)
      .get(...votos.params) as { total: number };
    const secoes = this.db
      .prepare(`SELECT COUNT(*) AS secoes FROM secoes ${votos.sql}`)
      .get(...votos.params) as { secoes: number };
    return { votosTotal: Number(linha.total), secoes: Number(secoes.secoes) };
  }

  horaAHora(filtro: Filtro): HoraConsulta[] {
    const votos = this.where(filtro);
    const linhas = this.db
      .prepare(`SELECT hora, SUM(votos) AS votos FROM votos_hora ${votos.sql} GROUP BY hora`)
      .all(...votos.params) as { hora: number; votos: number }[];
    const porHora = Array.from({ length: 24 }, (_, hora) => ({ hora, votos: 0 }));
    for (const linha of linhas) porHora[linha.hora] = { hora: linha.hora, votos: Number(linha.votos) };
    return porHora;
  }

  rankingUf(turno: number): RankingLinha[] {
    const linhas = this.db
      .prepare(
        `SELECT uf AS chave, uf AS nome, SUM(votos) AS votosTotal
         FROM votos_hora
         WHERE turno = ?
         GROUP BY uf
         ORDER BY votosTotal DESC, uf`,
      )
      .all(turno) as unknown as RankingLinha[];
    return linhas.map(completarRanking);
  }

  rankingMunicipios(turno: number, uf: string): RankingLinha[] {
    const linhas = this.db
      .prepare(
        `SELECT
           CAST(v.cd_municipio AS TEXT) AS chave,
           COALESCE(m.nome, CAST(v.cd_municipio AS TEXT)) AS nome,
           SUM(v.votos) AS votosTotal
         FROM votos_hora v
         LEFT JOIN municipios m ON m.uf = v.uf AND m.cd_municipio = v.cd_municipio
         WHERE v.turno = ? AND v.uf = ?
         GROUP BY v.cd_municipio
         ORDER BY votosTotal DESC, nome`,
      )
      .all(turno, uf) as unknown as RankingLinha[];
    return linhas.map(completarRanking);
  }

  private where(filtro: Filtro): { sql: string; params: (string | number)[] } {
    const partes = ["turno = ?"];
    const params: (string | number)[] = [filtro.turno];
    if (filtro.uf) {
      partes.push("uf = ?");
      params.push(filtro.uf);
    }
    if (filtro.municipio != null) {
      partes.push("cd_municipio = ?");
      params.push(filtro.municipio);
    }
    return { sql: `WHERE ${partes.join(" AND ")}`, params };
  }
}

function completarRanking(linha: RankingLinha): RankingLinha {
  return {
    chave: String(linha.chave),
    nome: linha.nome,
    votosTotal: Number(linha.votosTotal),
  };
}

function numeroProgresso(linha: ProgressoUf): ProgressoUf {
  return {
    ...linha,
    turno: Number(linha.turno),
    arquivos: Number(linha.arquivos),
    erros: Number(linha.erros),
    votos: Number(linha.votos),
  };
}
