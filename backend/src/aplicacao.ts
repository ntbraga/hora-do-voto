import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { CAMINHO_BANCO } from "./caminhos.js";
import { abrirConexao } from "./db/conexao.js";
import { Repositorio } from "./db/repositorio.js";
import { carregarAmostra } from "./etl/amostra.js";
import { registrarRotas } from "./routes/api.js";
import { VotosService } from "./services/votos.service.js";

export interface Aplicacao {
  app: FastifyInstance;
  repositorio: Repositorio;
}

/** Monta a API. Se o banco ainda não tem votos, carrega a amostra de demonstração. */
export async function criarAplicacao(caminhoBanco = CAMINHO_BANCO, semear = true): Promise<Aplicacao> {
  const repositorio = new Repositorio(abrirConexao(caminhoBanco));
  if (semear && repositorio.ufsComVoto().length === 0) {
    await carregarAmostra(repositorio);
  }

  const app = Fastify({ logger: caminhoBanco !== ":memory:" });
  await app.register(cors, { origin: true });
  registrarRotas(app, new VotosService(repositorio));
  return { app, repositorio };
}
