import jwt, { JwtPayload } from 'jsonwebtoken';
import { JwtConfig } from './config';
import { Cliente } from './cliente.repository';

export const PAPEL_CLIENTE = 'CLIENTE';

export interface TokenGerado {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export function gerarToken(cliente: Cliente, config: JwtConfig): TokenGerado {
  const accessToken = jwt.sign(
    { cpf: cliente.documento, nome: cliente.nome, papel: PAPEL_CLIENTE },
    config.secret,
    {
      algorithm: 'HS256',
      subject: cliente.id,
      issuer: config.issuer,
      expiresIn: config.expiresInSeconds,
    },
  );
  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: config.expiresInSeconds,
  };
}

// Aceita tambem tokens de staff emitidos pela aplicacao (mesmo segredo, sem issuer da Lambda)
export function verificarToken(token: string, secret: string): JwtPayload {
  const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
  if (typeof payload === 'string' || !payload.sub) {
    throw new Error('Payload do token invalido');
  }
  return payload;
}
