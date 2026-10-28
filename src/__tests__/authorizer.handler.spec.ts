import type { APIGatewayRequestAuthorizerEventV2 } from 'aws-lambda';
import jwt from 'jsonwebtoken';
import { criarAuthorizerHandler } from '../handlers/authorizer';

const secret = 'segredo-teste';
const handler = criarAuthorizerHandler(secret);

function evento(authorization?: string): APIGatewayRequestAuthorizerEventV2 {
  return {
    headers: authorization ? { authorization } : {},
    identitySource: authorization ? [authorization] : [],
    requestContext: { requestId: 'req-1' },
  } as unknown as APIGatewayRequestAuthorizerEventV2;
}

describe('authorizer handler', () => {
  beforeEach(() => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => jest.restoreAllMocks());

  it('autoriza token de cliente e repassa o contexto', async () => {
    const token = jwt.sign({ cpf: '12345678909', papel: 'CLIENTE' }, secret, {
      subject: 'c-1',
    });

    const resultado = await handler(evento(`Bearer ${token}`));

    expect(resultado).toEqual({
      isAuthorized: true,
      context: { sub: 'c-1', papel: 'CLIENTE', cpf: '12345678909' },
    });
  });

  it('autoriza token de staff sem cpf', async () => {
    const token = jwt.sign(
      { sub: 'u-1', email: 'a@b.com', papel: 'ADMIN' },
      secret,
    );
    const resultado = await handler(evento(`Bearer ${token}`));
    expect(resultado.isAuthorized).toBe(true);
    expect(resultado.context?.cpf).toBe('');
  });

  it.each([
    ['sem header', undefined],
    ['esquema diferente de Bearer', 'Basic abc'],
    ['Bearer sem token', 'Bearer'],
    ['token malformado', 'Bearer abc.def.ghi'],
  ])('nega acesso %s', async (_caso, header) => {
    expect(await handler(evento(header))).toEqual({ isAuthorized: false });
  });

  it('nega token assinado com outro segredo', async () => {
    const token = jwt.sign({ sub: 'c-1' }, 'outro-segredo');
    expect((await handler(evento(`Bearer ${token}`))).isAuthorized).toBe(false);
  });

  it('nega token expirado', async () => {
    const token = jwt.sign(
      { sub: 'c-1', exp: Math.floor(Date.now() / 1000) - 1 },
      secret,
    );
    expect((await handler(evento(`Bearer ${token}`))).isAuthorized).toBe(false);
  });
});
