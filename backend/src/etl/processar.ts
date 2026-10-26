import { contarPorHora } from "../domain/agregacao.js";
import { estimarFuso } from "../domain/fuso.js";
import { lerEventos, resolverSecao } from "../domain/parser.js";
import type { Repositorio } from "../db/repositorio.js";
import { extrairLogd, percorrerLogs } from "./zip.js";

export interface ResultadoArquivo {
  arquivos: number;
  erros: number;
  votos: number;
}

/**
 * Lê um log de urna e soma os votos na hora de Brasília da seção correspondente.
 */
export async function incorporarLog(
  repositorio: Repositorio,
  uf: string,
  nome: string,
  conteudo: Buffer,
): Promise<void> {
  const texto = await extrairLogd(conteudo);
  const eventos = lerEventos(texto);
  const secao = resolverSecao(nome, eventos.ident);
  if (!secao) throw new Error("Não foi possível identificar a seção.");

  const fuso = estimarFuso(eventos.aberturaSegundos, eventos.votosSegundos[0] ?? null, uf);
  repositorio.somarSecao({
    uf,
    cdMunicipio: secao.cdMunicipio,
    zona: secao.zona,
    secao: secao.secao,
    porHora: contarPorHora(eventos.votosSegundos, fuso),
  });
}

/** Processa o zip de uma UF e grava votos e progresso na mesma transação. */
export async function processarZipUf(
  repositorio: Repositorio,
  caminhoZip: string,
  uf: string,
): Promise<ResultadoArquivo> {
  const resultado: ResultadoArquivo = { arquivos: 0, erros: 0, votos: 0 };
  const detalhes: string[] = [];

  repositorio.iniciarTransacao();
  try {
    repositorio.limparUf(uf);
    await percorrerLogs(caminhoZip, async (nome, dados) => {
      resultado.arquivos += 1;
      try {
        await incorporarLog(repositorio, uf, nome, dados);
      } catch (erro) {
        resultado.erros += 1;
        if (detalhes.length < 5) {
          const mensagem = erro instanceof Error ? erro.message : String(erro);
          detalhes.push(`${nome}: ${mensagem}`);
        }
      }
    });
    resultado.votos = repositorio.resumo({ uf }).votosTotal;
    repositorio.registrarProgresso({
      uf,
      status: resultado.votos === 0 ? "erro" : "ok",
      arquivos: resultado.arquivos,
      erros: resultado.erros,
      votos: resultado.votos,
      detalhe: detalhes.join(" | ") || null,
    });
    repositorio.confirmarTransacao();
    return resultado;
  } catch (erro) {
    repositorio.desfazerTransacao();
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    repositorio.registrarProgresso({
      uf,
      status: "erro",
      arquivos: resultado.arquivos,
      erros: resultado.erros + 1,
      votos: 0,
      detalhe: mensagem,
    });
    throw erro;
  }
}
