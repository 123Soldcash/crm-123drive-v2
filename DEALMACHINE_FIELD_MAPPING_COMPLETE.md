# 🎯 DealMachine → CRM Field Mapping (328 Columns)

**MAPEAMENTO COMPLETO DO DEALMACHINE PARA O CRM**

Este é o guia definitivo com 100% dos campos do DealMachine mapeados para o banco de dados do CRM.

---

## 📊 Resumo Executivo

| Aspecto | Detalhes |
|--------|----------|
| **Total de Colunas** | 328 |
| **Campos de Propriedade** | 174 (colunas 1-174) |
| **Campos de Contatos** | 154 (colunas 175-328) |
| **Contatos por Propriedade** | Até 14 |
| **Telefones por Contato** | Até 3 |
| **Emails por Contato** | Até 3 |
| **Formato de Coluna** | snake_case (ex: `property_id`) |
| **Formato do CRM** | camelCase (ex: `propertyId`) |

---

## 🏠 PROPRIEDADE - CAMPOS 1-174

### Seção 1: Identificação (Colunas 1-10)

| # | DealMachine | CRM | Tipo | Obrigatório |
|---|---|---|---|---|
| 1 | property_id | propertyId | STRING | ✅ Para duplicatas |
| 2 | address_line_1 | addressLine1 | STRING | ✅ SIM |
| 3 | address_line_2 | addressLine2 | STRING | ❌ Não |
| 4 | city | city | STRING | ✅ SIM |
| 5 | state | state | STRING | ✅ SIM |
| 6 | zipcode | zipcode | STRING | ✅ SIM |
| 7 | county | county | STRING | ❌ Não |
| 8 | country | country | STRING | ❌ Não |
| 9 | latitude | latitude | FLOAT | ❌ Não |
| 10 | longitude | longitude | FLOAT | ❌ Não |

### Seção 2: Proprietário 1 (Colunas 11-15)

| # | DealMachine | CRM | Tipo |
|---|---|---|---|
| 11 | owner_1_name | owner1Name | STRING |
| 12 | owner_1_address | owner1Address | STRING |
| 13 | owner_1_city | owner1City | STRING |
| 14 | owner_1_state | owner1State | STRING |
| 15 | owner_1_zipcode | owner1Zipcode | STRING |

### Seção 3: Proprietário 2 (Colunas 16-20)

| # | DealMachine | CRM | Tipo |
|---|---|---|---|
| 16 | owner_2_name | owner2Name | STRING |
| 17 | owner_2_address | owner2Address | STRING |
| 18 | owner_2_city | owner2City | STRING |
| 19 | owner_2_state | owner2State | STRING |
| 20 | owner_2_zipcode | owner2Zipcode | STRING |

### Seção 4: Endereço de Correspondência (Colunas 21-25)

| # | DealMachine | CRM | Tipo |
|---|---|---|---|
| 21 | mailing_address_line_1 | mailingAddressLine1 | STRING |
| 22 | mailing_address_line_2 | mailingAddressLine2 | STRING |
| 23 | mailing_city | mailingCity | STRING |
| 24 | mailing_state | mailingState | STRING |
| 25 | mailing_zipcode | mailingZipcode | STRING |

### Seção 5: Tipo e Tamanho (Colunas 26-31)

| # | DealMachine | CRM | Tipo |
|---|---|---|---|
| 26 | property_type | propertyType | STRING |
| 27 | beds | beds | INT |
| 28 | baths | baths | INT |
| 29 | sqft | sqft | INT |
| 30 | lot_sqft | lotSqft | INT |
| 31 | year_built | yearBuilt | INT |

### Seção 6: Condição e Idade (Colunas 32-41)

| # | DealMachine | CRM | Tipo |
|---|---|---|---|
| 32 | property_condition | propertyCondition | STRING |
| 33 | roof_age | roofAge | INT |
| 34 | roof_type | roofType | STRING |
| 35 | ac_age | acAge | INT |
| 36 | ac_type | acType | STRING |
| 37 | foundation_type | foundationType | STRING |
| 38 | pool | pool | BOOLEAN |
| 39 | garage_type | garageType | STRING |
| 40 | garage_spaces | garageSpaces | INT |
| 41 | stories | stories | INT |

### Seção 7: Finanças (Colunas 42-60)

