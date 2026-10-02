# Cálculo de Capital Segurado — Seguro de Vida Coletivo

Solução para o desafio de engenharia de software: calcular o capital segurado de cada funcionário em um seguro de vida coletivo, partindo da investigação do domínio e não do código.

## Regras em resumo

- **Capital uniforme:** todo segurado recebe `individual_insured_value`.
- **Múltiplo salarial:** `capital = clamp(salário × fator, mínimo, máximo)`.
- **Prêmio base:** `(capital × taxa) / 1000`.
- **Prêmio final:** prêmio base + taxa funerária fixa de `0,32` por vida.

`salário × múltiplo` sozinho **não** é a regra completa: os limites mínimo e máximo do contrato ajustam o resultado (ex.: 20x sobre R$ 20.000 daria R$ 400.000, mas o teto do contrato limita o valor).

## Entradas inválidas

Salário ausente, zero ou negativo, e múltiplo zero ou negativo, retornam **erro explícito** em vez de um valor. Detalhes e dúvidas em aberto estão na especificação.

## Documentação

📄 [Especificação completa](./especificacao-capital-segurado.md): conceitos, regras, equação, invariantes, critérios de aceite e a resposta para "como sei que está correto?".

## Estrutura

```
src/
  dominio/        # regras puras: capital, prêmio, erros, validação
  adaptadores/    # leitura do contratos-seguro-vida.json
tests/            # um teste por critério de aceite
```

> Ajuste os nomes das pastas para refletir a estrutura real do repositório.

## Como rodar

```bash
# instalar dependências
<comando>

# rodar os testes
<comando>
```

## Decisões de design

- Domínio puro, sem I/O, separado dos detalhes externos (JSON).
- Valores monetários em tipo decimal, nunca `float`.
- Erros tipados em vez de `null` ou `0` silencioso.
- Dúvidas do domínio registradas na especificação, não inventadas.
