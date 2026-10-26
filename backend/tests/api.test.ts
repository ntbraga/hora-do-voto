import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { criarAplicacao } from "../src/aplicacao.js";
import { abrirConexao } from "../src/db/conexao.js";

test("API da amostra: resumo nacional, filtro e ranking", async () => {
  const { app } = await criarAplicacao(":memory:");
  try {
    const resumo = await app.inject({ method: "GET", url: "/api/resumo?turno=1" });
    assert.equal(resumo.statusCode, 200);
    const corpo = resumo.json();
    assert.equal(corpo.votosTotal, 30);
    assert.equal(corpo.secoes, 6);
    assert.equal(corpo.votosApos17, undefined);

    const acre = await app.inject({ method: "GET", url: "/api/resumo?turno=1&uf=AC" });
    assert.equal(acre.json().votosTotal, 5);

    const horas = await app.inject({ method: "GET", url: "/api/hora-a-hora?turno=1&uf=DF" });
    const serie = horas.json().horas as { hora: number; votos: number }[];
    assert.equal(serie.length, 24);
    assert.equal(serie[17].votos, 0);
    assert.equal(serie.reduce((soma, item) => soma + item.votos, 0), 3);

    const ranking = await app.inject({ method: "GET", url: "/api/ranking?turno=1&uf=SP" });
    const linhas = ranking.json().linhas as { nome: string; votosTotal: number }[];
    assert.equal(ranking.json().nivel, "municipio");
    assert.deepEqual(
      linhas.map((linha) => linha.nome).sort(),
      ["Campinas", "São Paulo"],
    );
    assert.ok(linhas[0].votosTotal >= linhas[1].votosTotal);

    const meta = await app.inject({ method: "GET", url: "/api/meta" });
    assert.equal(meta.json().modo, "fixture");
    assert.deepEqual(meta.json().turnos, [1]);

    const invalido = await app.inject({ method: "GET", url: "/api/resumo?turno=1&uf=XX" });
    assert.equal(invalido.statusCode, 400);
    const semTurno = await app.inject({ method: "GET", url: "/api/resumo" });
    assert.equal(semTurno.statusCode, 400);
  } finally {
    await app.close();
  }
});

test("consulta de um turno não mistura votos do outro", async () => {
  const { app, repositorio } = await criarAplicacao(":memory:");
  try {
    const porHora = Array.from({ length: 24 }, () => 0);
    porHora[10] = 4;
    repositorio.somarSecao({ turno: 2, uf: "DF", cdMunicipio: 97012, zona: 1, secao: 1, porHora });

    const primeiro = await app.inject({ method: "GET", url: "/api/resumo?turno=1" });
    const segundo = await app.inject({ method: "GET", url: "/api/resumo?turno=2" });
    assert.equal(primeiro.json().votosTotal, 30);
    assert.equal(segundo.json().votosTotal, 4);
    assert.deepEqual((await app.inject({ method: "GET", url: "/api/meta" })).json().turnos, [1, 2]);

    const horas = await app.inject({ method: "GET", url: "/api/hora-a-hora?turno=2&uf=DF" });
    const serie = horas.json().horas as { hora: number; votos: number }[];
    assert.equal(serie[10].votos, 4);
    assert.equal(serie.reduce((soma, item) => soma + item.votos, 0), 4);
  } finally {
    await app.close();
  }
});

test("recria tabelas antigas sem a coluna turno", () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "votos-esquema-"));
  const caminho = path.join(pasta, "velho.sqlite");
  const antigo = new DatabaseSync(caminho);
  antigo.exec(`
    CREATE TABLE votos_hora (
      uf TEXT NOT NULL,
      cd_municipio INTEGER NOT NULL,
      hora INTEGER NOT NULL,
      votos INTEGER NOT NULL,
      PRIMARY KEY (uf, cd_municipio, hora)
    );
    CREATE TABLE secoes (
      uf TEXT NOT NULL,
      cd_municipio INTEGER NOT NULL,
      zona INTEGER NOT NULL,
      secao INTEGER NOT NULL,
      votos_total INTEGER NOT NULL,
      votos_apos_17 INTEGER NOT NULL,
      PRIMARY KEY (uf, cd_municipio, zona, secao)
    );
  `);
  antigo.prepare("INSERT INTO votos_hora (uf, cd_municipio, hora, votos) VALUES ('AC', 1, 10, 3)").run();
  antigo.close();

  const db = abrirConexao(caminho);
  const votos = db.prepare("PRAGMA table_info(votos_hora)").all() as { name: string }[];
  const secoes = db.prepare("PRAGMA table_info(secoes)").all() as { name: string }[];
  assert.ok(votos.some((coluna) => coluna.name === "turno"));
  assert.ok(secoes.some((coluna) => coluna.name === "turno"));
  assert.equal(secoes.some((coluna) => coluna.name === "votos_apos_17"), false);
  const total = db.prepare("SELECT COUNT(*) AS n FROM votos_hora").get() as { n: number };
  assert.equal(Number(total.n), 0);
  db.close();
});
