import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import yauzl from "yauzl";
import { ehArquivoDeLog } from "../domain/secao.js";

interface EntradaZip {
  nome: string;
  dados: Buffer;
}

/**
 * Abre um pacote de log (`.logjez` / `-log.jez`).
 * Em 2026 o pacote é um zip com `logd.dat`. Se o buffer já for texto, devolve o latin-1.
 * Logs antigos em 7-zip não são lidos.
 */
export async function extrairLogd(conteudo: Buffer): Promise<string> {
  if (conteudo.length >= 2 && conteudo.subarray(0, 2).toString("latin1") === "7z") {
    throw new Error("Log em 7-zip (pleitos anteriores a 2026) não é suportado.");
  }
  if (conteudo.length < 2 || conteudo.subarray(0, 2).toString("latin1") !== "PK") {
    return conteudo.toString("latin1");
  }

  const entradas = await lerZipBuffer(conteudo);
  const logd = entradas.find((entrada) => entrada.nome.toLowerCase().endsWith("logd.dat"));
  if (logd) return logd.dados.toString("latin1");

  const aninhado = entradas.find((entrada) => ehArquivoDeLog(entrada.nome));
  if (aninhado) return extrairLogd(aninhado.dados);
  if (entradas[0]) return entradas[0].dados.toString("latin1");
  throw new Error("Pacote de log vazio.");
}

/**
 * Percorre um zip do TSE (possivelmente com zips internos) e entrega cada log de urna.
 * Arquivos de boletim, RDV e assinatura são ignorados.
 */
export async function percorrerLogs(
  caminhoZip: string,
  visitar: (nome: string, dados: Buffer) => Promise<void>,
): Promise<void> {
  await percorrerArquivo(caminhoZip, visitar, 0);
}

async function percorrerArquivo(
  caminhoZip: string,
  visitar: (nome: string, dados: Buffer) => Promise<void>,
  profundidade: number,
): Promise<void> {
  if (profundidade > 3) return;
  const zip = await abrirArquivo(caminhoZip);
  try {
    await new Promise<void>((resolve, reject) => {
      const seguir = () => zip.readEntry();
      zip.on("entry", (entrada: yauzl.Entry) => {
        const nome = entrada.fileName;
        if (nome.endsWith("/")) {
          seguir();
          return;
        }
        const tratar = ehArquivoDeLog(nome) || nome.toLowerCase().endsWith(".zip");
        if (!tratar) {
          seguir();
          return;
        }
        zip.openReadStream(entrada, (erro, stream) => {
          if (erro || !stream) {
            reject(erro ?? new Error(`Sem stream para ${nome}`));
            return;
          }
          const pedacos: Buffer[] = [];
          stream.on("data", (pedaco: Buffer) => pedacos.push(pedaco));
          stream.on("error", reject);
          stream.on("end", () => {
            void (async () => {
              const dados = Buffer.concat(pedacos);
              if (ehArquivoDeLog(nome)) await visitar(nome, dados);
              else await percorrerBufferZip(dados, visitar, profundidade + 1);
              seguir();
            })().catch(reject);
          });
        });
      });
      zip.on("end", () => resolve());
      zip.on("error", reject);
      zip.readEntry();
    });
  } finally {
    try {
      zip.close();
    } catch {
      // O leitor já pode ter encerrado o arquivo.
    }
  }
}

async function percorrerBufferZip(
  dados: Buffer,
  visitar: (nome: string, dados: Buffer) => Promise<void>,
  profundidade: number,
): Promise<void> {
  const temporario = path.join(os.tmpdir(), `tse-log-${process.pid}-${Date.now()}-${profundidade}.zip`);
  await fs.promises.writeFile(temporario, dados);
  try {
    await percorrerArquivo(temporario, visitar, profundidade);
  } finally {
    await fs.promises.unlink(temporario).catch(() => undefined);
  }
}

function abrirArquivo(caminho: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(caminho, { lazyEntries: true, autoClose: false }, (erro, zip) => {
      if (erro || !zip) reject(erro ?? new Error(`Não abriu ${caminho}`));
      else resolve(zip);
    });
  });
}

function lerZipBuffer(conteudo: Buffer): Promise<EntradaZip[]> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(conteudo, { lazyEntries: true }, (erro, zip) => {
      if (erro || !zip) {
        reject(erro ?? new Error("Zip inválido"));
        return;
      }
      const entradas: EntradaZip[] = [];
      zip.on("entry", (entrada: yauzl.Entry) => {
        if (entrada.fileName.endsWith("/")) {
          zip.readEntry();
          return;
        }
        zip.openReadStream(entrada, (erroStream, stream) => {
          if (erroStream || !stream) {
            reject(erroStream ?? new Error("Stream inválida"));
            return;
          }
          const pedacos: Buffer[] = [];
          stream.on("data", (pedaco: Buffer) => pedacos.push(pedaco));
          stream.on("error", reject);
          stream.on("end", () => {
            entradas.push({ nome: entrada.fileName, dados: Buffer.concat(pedacos) });
            zip.readEntry();
          });
        });
      });
      zip.on("end", () => resolve(entradas));
      zip.on("error", reject);
      zip.readEntry();
    });
  });
}
