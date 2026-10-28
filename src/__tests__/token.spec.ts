import jwt from 'jsonwebtoken';
import { gerarToken, PAPEL_CLIENTE, verificarToken } from '../token';

const config = {
  secret: 'segredo-teste',
  expiresInSeconds: 600,
  issuer: 'oficina-auth-lambda',
};
const cliente = {
  id: 'cliente-1',
  nome: 'Joao',
  documento: '12345678909',
  ativo: true,
};

describe('token', () => {
  it('gera JWT HS256 com os claims do contrato', () => {
    const token = gerarToken(cliente, config);

    expect(token.tokenType).toBe('Bearer');
    expect(token.expiresIn).toBe(600);

    const decodificado = jwt.decode(token.accessToken, { complete: true });
    expect(decodificado?.header.alg).toBe('HS256');
    expect(decodificado?.payload).toMatchObject({
      sub: 'cliente-1',
      cpf: '12345678909',
      nome: 'Joao',
      papel: PAPEL_CLIENTE,
      iss: 'oficina-auth-lambda',
    });
  });

  it('verifica token gerado', () => {
    const { accessToken } = gerarToken(cliente, config);
    expect(verificarToken(accessToken, config.secret).sub).toBe('cliente-1');
  });

  it('aceita token de staff emitido pela aplicacao', () => {
    const tokenStaff = jwt.sign(
      { sub: 'user-1', email: 'a@b.com', papel: 'ADMIN' },
      config.secret,
    );
    expect(verificarToken(tokenStaff, config.secret).papel).toBe('ADMIN');
  });

  it('rejeita token assinado com outro segredo', () => {
    const { accessToken } = gerarToken(cliente, { ...config, secret: 'outro' });
    expect(() => verificarToken(accessToken, config.secret)).toThrow();
  });

  it('rejeita token expirado', () => {
    const expirado = jwt.sign(
      { sub: 'x', exp: Math.floor(Date.now() / 1000) - 10 },
      config.secret,
    );
    expect(() => verificarToken(expirado, config.secret)).toThrow(
      'jwt expired',
    );
  });

  it('rejeita algoritmo none', () => {
    const semAssinatura = jwt.sign({ sub: 'x' }, '', { algorithm: 'none' });
    expect(() => verificarToken(semAssinatura, config.secret)).toThrow();
  });

  it('rejeita token sem sub', () => {
    const semSub = jwt.sign({ papel: 'CLIENTE' }, config.secret);
    expect(() => verificarToken(semSub, config.secret)).toThrow(
      'Payload do token invalido',
    );
  });
});
