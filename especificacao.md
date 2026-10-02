# Especificação — Cálculo de Capital Segurado (Seguro de Vida Coletivo)

> Fluxo da proposta: **domínio → regras → equação → invariantes → critérios de aceite → implementação → verificação**
>
> Itens marcados com ⚠️ são **decisões/dúvidas registradas**. Conforme a regra do desafio, não inventei o que não estava claro: registrei a dúvida e a decisão provisória adotada.

---

## 1. Conceitos do domínio

| Termo | Definição |
|---|---|
| **Seguro de vida coletivo** | Apólice contratada por uma empresa (estipulante) que cobre vários funcionários (segurados) sob as mesmas regras. |
| **Estipulante** | A empresa cliente que contrata o seguro para seus funcionários. |
| **Segurado** | Cada funcionário coberto pela apólice. |
| **Capital segurado** | Valor máximo que a seguradora paga aos beneficiários em caso de sinistro (ex.: morte). É a "importância segurada" de cada vida. |
| **Múltiplo salarial** | Forma de definir o capital como um número de vezes o salário. Um seguro de **10x, 12x ou 20x** significa capital = 10, 12 ou 20 vezes o salário mensal. |
| **Capital uniforme** | Forma alternativa: todos os segurados têm o mesmo valor fixo (`individual_insured_value`), independente do salário. |
| **Fator multiplicador** | O "x" do múltiplo salarial (ex.: 20). |
| **Limites mínimo e máximo** | Piso e teto do capital, definidos no contrato. Se o valor calculado fugir da faixa, ele é ajustado ao limite (*clamp*). |
| **Taxa** | Valor cobrado por R$ 1.000 de capital segurado. |
| **Prêmio base** | Custo do seguro: `(capital × taxa) / 1000`. |
| **Taxa funerária** | Valor fixo de **0,32 por vida**, somado ao prêmio em todas as apólices. |
| **Prêmio final** | Prêmio base + taxa funerária. |
| **Vigência** | Período em que a apólice está ativa. |

### Qual salário usar?
O **salário mensal base** do funcionário, vigente na data de referência do cálculo.

⚠️ **Dúvida registrada:** o PDF não diz se verbas variáveis (comissões, bônus, horas extras) entram no "salário". **Decisão provisória:** usar somente o salário base informado no contrato/cadastro; o sistema não decide o que compõe o salário, apenas recebe o valor já definido.

---

## 2. Regras de negócio

| ID | Regra |
|---|---|
| **RN-01** | Cada apólice tem um **tipo de cálculo**: `capital uniforme` ou `múltiplo salarial`. |
| **RN-02** | No **capital uniforme**, o capital de cada segurado é igual a `individual_insured_value`, independente do salário. |
| **RN-03** | No **múltiplo salarial**, o capital bruto é `salário × fator multiplicador`. |
| **RN-04** | O capital bruto do múltiplo salarial é limitado pelos valores **mínimo** e **máximo** do contrato (*clamp*). |
| **RN-05** | Prêmio base = `(capital × taxa) / 1000`. |
| **RN-06** | Prêmio final = prêmio base + **0,32** (taxa funerária fixa por vida, em todas as apólices). |
| **RN-07** | Valores monetários não podem usar ponto flutuante binário; usar tipo decimal (ou centavos inteiros) com regra de arredondamento explícita. |
| **RN-08** | Entradas inválidas **não geram capital**: retornam um erro explícito e tipado (nunca `0` silencioso nem exceção genérica). |
| **RN-09** | O capital é calculado com o **salário vigente na data de referência**; mudança salarial gera novo cálculo a partir da sua data de efeito. |

### Decisões e dúvidas registradas

| # | Situação | Decisão provisória | Justificativa / como validar |
|---|---|---|---|
| ⚠️ D-01 | Salário = 0 | **Inválido** no múltiplo salarial (erro) | Com piso mínimo, `0 × múltiplo` viraria o mínimo, concedendo capital a quem não tem base de cálculo. Confirmar com o domínio se há funcionário sem salário coberto pelo piso. |
| ⚠️ D-02 | Salário negativo | **Inválido** (erro) | Salário negativo não existe no domínio. |
| ⚠️ D-03 | Múltiplo = 0 | **Inválido** (erro) | Um plano de múltiplo salarial com fator 0 não oferece cobertura; provável erro de cadastro. |
| ⚠️ D-04 | Múltiplo negativo | **Inválido** (erro) | Capital negativo não faz sentido. |
| ⚠️ D-05 | Salário ausente | **Erro explícito** (`SalarioAusente`) em múltiplo salarial; **ignorado** em capital uniforme | No capital uniforme o salário não participa do cálculo. |
| D-06 | Capital acima do máximo | **Ajustado ao máximo** (clamp), não é erro | É o comportamento normal da regra de limites (RN-04). |
| ⚠️ D-07 | Salário muda durante a vigência | Novo capital a partir da data de efeito da mudança | Dúvida aberta: o recálculo é imediato ou só na renovação/aniversário da apólice? Depende do contrato; o cálculo deve receber a data de referência para suportar ambos. |
| ⚠️ D-08 | Arredondamento | Arredondar para 2 casas somente no **resultado final** (prêmio) | Dúvida: método (half-up vs. bancário) não consta no desafio; confirmar. |
| ⚠️ D-09 | Mínimo > máximo no contrato | Contrato inválido (erro de configuração) | Faixa incoerente. |

