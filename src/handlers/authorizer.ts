import type { APIGatewayRequestAuthorizerEventV2 } from 'aws-lambda';
import { logger } from '../logger';
import { verificarToken } from '../token';

// Formato "simple response" do Lambda Authorizer do HTTP API (payload 2.0)
export interface AuthorizerResult {
  isAuthorized: boolean;
  context?: Record<string, string>;
}

export function criarAuthorizerHandler(secret: string) {
  return (
    event: APIGatewayRequestAuthorizerEventV2,
  ): Promise<AuthorizerResult> => {
    const header =
      event.headers?.authorization ?? event.identitySource?.[0] ?? '';
    const [tipo, token] = header.split(' ');

    if (tipo?.toLowerCase() !== 'bearer' || !token) {
      return Promise.resolve({ isAuthorized: false });
    }

    try {
      const payload = verificarToken(token, secret);
      return Promise.resolve({
        isAuthorized: true,
        context: {
          sub: String(payload.sub),
          papel: typeof payload.papel === 'string' ? payload.papel : '',
          cpf: typeof payload.cpf === 'string' ? payload.cpf : '',
        },
      });
    } catch (e) {
      logger.warn('Token rejeitado', {
        correlationId: event.requestContext.requestId,
        motivo: e instanceof Error ? e.message : String(e),
      });
      return Promise.resolve({ isAuthorized: false });
    }
  };
}

let handlerPadrao: ReturnType<typeof criarAuthorizerHandler> | undefined;

export const handler = (
  event: APIGatewayRequestAuthorizerEventV2,
): Promise<AuthorizerResult> => {
  const secret = process.env.JWT_SECRET;
  if (!secret)
    throw new Error('Variavel de ambiente JWT_SECRET nao configurada');
  handlerPadrao ??= criarAuthorizerHandler(secret);
  return handlerPadrao(event);
};
