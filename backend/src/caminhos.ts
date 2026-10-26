import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));

/** Raiz do pacote backend (onde ficam fixtures, dados e o SQLite). */
export const RAIZ_BACKEND = path.resolve(aqui, "..");

export const CAMINHO_BANCO = path.join(RAIZ_BACKEND, "data", "votos.sqlite");
export const PASTA_FIXTURES = path.join(RAIZ_BACKEND, "fixtures");
export const PASTA_DADOS = path.join(RAIZ_BACKEND, "dados");
export const ARQUIVO_RESULTADO = path.join(PASTA_DADOS, "resultado-oficial.json");
export const ARQUIVO_MUNICIPIOS = path.join(PASTA_DADOS, "municipios.csv");
export const PASTA_DOWNLOADS = path.join(RAIZ_BACKEND, "data", "downloads");
