import fs from "node:fs";
import { ARQUIVO_MUNICIPIOS, PASTA_FIXTURES } from "../caminhos.js";
import type { Repositorio } from "../db/repositorio.js";

const URL_MUNICIPIOS = "https://cdn.tse.jus.br/estatistica/sead/odsele/municipio_tse_ibge/municipio_tse_ibge.zip";

export interface MunicipioCsv {
  uf: string;
  cdMunicipio: number;
  nome: string;
}

/**
 * Garante a tabela de municípios. Prefere o CSV oficial em cache, tenta baixá-lo
 * e, sem rede, usa a lista curta que acompanha a amostra.
 */
export async function garantirMunicipios(repositorio: Repositorio): Promise<void> {
  const csv = await obterCsv();
  const municipios = parseMunicipiosCsv(csv);
  repositorio.transacao(() => {
    for (const municipio of municipios) repositorio.salvarMunicipio(municipio);
  });
}

export function parseMunicipiosCsv(texto: string): MunicipioCsv[] {
  const linhas = texto.split(/\r?\n/).filter((linha) => linha.trim());
  if (linhas.length < 2) return [];
  const cabecalho = campos(linhas[0]).map((coluna) => coluna.toUpperCase());
  const iUf = cabecalho.indexOf("SG_UF");
  const iCodigo = cabecalho.indexOf("CD_MUNICIPIO_TSE");
  const iNome = cabecalho.indexOf("NM_MUNICIPIO_TSE");
  if (iUf < 0 || iCodigo < 0 || iNome < 0) {
    throw new Error("CSV de municípios sem as colunas SG_UF, CD_MUNICIPIO_TSE e NM_MUNICIPIO_TSE.");
  }

  const saida: MunicipioCsv[] = [];
  for (const linha of linhas.slice(1)) {
    const colunas = campos(linha);
    const uf = (colunas[iUf] ?? "").trim().toUpperCase();
    const codigo = Number(colunas[iCodigo]);
    const nome = (colunas[iNome] ?? "").trim();
    if (!uf || !nome || Number.isNaN(codigo)) continue;
    saida.push({ uf, cdMunicipio: codigo, nome });
  }
  return saida;
}

async function obterCsv(): Promise<string> {
  if (fs.existsSync(ARQUIVO_MUNICIPIOS)) {
    return fs.readFileSync(ARQUIVO_MUNICIPIOS, "latin1");
  }
  try {
    const resposta = await fetch(URL_MUNICIPIOS);
    if (resposta.ok) {
      const buffer = Buffer.from(await resposta.arrayBuffer());
      const texto = await csvDeZipOuTexto(buffer);
      await fs.promises.mkdir(pathDir(ARQUIVO_MUNICIPIOS), { recursive: true });
      await fs.promises.writeFile(ARQUIVO_MUNICIPIOS, texto, "latin1");
      return texto;
    }
  } catch {
    // Sem rede: a amostra local basta para o painel de demonstração.
  }
  const amostra = `${PASTA_FIXTURES}/municipios-amostra.csv`;
  return fs.readFileSync(amostra, "latin1");
}

async function csvDeZipOuTexto(buffer: Buffer): Promise<string> {
  if (buffer.subarray(0, 2).toString("latin1") !== "PK") return buffer.toString("latin1");
  const { default: yauzl } = await import("yauzl");
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (erro, zip) => {
      if (erro || !zip) {
        reject(erro ?? new Error("Zip de municípios inválido"));
        return;
      }
      zip.on("entry", (entrada) => {
        if (!entrada.fileName.toLowerCase().endsWith(".csv")) {
          zip.readEntry();
          return;
        }
        zip.openReadStream(entrada, (erroStream, stream) => {
          if (erroStream || !stream) {
            reject(erroStream ?? new Error("CSV ausente"));
            return;
          }
          const pedacos: Buffer[] = [];
          stream.on("data", (pedaco: Buffer) => pedacos.push(pedaco));
          stream.on("end", () => resolve(Buffer.concat(pedacos).toString("latin1")));
          stream.on("error", reject);
        });
      });
      zip.on("error", reject);
      zip.readEntry();
    });
  });
}

function campos(linha: string): string[] {
  return linha.split(";").map((coluna) => coluna.trim().replace(/^"|"$/g, ""));
}

function pathDir(arquivo: string): string {
  const indice = arquivo.lastIndexOf("/");
  return indice < 0 ? "." : arquivo.slice(0, indice);
}
