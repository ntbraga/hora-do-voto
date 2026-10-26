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
  uf TEXT NOT NULL,
  cd_municipio INTEGER NOT NULL,
  hora INTEGER NOT NULL,
  votos INTEGER NOT NULL,
  PRIMARY KEY (uf, cd_municipio, hora)
);

CREATE TABLE IF NOT EXISTS secoes (
  uf TEXT NOT NULL,
  cd_municipio INTEGER NOT NULL,
  zona INTEGER NOT NULL,
  secao INTEGER NOT NULL,
  votos_total INTEGER NOT NULL,
  votos_apos_17 INTEGER NOT NULL,
  votos_17_18 INTEGER NOT NULL,
  votos_18_19 INTEGER NOT NULL,
  votos_apos_19 INTEGER NOT NULL,
  PRIMARY KEY (uf, cd_municipio, zona, secao)
);

CREATE TABLE IF NOT EXISTS etl_progresso (
  uf TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  arquivos INTEGER NOT NULL DEFAULT 0,
  erros INTEGER NOT NULL DEFAULT 0,
  votos INTEGER NOT NULL DEFAULT 0,
  detalhe TEXT,
  atualizado_em TEXT NOT NULL
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
  db.exec(SCHEMA);
  return db;
}
