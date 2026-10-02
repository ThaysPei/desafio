import { describe, it, expect } from "vitest"; // ou 'jest', com a mesma API
import { calcularCapitalSegurado, calcularPremio, Contract } from "./capitalSegurado";

// ---------- Fixtures baseadas nos 8 contratos reais do dataset ----------

const contratoUniformeValido: Contract = {
  contract_id: "CTR-2026-0001",
  carrier: "Zênite Seguros S.A.",
  benefit_type: "life-insurance",
  capital_type: "uniform",
  pricing: { individual_insured_value: 200000, premium_base_rate: 0.35 },
  beneficiaries: [{ name: "Marina", cpf: "123", birth_date: "1990-04-12" }],
};

const contratoMultiploValido: Contract = {
  contract_id: "CTR-2026-0002",
  carrier: "Bússola Vida Seguradora",
  benefit_type: "life-insurance",
  capital_type: "multiple-of-income",
  pricing: {
    premium_base_rate: 0.4,
    multiple_of_income_min_value: 50000,
    multiple_of_income_max_value: 300000,
    multiple_of_income_multiplier_factor: 24,
  },
  beneficiaries: [{ name: "Eduardo", cpf: "234", birth_date: "1985-09-23", monthly_salary: 8000 }],
};

describe("Casos válidos (do dataset)", () => {
  it("01 — uniforme válido: capital = individual_insured_value", () => {
    const r = calcularCapitalSegurado(contratoUniformeValido, contratoUniformeValido.beneficiaries[0]);
    expect(r).toEqual({ ok: true, value: 200000 });
  });

  it("01 — prêmio final = (200000*0.35)/1000 + 0.32", () => {
    const r = calcularPremio(contratoUniformeValido, contratoUniformeValido.beneficiaries[0]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.premioBase).toBeCloseTo(70);
      expect(r.value.premioFinal).toBeCloseTo(70.32);
    }
  });

  it("02 — múltiplo salarial dentro da faixa: capital = salário × fator", () => {
    const r = calcularCapitalSegurado(contratoMultiploValido, contratoMultiploValido.beneficiaries[0]);
    expect(r).toEqual({ ok: true, value: 192000 }); // 8000 * 24
  });

  it("02 — prêmio final = (192000*0.4)/1000 + 0.32", () => {
    const r = calcularPremio(contratoMultiploValido, contratoMultiploValido.beneficiaries[0]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.premioBase).toBeCloseTo(76.8);
      expect(r.value.premioFinal).toBeCloseTo(77.12);
    }
  });
});

describe("Casos de erro (do dataset)", () => {
  it("03 — uniforme sem individual_insured_value → CAMPO_OBRIGATORIO_AUSENTE", () => {
    const contrato: Contract = { ...contratoUniformeValido, pricing: { premium_base_rate: 0.42 } };
    const r = calcularCapitalSegurado(contrato, contrato.beneficiaries[0]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.type).toBe("CAMPO_OBRIGATORIO_AUSENTE");
  });

  it("04 — individual_insured_value negativo → VALOR_INVALIDO", () => {
    const contrato: Contract = {
      ...contratoUniformeValido,
      pricing: { individual_insured_value: -50000, premium_base_rate: 0.45 },
    };
    const r = calcularCapitalSegurado(contrato, contrato.beneficiaries[0]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.type).toBe("VALOR_INVALIDO");
  });

  it("05 — múltiplo salarial sem premium_base_rate → erro ao calcular o prêmio", () => {
    const contrato: Contract = {
      ...contratoMultiploValido,
      pricing: {
        multiple_of_income_min_value: 40000,
        multiple_of_income_max_value: 250000,
        multiple_of_income_multiplier_factor: 20,
      },
    };
    const r = calcularPremio(contrato, contrato.beneficiaries[0]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.type).toBe("CAMPO_OBRIGATORIO_AUSENTE");
  });

  it("06 — múltiplo salarial sem max_value → CAMPO_OBRIGATORIO_AUSENTE", () => {
    const contrato: Contract = {
      ...contratoMultiploValido,
      pricing: {
        premium_base_rate: 0.38,
        multiple_of_income_min_value: 30000,
        multiple_of_income_multiplier_factor: 18,
      },
    };
    const r = calcularCapitalSegurado(contrato, contrato.beneficiaries[0]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.type).toBe("CAMPO_OBRIGATORIO_AUSENTE");
  });

  it("07 — min > max → CONFIGURACAO_INVALIDA", () => {
    const contrato: Contract = {
      ...contratoMultiploValido,
      pricing: {
        premium_base_rate: 0.5,
        multiple_of_income_min_value: 200000,
        multiple_of_income_max_value: 100000,
        multiple_of_income_multiplier_factor: 22,
      },
    };
    const r = calcularCapitalSegurado(contrato, contrato.beneficiaries[0]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.type).toBe("CONFIGURACAO_INVALIDA");
  });

  it("08 — beneficiário sem monthly_salary → DADO_BENEFICIARIO_AUSENTE", () => {
    const beneficiarioSemSalario = { name: "Thiago", cpf: "890", birth_date: "1991-12-05" };
    const r = calcularCapitalSegurado(contratoMultiploValido, beneficiarioSemSalario);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.type).toBe("DADO_BENEFICIARIO_AUSENTE");
  });
});

