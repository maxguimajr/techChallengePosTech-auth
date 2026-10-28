import { carregarDatabaseConfig, carregarJwtConfig } from '../config';

describe('config', () => {
  const ambienteOriginal = process.env;

  beforeEach(() => {
    process.env = { ...ambienteOriginal };
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRES_IN_SECONDS;
    delete process.env.JWT_ISSUER;
    delete process.env.DATABASE_URL;
    delete process.env.DB_SSL;
  });

  afterAll(() => {
    process.env = ambienteOriginal;
  });

  it('usa valores padrao do JWT', () => {
    process.env.JWT_SECRET = 's';
    expect(carregarJwtConfig()).toEqual({
      secret: 's',
      expiresInSeconds: 3600,
      issuer: 'oficina-auth-lambda',
    });
  });

  it('falha sem JWT_SECRET', () => {
    expect(() => carregarJwtConfig()).toThrow('JWT_SECRET');
  });

  it('liga SSL por padrao e permite desligar', () => {
    process.env.DATABASE_URL = 'postgresql://x';
    expect(carregarDatabaseConfig().ssl).toBe(true);
    process.env.DB_SSL = 'false';
    expect(carregarDatabaseConfig().ssl).toBe(false);
  });

  it('falha sem DATABASE_URL', () => {
    expect(() => carregarDatabaseConfig()).toThrow('DATABASE_URL');
  });
});
