import assert from "node:assert/strict";
import test from "node:test";
import { criarAplicacao } from "../src/aplicacao.js";

test("API da amostra: resumo nacional, filtro e ranking", async () => {
  const { app } = await criarAplicacao(":memory:");
  try {
    const resumo = await app.inject({ method: "GET", url: "/api/resumo" });
    assert.equal(resumo.statusCode, 200);
    const corpo = resumo.json();
    assert.equal(corpo.votosTotal, 30);
    assert.equal(corpo.votosApos17, 13);
    assert.equal(corpo.votos17a18, 5);
    assert.equal(corpo.votos18a19, 6);
    assert.equal(corpo.votosApos19, 2);
    assert.equal(corpo.secoes, 6);
    assert.equal(corpo.secoesComVotoTardio, 5);

    const acre = await app.inject({ method: "GET", url: "/api/resumo?uf=AC" });
    assert.equal(acre.json().votosApos17, 3);

    const horas = await app.inject({ method: "GET", url: "/api/hora-a-hora?uf=DF" });
    const serie = horas.json().horas as { hora: number; votos: number }[];
    assert.equal(serie.length, 24);
    assert.equal(serie[17].votos, 0);
    assert.equal(serie.reduce((soma, item) => soma + item.votos, 0), 3);

    const ranking = await app.inject({ method: "GET", url: "/api/ranking?uf=SP" });
    const linhas = ranking.json().linhas as { nome: string; votosApos17: number }[];
    assert.equal(ranking.json().nivel, "municipio");
    assert.deepEqual(
      linhas.map((linha) => linha.nome),
      ["São Paulo", "Campinas"],
    );
    assert.equal(linhas[0].votosApos17, 4);

    const meta = await app.inject({ method: "GET", url: "/api/meta" });
    assert.equal(meta.json().modo, "fixture");
    assert.equal(meta.json().turno, 2);

    const invalido = await app.inject({ method: "GET", url: "/api/resumo?uf=XX" });
    assert.equal(invalido.statusCode, 400);
  } finally {
    await app.close();
  }
});
