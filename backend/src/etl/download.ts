import fs from "node:fs";
import path from "node:path";

export class ErroDownload extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ErroDownload";
  }
}

/**
 * Baixa um arquivo grande com retomada. Se a transferência cair, o próximo
 * chamado continua do `.parcial` usando HTTP Range.
 */
export async function baixarComRetomada(url: string, destino: string): Promise<void> {
  if (fs.existsSync(destino) && fs.statSync(destino).size > 0) return;

  await fs.promises.mkdir(path.dirname(destino), { recursive: true });
  const parcial = `${destino}.parcial`;
  let jaBaixado = 0;
  if (fs.existsSync(parcial)) jaBaixado = fs.statSync(parcial).size;

  const headers: Record<string, string> = {};
  if (jaBaixado > 0) headers.Range = `bytes=${jaBaixado}-`;

  const resposta = await fetch(url, { headers });
  if (resposta.status === 404) throw new ErroDownload(`Arquivo não publicado: ${url}`, 404);
  if (!resposta.ok && resposta.status !== 206) {
    throw new ErroDownload(`Falha HTTP ${resposta.status} ao baixar ${url}`, resposta.status);
  }

  const recomeçar = jaBaixado > 0 && resposta.status !== 206;
  const arquivo = await fs.promises.open(parcial, recomeçar ? "w" : jaBaixado > 0 ? "a" : "w");
  try {
    if (!resposta.body) throw new ErroDownload(`Resposta vazia: ${url}`, resposta.status);
    const leitor = resposta.body.getReader();
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      if (value) await arquivo.write(value);
    }
  } finally {
    await arquivo.close();
  }

  await fs.promises.rename(parcial, destino);
}

/** Modelo de URL do CDN. O portal às vezes publica o 2º turno dias depois do pleito. */
export function urlZipUf(ano: number, turno: number, uf: string): string {
  return `https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes${ano}/arqurnatot/bu_imgbu_logjez_rdv_vscmr_${ano}_${turno}t_${uf}.zip`;
}

interface RecursoCkan {
  name?: string;
  url?: string;
}

/**
 * Lê o conjunto "Arquivos transmitidos para totalização" e devolve a URL de cada UF
 * do turno pedido. Se o CKAN ainda não listar o turno, o mapa volta vazio.
 */
export async function descobrirZips(ano: number, turno: number): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const id = `resultados-${ano}-arquivos-transmitidos-para-totalizacao`;
  const resposta = await fetch(`https://dadosabertos.tse.jus.br/api/3/action/package_show?id=${id}`);
  if (!resposta.ok) return mapa;

  const json = (await resposta.json()) as { result?: { resources?: RecursoCkan[] } };
  for (const recurso of json.result?.resources ?? []) {
    const url = recurso.url ?? "";
    const encontrado = url.toUpperCase().match(/_(\d)T_([A-Z]{2})\.ZIP/);
    if (!encontrado) continue;
    if (Number(encontrado[1]) !== turno) continue;
    mapa.set(encontrado[2], url);
  }
  return mapa;
}
