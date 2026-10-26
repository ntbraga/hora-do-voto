import type { FastifyInstance } from "fastify";
import { normalizarUf } from "../domain/ufs.js";
import type { Filtro } from "../db/repositorio.js";
import type { VotosService } from "../services/votos.service.js";

/** Rotas HTTP. Validam a query e delegam ao serviço. */
export function registrarRotas(app: FastifyInstance, servico: VotosService): void {
  app.get("/api/health", async () => ({ ok: true }));

  app.get("/api/meta", async () => servico.meta());

  app.get<{ Querystring: { uf?: string } }>("/api/municipios", async (requisicao, resposta) => {
    const uf = normalizarUf(requisicao.query.uf);
    if (!uf) return resposta.code(400).send({ erro: "Informe uma UF válida." });
    return servico.municipios(uf);
  });

  app.get<{ Querystring: { uf?: string; municipio?: string } }>("/api/resumo", async (requisicao, resposta) => {
    const filtro = lerFiltro(requisicao.query);
    if (filtro === null) return resposta.code(400).send({ erro: "Filtro inválido." });
    return servico.resumo(filtro);
  });

  app.get<{ Querystring: { uf?: string; municipio?: string } }>("/api/hora-a-hora", async (requisicao, resposta) => {
    const filtro = lerFiltro(requisicao.query);
    if (filtro === null) return resposta.code(400).send({ erro: "Filtro inválido." });
    return { horas: servico.horaAHora(filtro) };
  });

  app.get<{ Querystring: { uf?: string } }>("/api/ranking", async (requisicao, resposta) => {
    const uf = requisicao.query.uf ? normalizarUf(requisicao.query.uf) : undefined;
    if (requisicao.query.uf && !uf) return resposta.code(400).send({ erro: "UF inválida." });
    return servico.ranking(uf);
  });

  app.get("/api/resultado-oficial", async (_requisicao, resposta) => {
    const oficial = servico.resultadoOficial();
    if (!oficial) return resposta.code(404).send({ erro: "Resultado oficial não configurado." });
    return oficial;
  });
}

function lerFiltro(query: { uf?: string; municipio?: string }): Filtro | null {
  const filtro: Filtro = {};
  if (query.uf) {
    const uf = normalizarUf(query.uf);
    if (!uf) return null;
    filtro.uf = uf;
  }
  if (query.municipio) {
    if (!/^\d+$/.test(query.municipio)) return null;
    filtro.municipio = Number(query.municipio);
  }
  return filtro;
}
