import { PASTA_DOWNLOADS } from "../caminhos.js";
import type { Repositorio } from "../db/repositorio.js";
import { baixarComRetomada, descobrirZips, ErroDownload, urlZipUf } from "./download.js";
import { garantirMunicipios } from "./municipios.js";
import { processarZipUf } from "./processar.js";
import path from "node:path";

/** Downloads ao mesmo tempo. O SQLite só grava uma UF por vez. */
export const TETO_PARALELO = 4;

export interface OpcoesEtl {
  ano: number;
  turno: number;
  ufs: string[];
  /** Zip já baixado. Exige `uf`. */
  zip?: string;
  uf?: string;
  /** Downloads simultâneos. Padrão 1. Acima do teto, o ETL usa o teto. */
  paralelo?: number;
}

/** Aceita 1–4. Valor inválido é erro. Acima do teto, avisa e usa 4. */
export function limitarParalelo(pedido: number): number {
  if (!Number.isInteger(pedido) || pedido < 1) throw new Error("--paralelo inválido.");
  if (pedido > TETO_PARALELO) {
    console.warn(`--paralelo ${pedido} passa do teto de ${TETO_PARALELO}. Usando ${TETO_PARALELO}.`);
    return TETO_PARALELO;
  }
  return pedido;
}

/** Uma gravação por vez. A próxima espera a anterior, mesmo quando ela falha. */
export function criarTrava(): <T>(trabalho: () => Promise<T>) => Promise<T> {
  let fila = Promise.resolve();
  return (trabalho) => {
    const execucao = fila.then(trabalho, trabalho);
    fila = execucao.then(
      () => undefined,
      () => undefined,
    );
    return execucao;
  };
}

/**
 * Roda até `limite` tarefas ao mesmo tempo.
 * `deveParar` impede pegar item novo; o que já começou termina.
 */
export async function executarEmParalelo<T>(
  itens: readonly T[],
  limite: number,
  trabalho: (item: T) => Promise<void>,
  deveParar: () => boolean = () => false,
): Promise<void> {
  let indice = 0;
  const trabalhadores = Math.min(Math.max(limite, 0), itens.length);

  async function worker(): Promise<void> {
    while (!deveParar()) {
      const atual = indice;
      indice += 1;
      if (atual >= itens.length) return;
      const item = itens[atual];
      if (item === undefined) return;
      await trabalho(item);
    }
  }

  await Promise.all(Array.from({ length: trabalhadores }, () => worker()));
}

export interface ResumoEtl {
  processadas: string[];
  falhas: { uf: string; mensagem: string }[];
}

/**
 * Baixa (ou abre) os zips de log de cada UF e grava a agregação hora a hora.
 * Apaga a amostra antes, para não misturar demonstração com dado do TSE.
 * Se nenhuma URL do turno existir, não apaga nada.
 * Várias UFs baixam ao mesmo tempo; a gravação no banco é uma por vez.
 */
export async function executarEtl(repositorio: Repositorio, opcoes: OpcoesEtl): Promise<ResumoEtl> {
  await garantirMunicipios(repositorio);
  const falhas: { uf: string; mensagem: string }[] = [];
  const processadas: string[] = [];

  if (opcoes.zip) {
    if (!opcoes.uf) throw new Error("Informe --uf junto com --zip.");
    repositorio.limparVotos();
    await processarZipUf(repositorio, opcoes.zip, opcoes.uf);
    processadas.push(opcoes.uf);
    gravarMetaEtl(repositorio, opcoes, processadas, falhas);
    return { processadas, falhas };
  }

  const publicadas = await descobrirZips(opcoes.ano, opcoes.turno).catch(() => new Map<string, string>());
  const plano = opcoes.ufs.map((uf) => ({
    uf,
    url: publicadas.get(uf) ?? urlZipUf(opcoes.ano, opcoes.turno, uf),
    publicada: publicadas.has(uf),
  }));

  if (publicadas.size === 0) {
    const sonda = plano[0];
    if (sonda) {
      const existe = await urlExiste(sonda.url);
      if (!existe) {
        throw new Error(
          `O TSE ainda não publicou os zips do ${opcoes.turno}º turno de ${opcoes.ano} ` +
            `(conjunto "Arquivos transmitidos para totalização"). ` +
            `Quando o arquivo existir, rode de novo. Enquanto isso, use --zip com um arquivo local ` +
            `ou --turno 1 para o pacote já disponível.`,
        );
      }
    }
  }

  repositorio.limparVotos();
  const paralelo = limitarParalelo(opcoes.paralelo ?? 1);
  const gravar = criarTrava();
  let interromper = false;

  const registrarFalha = (uf: string, erro: unknown): void => {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    falhas.push({ uf, mensagem });
    repositorio.registrarProgresso({
      uf,
      status: "erro",
      arquivos: 0,
      erros: 1,
      votos: 0,
      detalhe: mensagem,
    });
    console.error(`${uf}: ${mensagem}`);
  };

  await executarEmParalelo(
    plano,
    paralelo,
    async (item) => {
      const destino = path.join(PASTA_DOWNLOADS, path.basename(item.url));
      try {
        console.log(`Baixando ${item.uf}…`);
        await baixarComRetomada(item.url, destino);
      } catch (erro) {
        await gravar(async () => registrarFalha(item.uf, erro));
        if (erro instanceof ErroDownload && erro.status === 404 && !item.publicada) {
          console.error("Interrompendo: o arquivo deste turno não está no CDN.");
          interromper = true;
        }
        return;
      }

      try {
        console.log(`Lendo logs de ${item.uf}…`);
        const resultado = await gravar(() => processarZipUf(repositorio, destino, item.uf));
        processadas.push(item.uf);
        console.log(`${item.uf}: ${resultado.votos} votos em ${resultado.arquivos} logs (${resultado.erros} erros).`);
      } catch (erro) {
        await gravar(async () => registrarFalha(item.uf, erro));
      }
    },
    () => interromper,
  );

  gravarMetaEtl(repositorio, opcoes, processadas, falhas);
  return { processadas, falhas };
}

async function urlExiste(url: string): Promise<boolean> {
  try {
    const resposta = await fetch(url, { method: "HEAD" });
    return resposta.ok;
  } catch {
    return false;
  }
}

function gravarMetaEtl(
  repositorio: Repositorio,
  opcoes: OpcoesEtl,
  processadas: string[],
  falhas: { uf: string; mensagem: string }[],
): void {
  repositorio.definirMeta("modo", "etl");
  repositorio.definirMeta("ano", String(opcoes.ano));
  repositorio.definirMeta("turno", String(opcoes.turno));
  repositorio.definirMeta("atualizado_em", new Date().toISOString());
  const aviso = falhas.length
    ? `ETL parcial. UFs lidas: ${processadas.join(", ") || "nenhuma"}. Falhas: ${falhas.map((f) => f.uf).join(", ")}.`
    : `Logs do ${opcoes.turno}º turno de ${opcoes.ano} agregados por horário de Brasília.`;
  repositorio.definirMeta("aviso", aviso);
}
