import fs from "node:fs";
import path from "node:path";
import { PASTA_FIXTURES } from "../caminhos.js";
import { ehArquivoDeLog } from "../domain/secao.js";
import { normalizarUf } from "../domain/ufs.js";
import type { Repositorio } from "../db/repositorio.js";
import { garantirMunicipios } from "./municipios.js";
import { incorporarLog } from "./processar.js";

const AVISO_AMOSTRA =
  "Amostra de demonstração. Os votos hora a hora vieram de logs fictícios, no formato do TSE, " +
  "para o painel funcionar sem baixar os zips. Rode o ETL para substituir pelos arquivos oficiais.";

/** Carrega os logs de `fixtures/` e marca o banco como demonstração. */
export async function carregarAmostra(repositorio: Repositorio): Promise<void> {
  await garantirMunicipios(repositorio);
  repositorio.limparVotos();

  const entradas = await fs.promises.readdir(PASTA_FIXTURES, { withFileTypes: true });
  for (const entrada of entradas) {
    if (!entrada.isDirectory()) continue;
    const uf = normalizarUf(entrada.name);
    if (!uf) continue;

    const pasta = path.join(PASTA_FIXTURES, entrada.name);
    const arquivos = (await fs.promises.readdir(pasta)).filter(ehArquivoDeLog);
    let erros = 0;
    repositorio.iniciarTransacao();
    try {
      for (const arquivo of arquivos) {
        const conteudo = await fs.promises.readFile(path.join(pasta, arquivo));
        try {
          await incorporarLog(repositorio, uf, arquivo, conteudo);
        } catch (erro) {
          erros += 1;
          console.error(`${uf}/${arquivo}: ${erro instanceof Error ? erro.message : erro}`);
        }
      }
      const votos = repositorio.resumo({ uf }).votosTotal;
      repositorio.registrarProgresso({
        uf,
        status: "amostra",
        arquivos: arquivos.length,
        erros,
        votos,
        detalhe: "Log fictício no formato do TSE.",
      });
      repositorio.confirmarTransacao();
    } catch (erro) {
      repositorio.desfazerTransacao();
      throw erro;
    }
  }

  repositorio.definirMeta("modo", "fixture");
  repositorio.definirMeta("ano", "2026");
  repositorio.definirMeta("turno", "2");
  repositorio.definirMeta("atualizado_em", new Date().toISOString());
  repositorio.definirMeta("aviso", AVISO_AMOSTRA);
}
