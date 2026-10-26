import assert from "node:assert/strict";
import test from "node:test";
import { criarTrava, executarEmParalelo, limitarParalelo, TETO_PARALELO } from "../src/etl/etl.js";

test("limita o paralelo entre 1 e 4", () => {
  assert.equal(limitarParalelo(1), 1);
  assert.equal(limitarParalelo(TETO_PARALELO), TETO_PARALELO);

  const original = console.warn;
  const avisos: unknown[][] = [];
  console.warn = (...args: unknown[]) => {
    avisos.push(args);
  };
  try {
    assert.equal(limitarParalelo(8), TETO_PARALELO);
  } finally {
    console.warn = original;
  }
  assert.equal(avisos.length, 1);
  assert.match(String(avisos[0]?.[0]), /teto de 4/);

  assert.throws(() => limitarParalelo(0), /--paralelo inválido/);
  assert.throws(() => limitarParalelo(-2), /--paralelo inválido/);
  assert.throws(() => limitarParalelo(1.5), /--paralelo inválido/);
  assert.throws(() => limitarParalelo(Number.NaN), /--paralelo inválido/);
});

test("pool mantém no máximo o limite de tarefas ativas", async () => {
  let ativas = 0;
  let pico = 0;
  let esperando = 0;
  let liberar: () => void = () => {};
  const podeSeguir = new Promise<void>((resolve) => {
    liberar = resolve;
  });

  await executarEmParalelo([1, 2, 3, 4], 2, async () => {
    ativas += 1;
    pico = Math.max(pico, ativas);
    esperando += 1;
    if (esperando === 2) liberar();
    await podeSeguir;
    ativas -= 1;
  });

  assert.equal(pico, 2);
});

test("trava não deixa duas gravações ao mesmo tempo", async () => {
  const trava = criarTrava();
  let dentro = 0;
  let pico = 0;

  await Promise.all(
    [1, 2, 3].map(() =>
      trava(async () => {
        dentro += 1;
        pico = Math.max(pico, dentro);
        await new Promise((resolve) => setTimeout(resolve, 20));
        assert.equal(dentro, 1);
        dentro -= 1;
      }),
    ),
  );

  assert.equal(pico, 1);
});

test("parada não pega UF nova e deixa terminar a que já começou", async () => {
  let parar = false;
  const vistos: number[] = [];

  await executarEmParalelo(
    [1, 2, 3, 4],
    2,
    async (item) => {
      vistos.push(item);
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (item === 1) parar = true;
    },
    () => parar,
  );

  assert.deepEqual(vistos, [1, 2]);
});
