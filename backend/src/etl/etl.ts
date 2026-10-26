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
  /** 1º turno, 2º turno ou os dois. */
  turnos: number[];
  ufs: string[];
  /** Zip já baixado. Exige `uf` e um único turno. */
  zip?: string;
  uf?: string;
  /** Downloads simultâneos. Padrão 1. Acima do teto, o ETL usa o teto. */
  paralelo?: number;
}

export interface LeituraEtl {
  turno: number;
  uf: string;
}

/** Sem `--turno`, baixa os dois. Com a flag, só 1 ou 2. */
export function resolverTurnos(valor: number | undefined): number[] {
  if (valor == null) return [1, 2];
  if (!Number.isInteger(valor) || valor < 1 || valor > 2) throw new Error("--turno inválido.");
  return [valor];
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
  processadas: LeituraEtl[];
  falhas: (LeituraEtl & { mensagem: string })[];
}

/**
 * Baixa (ou abre) os zips de log de cada UF e grava a agregação hora a hora.
 * Apaga a amostra antes, para não misturar demonstração com dado do TSE.
 * Se nenhum turno estiver publicado, não apaga nada.
 * Várias UFs baixam ao mesmo tempo; a gravação no banco é uma por vez.
 */
export async function executarEtl(repositorio: Repositorio, opcoes: OpcoesEtl): Promise<ResumoEtl> {
  await garantirMunicipios(repositorio);
  const falhas: (LeituraEtl & { mensagem: string })[] = [];
  const processadas: LeituraEtl[] = [];

  if (opcoes.zip) {
    if (!opcoes.uf) throw new Error("Informe --uf junto com --zip.");
    if (opcoes.turnos.length !== 1) throw new Error("Informe --turno junto com --zip.");
    const turno = opcoes.turnos[0] ?? 1;
    repositorio.limparVotos();
    await processarZipUf(repositorio, opcoes.zip, turno, opcoes.uf);
    processadas.push({ turno, uf: opcoes.uf });
    gravarMetaEtl(repositorio, opcoes, processadas, falhas);
    return { processadas, falhas };
  }

  const plano: { turno: number; uf: string; url: string; publicada: boolean }[] = [];
  for (const turno of opcoes.turnos) {
    const publicadas = await descobrirZips(opcoes.ano, turno).catch(() => new Map<string, string>());
    const itens = opcoes.ufs.map((uf) => ({
      turno,
      uf,
      url: publicadas.get(uf) ?? urlZipUf(opcoes.ano, turno, uf),
      publicada: publicadas.has(uf),
    }));
    if (publicadas.size === 0) {
      const sonda = itens[0];
      const existe = sonda ? await urlExiste(sonda.url) : false;
      if (!existe) {
        console.error(`O ${turno}º turno de ${opcoes.ano} ainda não foi publicado. Seguindo sem ele.`);
        continue;
      }
    }
    plano.push(...itens);
  }

  if (plano.length === 0) {
    throw new Error(
      `O TSE ainda não publicou os zips de ${opcoes.ano} ` +
        `(conjunto "Arquivos transmitidos para totalização"). ` +
        `Quando o arquivo existir, rode de novo. Enquanto isso, use --zip com um arquivo local.`,
    );
  }

  repositorio.limparVotos();
  const paralelo = limitarParalelo(opcoes.paralelo ?? 1);
  const gravar = criarTrava();
  const interrompidos = new Set<number>();

  const registrarFalha = (turno: number, uf: string, erro: unknown): void => {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    falhas.push({ turno, uf, mensagem });
    repositorio.registrarProgresso({
      turno,
      uf,
      status: "erro",
      arquivos: 0,
      erros: 1,
      votos: 0,
      detalhe: mensagem,
    });
    console.error(`${turno}º turno ${uf}: ${mensagem}`);
  };

  await executarEmParalelo(plano, paralelo, async (item) => {
    if (interrompidos.has(item.turno)) return;
    const destino = path.join(PASTA_DOWNLOADS, path.basename(item.url));
    try {
      console.log(`Baixando ${item.turno}º turno ${item.uf}…`);
      await baixarComRetomada(item.url, destino);
    } catch (erro) {
      await gravar(async () => registrarFalha(item.turno, item.uf, erro));
      if (erro instanceof ErroDownload && erro.status === 404 && !item.publicada) {
        console.error(`Interrompendo o ${item.turno}º turno: o arquivo não está no CDN.`);
        interrompidos.add(item.turno);
      }
      return;
    }

    try {
      console.log(`Lendo logs do ${item.turno}º turno ${item.uf}…`);
      const resultado = await gravar(() => processarZipUf(repositorio, destino, item.turno, item.uf));
      processadas.push({ turno: item.turno, uf: item.uf });
      console.log(
        `${item.turno}º turno ${item.uf}: ${resultado.votos} votos em ${resultado.arquivos} logs (${resultado.erros} erros).`,
      );
    } catch (erro) {
      await gravar(async () => registrarFalha(item.turno, item.uf, erro));
    }
  });

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
  processadas: LeituraEtl[],
  falhas: (LeituraEtl & { mensagem: string })[],
): void {
  const turnos = [...new Set(processadas.map((item) => item.turno))].sort((a, b) => a - b);
  const rotulo = (item: LeituraEtl) => `${item.turno}º ${item.uf}`;
  repositorio.definirMeta("modo", "etl");
  repositorio.definirMeta("ano", String(opcoes.ano));
  repositorio.definirMeta("turnos", turnos.join(","));
  repositorio.definirMeta("atualizado_em", new Date().toISOString());
  const aviso = falhas.length
    ? `ETL parcial. Leituras: ${processadas.map(rotulo).join(", ") || "nenhuma"}. Falhas: ${falhas.map(rotulo).join(", ")}.`
    : `Logs de ${opcoes.ano} (${turnos.map((turno) => `${turno}º`).join(" e ") || "nenhum turno"}) agregados por horário de Brasília.`;
  repositorio.definirMeta("aviso", aviso);
}