| # | DealMachine | CRM | Tipo |
|---|---|---|---|
| 42 | hoa_fee | hoaFee | FLOAT |
| 43 | property_tax_amount | propertyTaxAmount | FLOAT |
| 44 | estimated_value | estimatedValue | FLOAT |
| 45 | equity_amount | equityAmount | FLOAT |
| 46 | equity_percent | equityPercent | FLOAT |
| 47 | days_on_market | daysOnMarket | INT |
| 48 | last_sale_date | lastSaleDate | DATE |
| 49 | last_sale_price | lastSalePrice | FLOAT |
| 50 | occupancy_status | occupancyStatus | ENUM |
| 51 | mls_status | mlsStatus | ENUM |
| 52 | lease_type | leaseType | ENUM |

### Seção 8: Hipoteca 1 (Colunas 53-59)

| # | DealMachine | CRM | Tipo |
|---|---|---|---|
| 53 | mortgage_1_lender | mtg1Lender | STRING |
| 54 | mortgage_1_loan_amt | mtg1LoanAmt | FLOAT |
| 55 | mortgage_1_est_loan_balance | mtg1EstLoanBalance | FLOAT |
| 56 | mortgage_1_est_payment_amount | mtg1EstPaymentAmount | FLOAT |
| 57 | mortgage_1_loan_type | mtg1LoanType | STRING |
| 58 | mortgage_1_type_financing | mtg1TypeFinancing | STRING |
| 59 | mortgage_1_est_interest_rate | mtg1EstInterestRate | FLOAT |

### Seção 9: Hipoteca 2 (Colunas 60-66)

| # | DealMachine | CRM | Tipo |
|---|---|---|---|
| 60 | mortgage_2_lender | mtg2Lender | STRING |
| 61 | mortgage_2_loan_amt | mtg2LoanAmt | FLOAT |
| 62 | mortgage_2_est_loan_balance | mtg2EstLoanBalance | FLOAT |
| 63 | mortgage_2_est_payment_amount | mtg2EstPaymentAmount | FLOAT |
| 64 | mortgage_2_loan_type | mtg2LoanType | STRING |
| 65 | mortgage_2_type_financing | mtg2TypeFinancing | STRING |
| 66 | mortgage_2_est_interest_rate | mtg2EstInterestRate | FLOAT |

### Seção 10: Hipoteca 3 (Colunas 67-73)

| # | DealMachine | CRM | Tipo |
|---|---|---|---|
| 67 | mortgage_3_lender | mtg3Lender | STRING |
| 68 | mortgage_3_loan_amt | mtg3LoanAmt | FLOAT |
| 69 | mortgage_3_est_loan_balance | mtg3EstLoanBalance | FLOAT |
| 70 | mortgage_3_est_payment_amount | mtg3EstPaymentAmount | FLOAT |
| 71 | mortgage_3_loan_type | mtg3LoanType | STRING |
| 72 | mortgage_3_type_financing | mtg3TypeFinancing | STRING |
| 73 | mortgage_3_est_interest_rate | mtg3EstInterestRate | FLOAT |

### Seção 11: Hipoteca 4 (Colunas 74-80)

| # | DealMachine | CRM | Tipo |
|---|---|---|---|
| 74 | mortgage_4_lender | mtg4Lender | STRING |
| 75 | mortgage_4_loan_amt | mtg4LoanAmt | FLOAT |
| 76 | mortgage_4_est_loan_balance | mtg4EstLoanBalance | FLOAT |
| 77 | mortgage_4_est_payment_amount | mtg4EstPaymentAmount | FLOAT |
| 78 | mortgage_4_loan_type | mtg4LoanType | STRING |
| 79 | mortgage_4_type_financing | mtg4TypeFinancing | STRING |
| 80 | mortgage_4_est_interest_rate | mtg4EstInterestRate | FLOAT |

### Seção 12: HOA e Referências (Colunas 81-85)

| # | DealMachine | CRM | Tipo |
|---|---|---|---|
| 81 | hoa_fee_amount | hoaFeeAmount | FLOAT |
| 82 | h_o_a1_name | hoa1Name | STRING |
| 83 | h_o_a1_type | hoa1Type | STRING |
| 84 | mail | mail | STRING |
| 85 | dealmachine_url | dealmachineUrl | STRING |

### Seção 13: Notas (Colunas 86-90)

| # | DealMachine | CRM | Tipo |
|---|---|---|---|
| 86 | notes_1 | notes1 | TEXT |
| 87 | facebookprofile1 | facebookProfile1 | STRING |
| 88 | priority | priority | STRING |
| 89 | skiptracetruepeoplesearch | skiptraceTrue | BOOLEAN |
| 90 | calledtruepeoplesearch | calledTrue | BOOLEAN |

### Seção 14: Status de Pesquisa (Colunas 91-111)