describe("Casos de borda adicionais (citados no enunciado, fora do dataset)", () => {
  it("valor base abaixo do mínimo → capital = mínimo (clamp para baixo)", () => {
    const contrato: Contract = {
      ...contratoMultiploValido,
      pricing: { ...contratoMultiploValido.pricing, multiple_of_income_min_value: 100000 },
    };
    // salário 8000 * fator 24 = 192000, mas agora o mínimo é 100000... então isso NÃO testa o clamp de baixo.
    // Ajustando o salário para forçar valor_base < min:
    const beneficiario = { ...contratoMultiploValido.beneficiaries[0], monthly_salary: 1000 }; // 1000*24=24000 < 100000
    const r = calcularCapitalSegurado(contrato, beneficiario);
    expect(r).toEqual({ ok: true, value: 100000 });
  });

  it("valor base acima do máximo → capital = máximo (clamp para cima)", () => {
    const beneficiario = { ...contratoMultiploValido.beneficiaries[0], monthly_salary: 50000 }; // 50000*24=1.200.000 > 300000
    const r = calcularCapitalSegurado(contratoMultiploValido, beneficiario);
    expect(r).toEqual({ ok: true, value: 300000 });
  });

  it("salário = 0 → VALOR_INVALIDO, não capital zero", () => {
    const beneficiario = { ...contratoMultiploValido.beneficiaries[0], monthly_salary: 0 };
    const r = calcularCapitalSegurado(contratoMultiploValido, beneficiario);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.type).toBe("VALOR_INVALIDO");
  });

  it("salário negativo → VALOR_INVALIDO", () => {
    const beneficiario = { ...contratoMultiploValido.beneficiaries[0], monthly_salary: -3000 };
    const r = calcularCapitalSegurado(contratoMultiploValido, beneficiario);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.type).toBe("VALOR_INVALIDO");
  });

  it("fator multiplicador = 0 → VALOR_INVALIDO", () => {
    const contrato: Contract = {
      ...contratoMultiploValido,
      pricing: { ...contratoMultiploValido.pricing, multiple_of_income_multiplier_factor: 0 },
    };
    const r = calcularCapitalSegurado(contrato, contrato.beneficiaries[0]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.type).toBe("VALOR_INVALIDO");
  });

  it("fator multiplicador negativo → VALOR_INVALIDO", () => {
    const contrato: Contract = {
      ...contratoMultiploValido,
      pricing: { ...contratoMultiploValido.pricing, multiple_of_income_multiplier_factor: -5 },
    };
    const r = calcularCapitalSegurado(contrato, contrato.beneficiaries[0]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.type).toBe("VALOR_INVALIDO");
  });
});

describe("Exemplo do enunciado — plano hipotético de 20x, sem min/max", () => {
  const contratoHipotetico: Contract = {
    contract_id: "HIPOTETICO",
    carrier: "N/A",
    benefit_type: "life-insurance",
    capital_type: "multiple-of-income",
    pricing: {
      premium_base_rate: 0.4,
      multiple_of_income_multiplier_factor: 20,
      multiple_of_income_min_value: 0.01, // sem limite prático inferior
      multiple_of_income_max_value: Number.MAX_SAFE_INTEGER, // sem limite prático superior
    },
    beneficiaries: [],
  };

  it.each([
    ["Ana", 3000, 60000],
    ["Bruno", 5500, 110000],
    ["Carla", 10000, 200000],
    ["Diego", 20000, 400000],
  ])("%s com salário %d → capital %d", (_nome, salario, esperado) => {
    const beneficiario = { name: _nome, cpf: "", birth_date: "", monthly_salary: salario as number };
    const r = calcularCapitalSegurado(contratoHipotetico, beneficiario);
    expect(r).toEqual({ ok: true, value: esperado });
  });
});
