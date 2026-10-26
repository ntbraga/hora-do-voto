import { identificarPeloNome, type ChaveSecao } from "./secao.js";

/** Mensagem gravada pela urna no instante em que o voto entra na urna. */
export const MSG_VOTO = "O voto do eleitor foi computado";

/** A urna passou a aceitar o próximo eleitor. Serve para estimar o fuso. */
const MSG_PRONTA = [
  "Aguardando digitação do título",
  "Aguardando digitação do identificador do eleitor",
];

export interface IdentificacaoLog {
  cdMunicipio?: number;
  zona?: number;
  secao?: number;
}

export interface EventosLog {
  /** Segundos desde a meia-noite local, na ordem do arquivo, só no dia da eleição. */
  votosSegundos: number[];
  /** Primeira vez que a urna ficou pronta para o eleitor, no dia da eleição. */
  aberturaSegundos: number | null;
  dia: string | null;
  ident: IdentificacaoLog;
}

export interface LogLido {
  secao: ChaveSecao;
  eventos: EventosLog;
}

/**
 * Lê o `logd.dat` da urna (texto latin-1, uma linha por evento, campos separados por TAB).
 *
 * Formato documentado pelo TSE:
 * `[data hora] [severidade] [id da urna] [aplicativo] [mensagem] [hash]`
 * Só entram eventos do aplicativo VOTA no dia em que houve mais votos.
 */
export function lerEventos(texto: string): EventosLog {
  const linhas: { dia: string; hora: string; app: string; msg: string }[] = [];
  const votosPorDia = new Map<string, number>();
  const ident: IdentificacaoLog = {};

  for (const bruta of texto.split(/\r?\n/)) {
    if (!bruta.trim()) continue;
    const partes = bruta.split("\t");
    if (partes.length < 5) continue;

    const quando = lerDataHora(partes[0] ?? "");
    if (!quando) continue;
    const app = partes[3] ?? "";
    const msg = partes[4] ?? "";

    if (app === "GAP") preencherIdentificacao(ident, msg);
    if (app !== "VOTA") continue;

    linhas.push({ ...quando, app, msg });
    if (msg.includes(MSG_VOTO)) {
      votosPorDia.set(quando.dia, (votosPorDia.get(quando.dia) ?? 0) + 1);
    }
  }

  const diaEleicao = diaComMaisVotos(votosPorDia);
  const votosSegundos: number[] = [];
  let aberturaSegundos: number | null = null;

  for (const linha of linhas) {
    if (linha.dia !== diaEleicao) continue;
    const segundos = horaParaSegundos(linha.hora);
    if (segundos == null) continue;
    if (aberturaSegundos == null && segundos >= 5 * 3600 && MSG_PRONTA.some((trecho) => linha.msg.includes(trecho))) {
      aberturaSegundos = segundos;
    }
    if (linha.msg.includes(MSG_VOTO)) votosSegundos.push(segundos);
  }

  return { votosSegundos, aberturaSegundos, dia: diaEleicao, ident };
}

/** Resolve município, zona e seção pelo nome do arquivo ou, na falta dele, pelo log GAP. */
export function resolverSecao(nomeArquivo: string, ident: IdentificacaoLog): ChaveSecao | null {
  const peloNome = identificarPeloNome(nomeArquivo);
  if (peloNome) return peloNome;
  if (ident.cdMunicipio != null && ident.zona != null && ident.secao != null) {
    return { cdMunicipio: ident.cdMunicipio, zona: ident.zona, secao: ident.secao };
  }
  return null;
}

function lerDataHora(campo: string): { dia: string; hora: string } | null {
  const encontrado = campo.trim().match(/^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})/);
  if (!encontrado) return null;
  return { dia: encontrado[1], hora: encontrado[2] };
}

function horaParaSegundos(hora: string): number | null {
  const partes = hora.split(":");
  if (partes.length !== 3) return null;
  const [h, m, s] = partes.map((n) => Number(n));
  if ([h, m, s].some((n) => Number.isNaN(n))) return null;
  return h * 3600 + m * 60 + s;
}

function diaComMaisVotos(contagem: Map<string, number>): string | null {
  let melhor: string | null = null;
  let quantidade = -1;
  for (const [dia, votos] of contagem) {
    if (votos > quantidade) {
      melhor = dia;
      quantidade = votos;
    }
  }
  return melhor;
}

function preencherIdentificacao(ident: IdentificacaoLog, msg: string): void {
  if (ident.cdMunicipio == null) {
    const municipio = msg.match(/^Munic[ií]pio:\s*(\d+)/i);
    if (municipio) ident.cdMunicipio = Number(municipio[1]);
  }
  if (ident.zona == null) {
    const zona = msg.match(/^Zona Eleitoral:\s*(\d+)/i);
    if (zona) ident.zona = Number(zona[1]);
  }
  if (ident.secao == null) {
    const secao = msg.match(/^Se[cç][aã]o Eleitoral:\s*(\d+)/i);
    if (secao) ident.secao = Number(secao[1]);
  }
}
