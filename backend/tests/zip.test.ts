import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { crc32 } from "node:zlib";
import { PASTA_FIXTURES } from "../src/caminhos.js";
import { parseMunicipiosCsv } from "../src/etl/municipios.js";
import { extrairLogd, percorrerLogs } from "../src/etl/zip.js";

test("extrai logd.dat de um zip e também aceita texto puro", async () => {
  const texto = "25/10/2026 17:01:00\tINFO\t1\tVOTA\tO voto do eleitor foi computado\tH\n";
  assert.equal(await extrairLogd(Buffer.from(texto, "latin1")), texto);
  const zip = zipArmazenado([{ nome: "logd.dat", dados: Buffer.from(texto, "latin1") }]);
  assert.equal(await extrairLogd(zip), texto);
});

test("percorre só os logs dentro do zip da UF", async () => {
  const texto = fs.readFileSync(`${PASTA_FIXTURES}/DF/o00406-9701200010001.logjez`);
  const zip = zipArmazenado([
    { nome: "o00406-9701200010001.bu", dados: Buffer.from("boletim") },
    { nome: "o00406-9701200010001.logjez", dados: texto },
  ]);
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "tse-zip-"));
  const arquivo = path.join(pasta, "df.zip");
  fs.writeFileSync(arquivo, zip);
  const nomes: string[] = [];
  await percorrerLogs(arquivo, async (nome) => {
    nomes.push(nome);
  });
  assert.deepEqual(nomes, ["o00406-9701200010001.logjez"]);
});

test("CSV de municípios da amostra", () => {
  const csv = fs.readFileSync(`${PASTA_FIXTURES}/municipios-amostra.csv`, "latin1");
  const lista = parseMunicipiosCsv(csv);
  const saoPaulo = lista.find((item) => item.cdMunicipio === 71072);
  assert.equal(saoPaulo?.uf, "SP");
  assert.equal(saoPaulo?.nome, "São Paulo");
});

function zipArmazenado(arquivos: { nome: string; dados: Buffer }[]): Buffer {
  const locais: Buffer[] = [];
  const centrais: Buffer[] = [];
  let deslocamento = 0;
  for (const arquivo of arquivos) {
    const nome = Buffer.from(arquivo.nome);
    const crc = crc32(arquivo.dados);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(arquivo.dados.length, 18);
    local.writeUInt32LE(arquivo.dados.length, 22);
    local.writeUInt16LE(nome.length, 26);
    const localCompleto = Buffer.concat([local, nome, arquivo.dados]);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(arquivo.dados.length, 20);
    central.writeUInt32LE(arquivo.dados.length, 24);
    central.writeUInt16LE(nome.length, 28);
    central.writeUInt32LE(deslocamento, 42);
    locais.push(localCompleto);
    centrais.push(Buffer.concat([central, nome]));
    deslocamento += localCompleto.length;
  }
  const diretorio = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(deslocamento, 16);
  return Buffer.concat([...locais, diretorio, fim]);
}
