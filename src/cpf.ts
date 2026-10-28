export function normalizarCpf(valor: unknown): string {
  if (typeof valor !== 'string' && typeof valor !== 'number') return '';
  return String(valor).replace(/\D/g, '');
}

export function validarCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf)) return false;
  // CPFs com todos os digitos iguais passam no calculo, mas sao invalidos
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digitos = cpf.split('').map(Number);
  const calcularDigito = (quantidade: number): number => {
    const soma = digitos
      .slice(0, quantidade)
      .reduce((acc, digito, i) => acc + digito * (quantidade + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return calcularDigito(9) === digitos[9] && calcularDigito(10) === digitos[10];
}

export function mascararCpf(cpf: string): string {
  return cpf.length === 11 ? `*******${cpf.slice(7)}` : '***';
}
