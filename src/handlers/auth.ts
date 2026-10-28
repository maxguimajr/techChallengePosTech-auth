import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import {
  carregarDatabaseConfig,
  carregarJwtConfig,
  JwtConfig,
} from '../config';
import {
  ClienteRepository,
  criarPool,
  PgClienteRepository,
} from '../cliente.repository';
import { mascararCpf, normalizarCpf, validarCpf } from '../cpf';
import { logger } from '../logger';
import { gerarToken } from '../token';

export interface AuthDeps {
  repository: ClienteRepository;
  jwtConfig: JwtConfig;
}

type Resposta = APIGatewayProxyStructuredResultV2;

function responder(
  statusCode: number,
  corpo: unknown,
  correlationId: string,
): Resposta {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'x-correlation-id': correlationId,
    },
    body: JSON.stringify(corpo),
  };
}

function erro(
  statusCode: number,
  codigo: string,
  mensagem: string,
  correlationId: string,
): Resposta {
  return responder(statusCode, { erro: codigo, mensagem }, correlationId);
}

function lerCorpo(
  event: APIGatewayProxyEventV2,
): Record<string, unknown> | null {
  if (!event.body) return null;
  const texto = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  try {
    const corpo: unknown = JSON.parse(texto);
    return corpo && typeof corpo === 'object'
      ? (corpo as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function criarAuthHandler(deps: AuthDeps) {
  return async (event: APIGatewayProxyEventV2): Promise<Resposta> => {
    const correlationId =
      event.headers?.['x-correlation-id'] ?? event.requestContext.requestId;
    const inicio = Date.now();

    const corpo = lerCorpo(event);
    const cpf = normalizarCpf(corpo?.cpf);

    if (!validarCpf(cpf)) {
      logger.warn('CPF invalido', { correlationId });
      return erro(400, 'CPF_INVALIDO', 'Informe um CPF valido', correlationId);
    }

    try {
      const cliente = await deps.repository.buscarPorCpf(cpf);
      const cpfMascarado = mascararCpf(cpf);

      if (!cliente) {
        logger.warn('Cliente nao encontrado', {
          correlationId,
          cpf: cpfMascarado,
        });
        return erro(
          401,
          'CLIENTE_NAO_ENCONTRADO',
          'Cliente nao cadastrado',
          correlationId,
        );
      }

      if (!cliente.ativo) {
        logger.warn('Cliente inativo', {
          correlationId,
          clienteId: cliente.id,
        });
        return erro(403, 'CLIENTE_INATIVO', 'Cliente inativo', correlationId);
      }

      const token = gerarToken(cliente, deps.jwtConfig);
      logger.info('Token emitido', {
        correlationId,
        clienteId: cliente.id,
        duracaoMs: Date.now() - inicio,
      });
      return responder(200, token, correlationId);
    } catch (e) {
      logger.error('Falha ao autenticar cliente', {
        correlationId,
        erro: e instanceof Error ? e.message : String(e),
      });
      return erro(500, 'ERRO_INTERNO', 'Erro ao autenticar', correlationId);
    }
  };
}

let handlerPadrao: ReturnType<typeof criarAuthHandler> | undefined;

// O pool fica fora da invocacao para ser reaproveitado entre execucoes "quentes" da Lambda
export const handler = (event: APIGatewayProxyEventV2): Promise<Resposta> => {
  handlerPadrao ??= criarAuthHandler({
    repository: new PgClienteRepository(criarPool(carregarDatabaseConfig())),
    jwtConfig: carregarJwtConfig(),
  });
  return handlerPadrao(event);
};
