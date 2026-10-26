import { CAMINHO_BANCO } from "../caminhos.js";
import { abrirConexao } from "../db/conexao.js";
import { Repositorio } from "../db/repositorio.js";
import { listarUfs } from "../domain/ufs.js";
import { carregarAmostra } from "./amostra.js";
import { executarEtl, limitarParalelo } from "./etl.js";

/**
 * CLI do pipeline.
 *
 *   npm run seed                         amostra de demonstração
 *   npm run etl -- --turno 2 --ufs ALL   Brasil, turno pedido
 *   npm run etl -- --turno 2 --ufs AC,BA
 *   npm run etl -- --turno 2 --ufs ALL --paralelo 3
 *   npm run etl -- --zip ./arquivo.zip --uf AC
 */
async function main(): Promise<void> {
  const args = lerArgs(process.argv.slice(2));
  const repositorio = new Repositorio(abrirConexao(CAMINHO_BANCO));

  if (args.seed === true) {
    await carregarAmostra(repositorio);
    console.log("Amostra carregada em", CAMINHO_BANCO);
    return;
  }

  const turno = Number(args.turno ?? 2);
  const ano = Number(args.ano ?? 2026);
  if (!Number.isInteger(turno) || turno < 1) throw new Error("--turno inválido.");
  if (!Number.isInteger(ano)) throw new Error("--ano inválido.");

  const zip = typeof args.zip === "string" ? args.zip : undefined;
  const uf = typeof args.uf === "string" ? args.uf.toUpperCase() : undefined;
  const ufs = listarUfs(typeof args.ufs === "string" ? args.ufs : "ALL");
  const paralelo = args.paralelo == null ? 1 : limitarParalelo(typeof args.paralelo === "string" ? Number(args.paralelo) : Number.NaN);

  const resumo = await executarEtl(repositorio, { ano, turno, ufs, zip, uf, paralelo });
  console.log(`Concluído. UFs: ${resumo.processadas.join(", ") || "nenhuma"}. Falhas: ${resumo.falhas.length}.`);
  if (resumo.processadas.length === 0) process.exitCode = 1;
}

function lerArgs(argv: string[]): Record<string, string | boolean> {
  const saida: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const argumento = argv[i];
    if (!argumento.startsWith("--")) continue;
    const chave = argumento.slice(2);
    const proximo = argv[i + 1];
    if (proximo == null || proximo.startsWith("--")) saida[chave] = true;
    else {
      saida[chave] = proximo;
      i += 1;
    }
  }
  return saida;
}

main().catch((erro: unknown) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
});
