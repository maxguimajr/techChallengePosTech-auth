import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import jwt from 'jsonwebtoken';
import { Cliente, ClienteRepository } from '../cliente.repository';
import { criarAuthHandler } from '../handlers/auth';

const jwtConfig = {
  secret: 'segredo-teste',
  expiresInSeconds: 3600,
  issuer: 'oficina-auth-lambda',
};

function evento(
  body: unknown,
  headers: Record<string, string> = {},
): APIGatewayProxyEventV2 {
  return {
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers,
    isBase64Encoded: false,
    requestContext: { requestId: 'req-123' },
  } as unknown as APIGatewayProxyEventV2;
}

function criar(cliente: Cliente | null | Error) {
  const repository: jest.Mocked<ClienteRepository> = {
    buscarPorCpf: jest.fn((_cpf: string) =>
      cliente instanceof Error
        ? Promise.reject(cliente)
        : Promise.resolve(cliente),
    ),
  };
  return { repository, handler: criarAuthHandler({ repository, jwtConfig }) };
}

const clienteAtivo: Cliente = {
  id: 'c-1',
  nome: 'Joao',
  documento: '12345678909',
  ativo: true,
};

describe('auth handler', () => {
  beforeEach(() => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => jest.restoreAllMocks());

  it('retorna 200 com JWT para cliente ativo', async () => {
    const { handler, repository } = criar(clienteAtivo);

    const resposta = await handler(evento({ cpf: '123.456.789-09' }));

    expect(resposta.statusCode).toBe(200);
    expect(repository.buscarPorCpf).toHaveBeenCalledWith('12345678909');
    const corpo = JSON.parse(resposta.body!);
    expect(corpo).toMatchObject({ tokenType: 'Bearer', expiresIn: 3600 });
    expect(jwt.verify(corpo.accessToken, jwtConfig.secret)).toMatchObject({
      sub: 'c-1',
    });
  });

  it('propaga o x-correlation-id recebido', async () => {
    const { handler } = criar(clienteAtivo);
    const resposta = await handler(
      evento({ cpf: '12345678909' }, { 'x-correlation-id': 'abc' }),
    );
    expect(resposta.headers?.['x-correlation-id']).toBe('abc');
  });

  it('usa o requestId quando nao recebe correlation id', async () => {
    const { handler } = criar(clienteAtivo);
    const resposta = await handler(evento({ cpf: '12345678909' }));
    expect(resposta.headers?.['x-correlation-id']).toBe('req-123');
  });

  it('aceita corpo em base64', async () => {
    const { handler } = criar(clienteAtivo);
    const ev = evento(
      Buffer.from(JSON.stringify({ cpf: '12345678909' })).toString('base64'),
    );
    ev.isBase64Encoded = true;
    expect((await handler(ev)).statusCode).toBe(200);
  });

  it.each([
    ['CPF invalido', { cpf: '12345678900' }],
    ['sem CPF', {}],
    ['JSON malformado', '{cpf:'],
  ])('retorna 400 para %s sem consultar o banco', async (_caso, body) => {
    const { handler, repository } = criar(clienteAtivo);

    const resposta = await handler(evento(body));

    expect(resposta.statusCode).toBe(400);
    expect(JSON.parse(resposta.body!).erro).toBe('CPF_INVALIDO');
    expect(repository.buscarPorCpf).not.toHaveBeenCalled();
  });

  it('retorna 400 sem corpo', async () => {
    const { handler } = criar(clienteAtivo);
    const ev = evento('');
    ev.body = undefined;
    expect((await handler(ev)).statusCode).toBe(400);
  });

  it('retorna 401 para cliente nao cadastrado', async () => {
    const { handler } = criar(null);
    const resposta = await handler(evento({ cpf: '12345678909' }));
    expect(resposta.statusCode).toBe(401);
    expect(JSON.parse(resposta.body!).erro).toBe('CLIENTE_NAO_ENCONTRADO');
  });

  it('retorna 403 para cliente inativo', async () => {
    const { handler } = criar({ ...clienteAtivo, ativo: false });
    const resposta = await handler(evento({ cpf: '12345678909' }));
    expect(resposta.statusCode).toBe(403);
    expect(JSON.parse(resposta.body!).erro).toBe('CLIENTE_INATIVO');
  });

  it('retorna 500 quando o banco falha', async () => {
    const { handler } = criar(new Error('connection refused'));
    const resposta = await handler(evento({ cpf: '12345678909' }));
    expect(resposta.statusCode).toBe(500);
    expect(JSON.parse(resposta.body!).erro).toBe('ERRO_INTERNO');
  });

  it('nao escreve o CPF completo nos logs', async () => {
    const escrita = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    const { handler } = criar(null);

    await handler(evento({ cpf: '12345678909' }));

    const logs = escrita.mock.calls.map(([linha]) => String(linha)).join('');
    expect(logs).not.toContain('12345678909');
    expect(logs).toContain('*******8909');
  });
});