| # | DealMachine | CRM | Tipo |
|---|---|---|---|
| 91 | done_with_facebook | doneWithFacebook | BOOLEAN |
| 92 | address_of_the_property | addressOfProperty | STRING |
| 93 | donemailing_-_onwers | doneMailingOwners | BOOLEAN |
| 94 | donemailingrelatives | doneMailingRelatives | BOOLEAN |
| 95 | emailonwersinstantly.ai | emailOwnersInstantly | BOOLEAN |
| 96 | idi_-_search | idiSearch | BOOLEAN |
| 97 | httpsofficialrecords.broward.orgacclaimwebsearchsearchtypename | officialRecordsSearch | BOOLEAN |
| 98 | httpscounty-taxes.netbrowardbrowardproperty-tax | countyTaxSearch | BOOLEAN |
| 99 | violationsearch | violationSearch | BOOLEAN |
| 100 | httpsofficialrecords.broward.orgacclaimwebsearchsearchtypesimplesearch | simpleSearch | BOOLEAN |
| 101 | httpsdpepp.broward.orgbcsdefault.aspxpossepresentationparcelpermitlistposseobjectid116746 | permitSearch | BOOLEAN |
| 102 | notes2 | notes2 | TEXT |
| 103 | notes3 | notes3 | TEXT |
| 104 | notes4 | notes4 | TEXT |
| 105 | notes5 | notes5 | TEXT |
| 106 | facebookprofile2 | facebookProfile2 | STRING |
| 107 | facebookprofile3 | facebookProfile3 | STRING |
| 108 | facebookprofile4 | facebookProfile4 | STRING |
| 109 | skiptracemanus | skiptraceManus | BOOLEAN |
| 110 | calledmanus | calledManus | BOOLEAN |
| 111 | property_flags | propertyFlags | STRING |

---

## 👥 CONTATOS - CAMPOS 175-328

### Padrão de Contato (Repete para Contatos 1-14)

Cada contato segue este padrão (11 campos):

```
contact_N_name           → contactNName
contact_N_flags          → contactNFlags
contact_N_phone1         → contactNPhone1
contact_N_phone1_type    → contactNPhone1Type
contact_N_phone2         → contactNPhone2
contact_N_phone2_type    → contactNPhone2Type
contact_N_phone3         → contactNPhone3
contact_N_phone3_type    → contactNPhone3Type
contact_N_email1         → contactNEmail1
contact_N_email2         → contactNEmail2
contact_N_email3         → contactNEmail3
```

### Distribuição de Colunas por Contato

| Contato | Colunas | Intervalo |
|---------|---------|-----------|
| Contact 1 | 175-185 | 11 campos |
| Contact 2 | 186-196 | 11 campos |
| Contact 3 | 197-207 | 11 campos |
| Contact 4 | 208-218 | 11 campos |
| Contact 5 | 219-229 | 11 campos |
| Contact 6 | 230-240 | 11 campos |
| Contact 7 | 241-251 | 11 campos |
| Contact 8 | 252-262 | 11 campos |
| Contact 9 | 263-273 | 11 campos |
| Contact 10 | 274-284 | 11 campos |
| Contact 11 | 285-295 | 11 campos |
| Contact 12 | 296-306 | 11 campos |
| Contact 13 | 307-317 | 11 campos |
| Contact 14 | 318-328 | 11 campos |

### Exemplo: Contact 1 (Colunas 175-185)

| # | DealMachine | CRM | Tipo |
|---|---|---|---|
| 175 | contact_1_name | contact1Name | STRING |
| 176 | contact_1_flags | contact1Flags | STRING |
| 177 | contact_1_phone1 | contact1Phone1 | STRING |
| 178 | contact_1_phone1_type | contact1Phone1Type | ENUM |
| 179 | contact_1_phone2 | contact1Phone2 | STRING |
| 180 | contact_1_phone2_type | contact1Phone2Type | ENUM |
| 181 | contact_1_phone3 | contact1Phone3 | STRING |
| 182 | contact_1_phone3_type | contact1Phone3Type | ENUM |
| 183 | contact_1_email1 | contact1Email1 | STRING |
| 184 | contact_1_email2 | contact1Email2 | STRING |
| 185 | contact_1_email3 | contact1Email3 | STRING |

### Exemplo: Contact 2 (Colunas 186-196)

