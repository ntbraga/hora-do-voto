import { criarAplicacao } from "./aplicacao.js";

const porta = Number(process.env.PORT ?? 3333);
const { app } = await criarAplicacao();

await app.listen({ port: porta, host: "0.0.0.0" });
