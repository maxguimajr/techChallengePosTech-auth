import { Pool } from 'pg';
import { DatabaseConfig } from './config';

export interface Cliente {
  id: string;
  nome: string;
  documento: string;
  ativo: boolean;
}

export interface ClienteRepository {
  buscarPorCpf(cpf: string): Promise<Cliente | null>;
}

// Tabela "clientes" do schema Prisma da aplicacao (repo techChallengePosTech-Aplication).
// O to_jsonb faz a consulta funcionar antes e depois da migration que adiciona a coluna "ativo":
// enquanto ela nao existir, todo cliente e considerado ativo.
const SQL_BUSCAR_POR_CPF = `
  SELECT c.id,
         c.nome,
         c.documento,
         COALESCE((to_jsonb(c) ->> 'ativo')::boolean, true) AS ativo
    FROM clientes c
   WHERE c.documento = $1
     AND c."tipoDocumento" = 'CPF'
   LIMIT 1`;

export class PgClienteRepository implements ClienteRepository {
  constructor(private readonly pool: Pool) {}

  async buscarPorCpf(cpf: string): Promise<Cliente | null> {
    const resultado = await this.pool.query<Cliente>(SQL_BUSCAR_POR_CPF, [cpf]);
    return resultado.rows[0] ?? null;
  }
}

export function criarPool(config: DatabaseConfig): Pool {
  return new Pool({
    connectionString: config.connectionString,
    // RDS PostgreSQL exige SSL; o certificado da AWS nao vem no bundle da Lambda
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    max: 2,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });
}