---

## 3. Equação

Sejam:

- `S` = salário mensal
- `m` = fator multiplicador
- `Cmin`, `Cmax` = limites do contrato
- `U` = `individual_insured_value` (capital uniforme)
- `t` = taxa por R$ 1.000
- `F` = 0,32 (taxa funerária fixa)

**Capital segurado**

```
Capital uniforme:     C = U

Múltiplo salarial:    C_bruto = S × m
                      C = min( max( C_bruto, Cmin ), Cmax )
```

**Prêmio**

```
Prêmio_base  = (C × t) / 1000
Prêmio_final = Prêmio_base + F
```

### Hipótese validada: "capital = salário × múltiplo"?
A fórmula `S × m` é a **parte central**, mas **não é a regra completa**: ela só vale dentro da faixa `[Cmin, Cmax]`. Fora dela, o valor é ajustado ao limite. Por isso a hipótese foi validada **parcialmente**.

### Exemplo do desafio (plano 20x)

Sem limites informados no PDF (`C = S × 20`):

| Funcionário | Salário | Capital (20x) |
|---|---|---|
| Ana | R$ 3.000,00 | R$ 60.000,00 |
| Bruno | R$ 5.500,00 | R$ 110.000,00 |
| Carla | R$ 10.000,00 | R$ 200.000,00 |
| Diego | R$ 20.000,00 | R$ 400.000,00 |

Com limites **hipotéticos** (apenas ilustrativos) `Cmin = 50.000` e `Cmax = 300.000`:

| Funcionário | Capital bruto | Capital segurado |
|---|---|---|
| Ana | 60.000 | 60.000 |
| Bruno | 110.000 | 110.000 |
| Carla | 200.000 | 200.000 |
| Diego | 400.000 | **300.000** (limitado ao máximo) |

---

## 4. Invariantes

**Válido**

- `S > 0` (múltiplo salarial)
- `m > 0` (múltiplo salarial)
- `Cmin ≤ Cmax`, ambos ≥ 0
- `U ≥ 0` (capital uniforme; confirmar se `U = 0` é aceito)
- `t ≥ 0`

**Sempre verdadeiro no resultado**

- `Cmin ≤ C ≤ Cmax` no múltiplo salarial
- `C ≥ 0`
- `Prêmio_final ≥ F` (0,32)
- `Prêmio_final = Prêmio_base + 0,32`, sem exceção
- No capital uniforme, `C` não depende de `S`
- Mesma entrada → mesma saída (função pura, sem dependência de relógio, banco ou I/O)

**Inválido (retorna erro, não valor)**

- Salário ausente, zero ou negativo (múltiplo salarial)
- Múltiplo zero ou negativo
- Limites incoerentes (`Cmin > Cmax`)
- Tipo de cálculo desconhecido

---

## 5. Acceptance Criteria

| ID | Cenário | Dado | Quando | Então |
|---|---|---|---|---|
| **AC-01** | Múltiplo dentro dos limites | S = 3.000, m = 20, sem limite restritivo | calcular capital | C = 60.000 |
| **AC-02** | Múltiplo dentro dos limites | S = 5.500, m = 20 | calcular capital | C = 110.000 |
| **AC-03** | Capital acima do máximo | S = 20.000, m = 20, Cmax = 300.000 | calcular capital | C = 300.000 |
| **AC-04** | Capital abaixo do mínimo | S = 1.000, m = 20, Cmin = 50.000 | calcular capital | C = 50.000 |
| **AC-05** | Capital exatamente no limite | S × m = Cmax | calcular capital | C = Cmax (sem alteração) |
| **AC-06** | Capital uniforme ignora salário | tipo uniforme, U = 100.000, S = 2.000 e depois S = 50.000 | calcular capital | C = 100.000 nos dois casos |
| **AC-07** | Salário zero | múltiplo salarial, S = 0 | calcular capital | erro `SalarioInvalido`, nenhum capital retornado |
| **AC-08** | Salário negativo | S = −1.000 | calcular capital | erro `SalarioInvalido` |
| **AC-09** | Salário ausente | múltiplo salarial, S não informado | calcular capital | erro `SalarioAusente` |
| **AC-10** | Salário ausente em uniforme | tipo uniforme, S não informado, U = 100.000 | calcular capital | C = 100.000 (sem erro) |
| **AC-11** | Múltiplo zero | m = 0 | calcular capital | erro `MultiploInvalido` |
| **AC-12** | Múltiplo negativo | m = −5 | calcular capital | erro `MultiploInvalido` |
| **AC-13** | Limites incoerentes | Cmin = 300.000, Cmax = 50.000 | calcular capital | erro `LimitesInvalidos` |
| **AC-14** | Prêmio base | C = 100.000, t = 0,5 | calcular prêmio | prêmio base = 50,00 |
| **AC-15** | Prêmio final com taxa funerária | prêmio base = 50,00 | calcular prêmio final | 50,32 |
| **AC-16** | Taxa funerária em todas as apólices | apólice uniforme e apólice por múltiplo | calcular prêmio final | ambas somam exatamente 0,32 por vida |
| **AC-17** | Mudança salarial | S = 5.000 até a data D, S = 6.000 a partir de D, m = 20 | calcular antes e depois de D | C = 100.000 antes de D; C = 120.000 após D (sujeito a D-07) |
| **AC-18** | Precisão monetária | valores que gerariam erro em ponto flutuante (ex.: 0,1 + 0,2) | calcular prêmio | resultado exato em decimal, sem `0,30000000000000004` |