| # | DealMachine | CRM | Tipo |
|---|---|---|---|
| 186 | contact_2_name | contact2Name | STRING |
| 187 | contact_2_flags | contact2Flags | STRING |
| 188 | contact_2_phone1 | contact2Phone1 | STRING |
| 189 | contact_2_phone1_type | contact2Phone1Type | ENUM |
| 190 | contact_2_phone2 | contact2Phone2 | STRING |
| 191 | contact_2_phone2_type | contact2Phone2Type | ENUM |
| 192 | contact_2_phone3 | contact2Phone3 | STRING |
| 193 | contact_2_phone3_type | contact2Phone3Type | ENUM |
| 194 | contact_2_email1 | contact2Email1 | STRING |
| 195 | contact_2_email2 | contact2Email2 | STRING |
| 196 | contact_2_email3 | contact2Email3 | STRING |

---

## 🔑 Tipos de Dados

### STRING
Texto livre. Exemplos:
- `"123 Main Street"`
- `"John Smith"`
- `"Miami-Dade"`

### INT
Número inteiro. Exemplos:
- `3` (bedrooms)
- `2024` (year built)
- `1500` (sqft)

### FLOAT
Número decimal. Exemplos:
- `450000.50` (estimated value)
- `3.5` (interest rate)
- `75.5` (equity percent)

### BOOLEAN
Verdadeiro/Falso. Aceita:
- `true` / `false`
- `1` / `0`
- `yes` / `no`
- `True` / `False`

### DATE
Data. Formatos aceitos:
- `"2024-01-15"` (ISO)
- `"01/15/2024"` (US)
- `"15-01-2024"` (EU)

### ENUM
Valores pré-definidos. Exemplos:
- Phone Type: `Mobile`, `Home`, `Work`, `Other`
- Occupancy: `Owner-Occupied`, `Tenant-Occupied`, `Vacant`
- MLS Status: `Active`, `Sold`, `Expired`

---

## ✅ Campos Obrigatórios

Para importação bem-sucedida, TODOS estes campos devem ter valores:

1. ✅ `address_line_1` - Endereço principal
2. ✅ `city` - Cidade
3. ✅ `state` - Estado
4. ✅ `zipcode` - CEP

**Sem estes 4 campos, a propriedade será rejeitada.**

---

## 🚫 Campos Opcionais

Todos os outros campos são opcionais. Se vazio:
- STRING: deixar em branco ou NULL
- INT/FLOAT: deixar em branco ou 0
- BOOLEAN: deixar em branco ou false
- DATE: deixar em branco ou NULL

---

## 🔄 Conversão Automática

O sistema converte automaticamente:

| Entrada | Conversão | Resultado |
|---------|-----------|-----------|
| `"true"` | STRING → BOOLEAN | `true` |
| `"1"` | STRING → BOOLEAN | `true` |
| `"false"` | STRING → BOOLEAN | `false` |
| `"0"` | STRING → BOOLEAN | `false` |
| `"450000"` | STRING → FLOAT | `450000.00` |
| `""` (vazio) | STRING → NULL | `null` |

---

## 📋 Checklist de Validação

Antes de importar, verifique:

- [ ] Arquivo é .xlsx (Excel)
- [ ] Linha 1 tem cabeçalhos em snake_case
- [ ] Dados começam na linha 2
- [ ] address_line_1 preenchido
- [ ] city preenchido
- [ ] state preenchido
- [ ] zipcode preenchido
- [ ] Máximo 14 contatos por propriedade
- [ ] Telefones têm tipo válido
- [ ] Sem caracteres especiais problemáticos
- [ ] Arquivo < 50MB

---

## 🎯 Próximas Etapas

1. **Prepare seu arquivo** com as 328 colunas
2. **Valide dados** usando este mapeamento
3. **Importe no CRM** via "Import Properties"
4. **Verifique Dashboard** para confirmar importação
5. **Atribua agentes** se necessário
6. **Adicione notas** e pesquisa conforme necessário

---

## 📞 Referência Rápida

| Necessidade | Coluna DealMachine | Campo CRM |
|---|---|---|
| Endereço | `address_line_1` | `addressLine1` |
| Proprietário | `owner_1_name` | `owner1Name` |
| Contato | `contact_1_name` | `contact1Name` |
| Telefone | `contact_1_phone1` | `contact1Phone1` |
| Email | `contact_1_email1` | `contact1Email1` |
| Valor | `estimated_value` | `estimatedValue` |
| Hipoteca | `mortgage_1_lender` | `mtg1Lender` |
| Notas | `notes_1` | `notes1` |

---

**Versão:** 2.0  
**Data:** Janeiro 2026  
**Compatibilidade:** DealMachine 328 Colunas  
**Formato:** Excel (.xlsx)
