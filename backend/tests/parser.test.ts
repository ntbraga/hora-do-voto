import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { PASTA_FIXTURES } from "../src/caminhos.js";
import { contarPorHora } from "../src/domain/agregacao.js";
import { estimarFuso, horaBrasilia } from "../src/domain/fuso.js";
import { lerEventos } from "../src/domain/parser.js";
import { identificarPeloNome } from "../src/domain/secao.js";

test("nome do log identifica município, zona e seção", () => {
  assert.deepEqual(identificarPeloNome("o00406-7107200010001.logjez"), {
    cdMunicipio: 71072,
    zona: 1,
    secao: 1,
  });
  assert.deepEqual(identificarPeloNome("pasta/0139200020003-log.jez"), {
    cdMunicipio: 1392,
    zona: 2,
    secao: 3,
  });
});

test("ignora voto de outro dia e de outro aplicativo", () => {
  const texto = fs.readFileSync(`${PASTA_FIXTURES}/SP/o00406-7107200010001.logjez`, "latin1");
  const eventos = lerEventos(texto);
  assert.equal(eventos.dia, "25/10/2026");
  assert.equal(eventos.aberturaSegundos, 8 * 3600 + 5);
  assert.equal(eventos.votosSegundos.length, 9);
  assert.equal(eventos.ident.cdMunicipio, 71072);
  const porHora = contarPorHora(eventos.votosSegundos, 0);
  assert.equal(porHora.reduce((soma, votos) => soma + votos, 0), 9);
  assert.equal(porHora[17], 2);
  assert.equal(porHora[18], 1);
});

test("Acre: relógio local duas horas atrás vira horário de Brasília", () => {
  const texto = fs.readFileSync(`${PASTA_FIXTURES}/AC/o00406-0139200020003.logjez`, "latin1");
  const eventos = lerEventos(texto);
  const fuso = estimarFuso(eventos.aberturaSegundos, eventos.votosSegundos[0], "AC");
  assert.equal(fuso, -2);
  const porHora = contarPorHora(eventos.votosSegundos, fuso);
  assert.equal(porHora.reduce((soma, votos) => soma + votos, 0), 5);
  assert.equal(porHora[17], 1);
  assert.equal(porHora[18], 2);
});

test("abertura uma hora à frente (Noronha) não usa o fuso zero de PE", () => {
  const abertura = 9 * 3600;
  assert.equal(estimarFuso(abertura, null, "PE"), 1);
  assert.equal(horaBrasilia(18 * 3600, 1), 17);
});
