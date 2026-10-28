import { Pool } from 'pg';
import { PgClienteRepository } from '../cliente.repository';

describe('PgClienteRepository', () => {
  function criar(rows: unknown[]) {
    const query = jest.fn().mockResolvedValue({ rows });
    const repository = new PgClienteRepository({ query } as unknown as Pool);
    return { query, repository };
  }

  it('busca cliente por CPF usando parametro (sem concatenar SQL)', async () => {
    const cliente = {
      id: 'c-1',
      nome: 'Joao',
      documento: '12345678909',
      ativo: true,
    };
    const { query, repository } = criar([cliente]);

    await expect(repository.buscarPorCpf('12345678909')).resolves.toEqual(
      cliente,
    );

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('FROM clientes');
    expect(sql).toContain('"tipoDocumento" = \'CPF\'');
    expect(params).toEqual(['12345678909']);
  });

  it('retorna null quando nao encontra', async () => {
    const { repository } = criar([]);
    await expect(repository.buscarPorCpf('12345678909')).resolves.toBeNull();
  });
});
