import { mascararCpf, normalizarCpf, validarCpf } from '../cpf';

describe('cpf', () => {
  describe('normalizarCpf', () => {
    it('remove pontuacao', () => {
      expect(normalizarCpf('123.456.789-09')).toBe('12345678909');
    });

    it('aceita numero', () => {
      expect(normalizarCpf(12345678909)).toBe('12345678909');
    });

    it.each([undefined, null, {}, []])('retorna vazio para %p', (valor) => {
      expect(normalizarCpf(valor)).toBe('');
    });
  });

  describe('validarCpf', () => {
    it.each(['12345678909', '52998224725', '11144477735'])(
      'aceita CPF valido %s',
      (cpf) => {
        expect(validarCpf(cpf)).toBe(true);
      },
    );

    it.each([
      ['digito verificador errado', '12345678900'],
      ['todos os digitos iguais', '11111111111'],
      ['menos de 11 digitos', '1234567890'],
      ['mais de 11 digitos', '123456789091'],
      ['com letras', '1234567890a'],
      ['vazio', ''],
    ])('rejeita CPF com %s', (_motivo, cpf) => {
      expect(validarCpf(cpf)).toBe(false);
    });
  });

  describe('mascararCpf', () => {
    it('mostra apenas os 4 ultimos digitos', () => {
      expect(mascararCpf('12345678909')).toBe('*******8909');
    });

    it('nao expoe valor com tamanho inesperado', () => {
      expect(mascararCpf('123')).toBe('***');
    });
  });
});
