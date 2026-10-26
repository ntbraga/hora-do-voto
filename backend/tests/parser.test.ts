import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { PASTA_FIXTURES } from "../src/caminhos.js";
import { contarPorHora, resumirHoras } from "../src/domain/agregacao.js";
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
  const faixas = resumirHoras(contarPorHora(eventos.votosSegundos, 0));
  assert.deepEqual(faixas, { total: 9, ate17: 5, h17: 2, h18: 1, apos19: 1, apos17: 4 });
});

test("17:00 conta como após as 17h e 16:59 não", () => {
  const texto = [
    "25/10/2026 08:00:00\tINFO\t1\tVOTA\tAguardando digitação do identificador do eleitor\tH",
    "25/10/2026 16:59:59\tINFO\t1\tVOTA\tO voto do eleitor foi computado\tH",
    "25/10/2026 17:00:00\tINFO\t1\tVOTA\tO voto do eleitor foi computado\tH",
  ].join("\n");
  const eventos = lerEventos(texto);
  const faixas = resumirHoras(contarPorHora(eventos.votosSegundos, 0));
  assert.equal(faixas.ate17, 1);
  assert.equal(faixas.h17, 1);
  assert.equal(faixas.apos17, 1);
});

test("Acre: relógio local duas horas atrás vira horário de Brasília", () => {
  const texto = fs.readFileSync(`${PASTA_FIXTURES}/AC/o00406-0139200020003.logjez`, "latin1");
  const eventos = lerEventos(texto);
  const fuso = estimarFuso(eventos.aberturaSegundos, eventos.votosSegundos[0], "AC");
  assert.equal(fuso, -2);
  const faixas = resumirHoras(contarPorHora(eventos.votosSegundos, fuso));
  assert.deepEqual(faixas, { total: 5, ate17: 2, h17: 1, h18: 2, apos19: 0, apos17: 3 });
});

test("abertura uma hora à frente (Noronha) não usa o fuso zero de PE", () => {
  const abertura = 9 * 3600;
  assert.equal(estimarFuso(abertura, null, "PE"), 1);
  assert.equal(horaBrasilia(18 * 3600, 1), 17);
});
