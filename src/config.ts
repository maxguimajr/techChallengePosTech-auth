export interface JwtConfig {
  secret: string;
  expiresInSeconds: number;
  issuer: string;
}

export interface DatabaseConfig {
  connectionString: string;
  ssl: boolean;
}

function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variavel de ambiente ${nome} nao configurada`);
  return valor;
}

export function carregarJwtConfig(): JwtConfig {
  return {
    secret: obrigatoria('JWT_SECRET'),
    expiresInSeconds: Number(process.env.JWT_EXPIRES_IN_SECONDS ?? 3600),
    issuer: process.env.JWT_ISSUER ?? 'oficina-auth-lambda',
  };
}

export function carregarDatabaseConfig(): DatabaseConfig {
  return {
    connectionString: obrigatoria('DATABASE_URL'),
    ssl: (process.env.DB_SSL ?? 'true') === 'true',
  };
}
