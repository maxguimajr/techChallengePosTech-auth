type Nivel = 'info' | 'warn' | 'error';

// Escreve direto no stdout para o CloudWatch receber JSON puro (sem o prefixo do console.log)
function escrever(
  nivel: Nivel,
  mensagem: string,
  campos: Record<string, unknown>,
) {
  process.stdout.write(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: nivel,
      service: process.env.SERVICE_NAME ?? 'oficina-auth-lambda',
      message: mensagem,
      ...campos,
    }) + '\n',
  );
}

export const logger = {
  info: (mensagem: string, campos: Record<string, unknown> = {}) =>
    escrever('info', mensagem, campos),
  warn: (mensagem: string, campos: Record<string, unknown> = {}) =>
    escrever('warn', mensagem, campos),
  error: (mensagem: string, campos: Record<string, unknown> = {}) =>
    escrever('error', mensagem, campos),
};