---

## 6. Proposta de implementação

> Preencha com os detalhes da sua implementação (linguagem, estrutura de pastas).

**Princípios**

1. **Domínio puro:** as funções de cálculo (capital e prêmio) não conhecem JSON, banco, HTTP nem arquivos.
2. **Bordas separadas:** leitura do `contratos-seguro-vida.json` e conversão para objetos do domínio ficam em uma camada externa (adaptador).
3. **Validação na entrada:** valores inválidos são rejeitados antes do cálculo.
4. **Erros explícitos:** o resultado é *sucesso com valor* ou *erro tipado* (`SalarioInvalido`, `SalarioAusente`, `MultiploInvalido`, `LimitesInvalidos`), sem `null`/`0` ambíguos.
5. **Tipo monetário decimal**, nunca `float`.

**Estrutura sugerida**

```
src/
  dominio/
    capital.(ext)        # RN-02, RN-03, RN-04
    premio.(ext)         # RN-05, RN-06
    erros.(ext)          # erros tipados
    validacao.(ext)      # invariantes
  adaptadores/
    leitor_contratos.(ext)   # JSON -> objetos do domínio
tests/
  dominio/               # um teste por AC
  adaptadores/
```

---

## 7. Pergunta final — como sei que a implementação está correta?

Não é "porque os testes passaram". A correção vem de uma **cadeia de rastreabilidade** do domínio até o código:

1. **Domínio → regra.** Cada conceito (capital, múltiplo, limites, taxa funerária) virou uma regra numerada (RN-xx). Nada no código existe sem uma regra que o justifique.
2. **Regra → equação.** As regras foram condensadas em uma equação matemática (seção 3). A hipótese `S × m` foi testada e **refinada**: sem os limites, ela produziria capital errado para Diego e para salários baixos.
3. **Regra → cenários.** Cada RN tem pelo menos um critério de aceite (AC-xx), incluindo os **casos de borda**. Os testes foram derivados das regras, não do código.
4. **Invariantes como propriedades.** Além de exemplos, verifico propriedades que devem valer para *qualquer* entrada (ex.: `Cmin ≤ C ≤ Cmax`, `Prêmio_final ≥ 0,32`). Testes baseados em propriedades pegam casos que não imaginei.
5. **Verificação contra dados reais.** Rodei os 8 contratos de `contratos-seguro-vida.json` pelo cálculo e conferi os resultados à mão (ou por cálculo independente) para ao menos alguns contratos.
6. **Dúvidas registradas, não escondidas.** Onde o domínio não era claro (D-01 a D-09), a decisão está documentada e é fácil de mudar; a implementação está correta *em relação à especificação*, e as lacunas da especificação estão visíveis.
7. **Código que espelha a regra.** Como o domínio é puro e separado dos detalhes externos, cada função lê-se quase como a equação correspondente, o que permite revisar o código contra a especificação diretamente.

### Matriz de rastreabilidade (preencher com os nomes reais)

| Conceito | Regra | Critérios de aceite | Teste | Código |
|---|---|---|---|---|
| Capital uniforme | RN-02 | AC-06, AC-10 | `...` | `...` |
| Múltiplo salarial | RN-03 | AC-01, AC-02 | `...` | `...` |
| Limites mín./máx. | RN-04 | AC-03, AC-04, AC-05 | `...` | `...` |
| Validação de entrada | RN-08 | AC-07 a AC-13 | `...` | `...` |
| Prêmio | RN-05, RN-06 | AC-14, AC-15, AC-16 | `...` | `...` |
| Precisão monetária | RN-07 | AC-18 | `...` | `...` |
| Mudança salarial | RN-09 | AC-17 | `...` | `...` |