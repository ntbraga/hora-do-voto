import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS municipios (
  uf TEXT NOT NULL,
  cd_municipio INTEGER NOT NULL,
  nome TEXT NOT NULL,
  PRIMARY KEY (uf, cd_municipio)
);

CREATE TABLE IF NOT EXISTS votos_hora (
  turno INTEGER NOT NULL,
  uf TEXT NOT NULL,
  cd_municipio INTEGER NOT NULL,
  hora INTEGER NOT NULL,
  votos INTEGER NOT NULL,
  PRIMARY KEY (turno, uf, cd_municipio, hora)
);

CREATE TABLE IF NOT EXISTS secoes (
  turno INTEGER NOT NULL,
  uf TEXT NOT NULL,
  cd_municipio INTEGER NOT NULL,
  zona INTEGER NOT NULL,
  secao INTEGER NOT NULL,
  votos_total INTEGER NOT NULL,
  PRIMARY KEY (turno, uf, cd_municipio, zona, secao)
);

CREATE TABLE IF NOT EXISTS etl_progresso (
  turno INTEGER NOT NULL,
  uf TEXT NOT NULL,
  status TEXT NOT NULL,
  arquivos INTEGER NOT NULL DEFAULT 0,
  erros INTEGER NOT NULL DEFAULT 0,
  votos INTEGER NOT NULL DEFAULT 0,
  detalhe TEXT,
  atualizado_em TEXT NOT NULL,
  PRIMARY KEY (turno, uf)
);

CREATE TABLE IF NOT EXISTS meta (
  chave TEXT PRIMARY KEY,
  valor TEXT
);
`;

/** Abre (ou cria) o SQLite e garante o esquema. `:memory:` serve aos testes. */
export function abrirConexao(caminho: string): DatabaseSync {
  if (caminho !== ":memory:") {
    fs.mkdirSync(path.dirname(caminho), { recursive: true });
  }
  const db = new DatabaseSync(caminho);
  db.exec("PRAGMA foreign_keys = ON;");
  if (caminho !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  migrarEsquema(db);
  db.exec(SCHEMA);
  return db;
}

/**
 * Bancos anteriores não têm `turno`. Recria as tabelas de voto.
 * Municípios e o arquivo físico permanecem; a amostra volta a ser carregada.
 */
function migrarEsquema(db: DatabaseSync): void {
  const existe = db.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'votos_hora'").get();
  if (!existe || temColuna(db, "votos_hora", "turno")) return;
  db.exec("DROP TABLE IF EXISTS votos_hora");
  db.exec("DROP TABLE IF EXISTS secoes");
  db.exec("DROP TABLE IF EXISTS etl_progresso");
}

function temColuna(db: DatabaseSync, tabela: string, coluna: string): boolean {
  const linhas = db.prepare(`PRAGMA table_info(${tabela})`).all() as { name: string }[];
  return linhas.some((linha) => linha.name === coluna);
}
