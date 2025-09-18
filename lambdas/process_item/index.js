// Simula um processamento rápido e idempotente.
// Apenas retorna metadados; o estado PersistDDB grava no DynamoDB.

exports.handler = async (event) => {
  // aqui você poderia chamar outro serviço, transformar dados, etc.
  const now = new Date().toISOString();

  return {
    ok: true,
    processedAt: now,
    echo: event, // útil para debug; remova se não quiser eco no contexto
  };
};
