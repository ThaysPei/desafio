/**
 * Regra de negócio pura para cálculo de capital segurado e prêmio
 * de seguro de vida coletivo. Sem I/O, sem dependência de banco,
 * arquivo ou rede — só matemática e validação de domínio.
 */

// ---------- Tipos do domínio ----------

export type CapitalType = "uniform" | "multiple-of-income";

export interface Pricing {
  individual_insured_value?: number;
  premium_base_rate?: number;
  multiple_of_income_min_value?: number;
  multiple_of_income_max_value?: number;
  multiple_of_income_multiplier_factor?: number;
}

export interface Beneficiary {
  name: string;
  cpf: string;
  birth_date: string;
  monthly_salary?: number;
}

export interface Contract {
  contract_id: string;
  carrier: string;
  benefit_type: string;
  capital_type: CapitalType;
  pricing: Pricing;
  beneficiaries: Beneficiary[];
}

// Taxa funerária fixa, por vida, para todas as apólices.
// Ver especificação, seção "Dúvida registrada": não há, nos dados
// observados, contratos com modalidade "separada" que exijam um
// valor diferente por contrato.
const TAXA_FUNERARIA_FIXA = 0.32;

// ---------- Erros explícitos do domínio ----------

export type DomainError =
  | { type: "CAMPO_OBRIGATORIO_AUSENTE"; campo: string }
  | { type: "VALOR_INVALIDO"; campo: string; valor: unknown; motivo: string }
  | { type: "CONFIGURACAO_INVALIDA"; motivo: string }
  | { type: "DADO_BENEFICIARIO_AUSENTE"; campo: string };
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: DomainError };

const erro = (error: DomainError): Result<never> => ({ ok: false, error });
const ok = <T>(value: T): Result<T> => ({ ok: true, value });

// ---------- Validações auxiliares ----------

function numeroPositivo(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor) && valor > 0;
}

// ---------- Cálculo do capital segurado ----------

function calcularCapitalUniforme(pricing: Pricing): Result<number> {
  const valor = pricing.individual_insured_value;
  if (valor === undefined || valor === null) {
    return erro({
      type: "CAMPO_OBRIGATORIO_AUSENTE",
      campo: "individual_insured_value",
    });
  }
  if (!numeroPositivo(valor)) {
    return erro({
      type: "VALOR_INVALIDO",
      campo: "individual_insured_value",
      valor,
      motivo: "deve ser um número positivo",
    });
  }
  return ok(valor);
}

function validarCamposMultiploSalarial(
  pricing: Pricing,
): Result<{ min: number; max: number; fator: number }> {
  const {
    multiple_of_income_min_value: min,
    multiple_of_income_max_value: max,
    multiple_of_income_multiplier_factor: fator,
  } = pricing;

  for (const [campo, valor] of [
    ["multiple_of_income_min_value", min],
    ["multiple_of_income_max_value", max],
    ["multiple_of_income_multiplier_factor", fator],
  ] as const) {
    if (valor === undefined || valor === null) {
      return erro({ type: "CAMPO_OBRIGATORIO_AUSENTE", campo });
    }
  }
  if (!numeroPositivo(fator!)) {
    return erro({
      type: "VALOR_INVALIDO",
      campo: "multiple_of_income_multiplier_factor",
      valor: fator,
      motivo: "deve ser um número positivo",
    });
  }
  if (!numeroPositivo(min!) || !numeroPositivo(max!)) {
    return erro({
      type: "VALOR_INVALIDO",
      campo: "multiple_of_income_min_value/max_value",
      valor: { min, max },
      motivo: "min e max devem ser números positivos",
    });
  }
  if (min! > max!) {
    return erro({
      type: "CONFIGURACAO_INVALIDA",
      motivo: `min (${min}) não pode ser maior que max (${max})`,
    });
  }
  return ok({ min: min!, max: max!, fator: fator! });
}

function validarSalarioBeneficiario(beneficiary: Beneficiary): Result<number> {
  const salario = beneficiary.monthly_salary;
  if (salario === undefined || salario === null) {
    return erro({
      type: "DADO_BENEFICIARIO_AUSENTE",
      campo: "monthly_salary",
    });
  }
  if (!numeroPositivo(salario)) {
    return erro({
      type: "VALOR_INVALIDO",
      campo: "monthly_salary",
      valor: salario,
      motivo: "deve ser um número positivo",
    });
  }
  return ok(salario);
}

function calcularCapitalMultiploSalarial(
  pricing: Pricing,
  beneficiary: Beneficiary,
): Result<number> {
  const camposResult = validarCamposMultiploSalarial(pricing);
  if (!camposResult.ok) return camposResult;

  const salarioResult = validarSalarioBeneficiario(beneficiary);
  if (!salarioResult.ok) return salarioResult;

  const { min, max, fator } = camposResult.value;
  const valorBase = salarioResult.value * fator;
  const capital = Math.min(Math.max(valorBase, min), max);
  return ok(capital);
}

export function calcularCapitalSegurado(
  contract: Contract,
  beneficiary: Beneficiary,
): Result<number> {
  const { pricing, capital_type } = contract;

  if (capital_type === "uniform") {
    return calcularCapitalUniforme(pricing);
  }
  if (capital_type === "multiple-of-income") {
    return calcularCapitalMultiploSalarial(pricing, beneficiary);
  }
  return erro({
    type: "VALOR_INVALIDO",
    campo: "capital_type",
    valor: capital_type,
    motivo: "tipo de capital desconhecido",
  });
}

// ---------- Cálculo do prêmio ----------

export interface Premio {
  capitalSegurado: number;
  premioBase: number;
  premioFinal: number;
}

export function calcularPremio(
  contract: Contract,
  beneficiary: Beneficiary,
): Result<Premio> {
  const capitalResult = calcularCapitalSegurado(contract, beneficiary);
  if (!capitalResult.ok) return capitalResult;

  const taxa = contract.pricing.premium_base_rate;
  if (taxa === undefined || taxa === null) {
    return erro({
      type: "CAMPO_OBRIGATORIO_AUSENTE",
      campo: "premium_base_rate",
    });
  }
  if (!numeroPositivo(taxa)) {
    return erro({
      type: "VALOR_INVALIDO",
      campo: "premium_base_rate",
      valor: taxa,
      motivo: "deve ser um número positivo",
    });
  }

  const capital = capitalResult.value;
  const premioBase = (capital * taxa) / 1000;
  const premioFinal = premioBase + TAXA_FUNERARIA_FIXA;

  return ok({ capitalSegurado: capital, premioBase, premioFinal });
}
