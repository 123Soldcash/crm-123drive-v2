# 🎯 DealMachine Import Guide V2 - 100% Field Mapping

**Para usuários com TDAH: Guia claro e organizado**

Este guia mostra exatamente como importar dados do DealMachine para o CRM com 100% de compatibilidade.

---

## 📋 Resumo Rápido

| Item | Descrição |
|------|-----------|
| **Formato** | Excel (.xlsx) com nomes de coluna em snake_case |
| **Colunas** | 328 colunas (174 propriedade + 14 contatos × 11 campos) |
| **Contatos** | Até 14 contatos por propriedade |
| **Telefones** | Até 3 por contato (com tipo) |
| **Emails** | Até 3 por contato |
| **Duplicatas** | Prevenidas automaticamente via propertyId |
| **Desk** | Atribuído automaticamente a BIN |
| **Temperatura** | Definida automaticamente como TBD |

---

## 🔄 Mapeamento de Campos (Snake_case → CamelCase)

### Campos Básicos da Propriedade

| DealMachine (snake_case) | CRM (camelCase) | Tipo | Obrigatório |
|---|---|---|---|
| `property_id` | propertyId | STRING | ✅ (para duplicatas) |
| `address_line_1` | addressLine1 | STRING | ✅ SIM |
| `address_line_2` | addressLine2 | STRING | ❌ Opcional |
| `city` | city | STRING | ✅ SIM |
| `state` | state | STRING | ✅ SIM |
| `zipcode` | zipcode | STRING | ✅ SIM |
| `county` | county | STRING | ❌ Opcional |
| `country` | country | STRING | ❌ Opcional |
| `latitude` | latitude | FLOAT | ❌ Opcional |
| `longitude` | longitude | FLOAT | ❌ Opcional |

### Proprietários

| DealMachine | CRM | Tipo |
|---|---|---|
| `owner_1_name` | owner1Name | STRING |
| `owner_1_address` | owner1Address | STRING |
| `owner_1_city` | owner1City | STRING |
| `owner_1_state` | owner1State | STRING |
| `owner_1_zipcode` | owner1Zipcode | STRING |
| `owner_2_name` | owner2Name | STRING |
| `owner_2_address` | owner2Address | STRING |
| `owner_2_city` | owner2City | STRING |
| `owner_2_state` | owner2State | STRING |
| `owner_2_zipcode` | owner2Zipcode | STRING |

### Endereço de Correspondência

| DealMachine | CRM | Tipo |
|---|---|---|
| `mailing_address_line_1` | mailingAddressLine1 | STRING |
| `mailing_address_line_2` | mailingAddressLine2 | STRING |
| `mailing_city` | mailingCity | STRING |
| `mailing_state` | mailingState | STRING |
| `mailing_zipcode` | mailingZipcode | STRING |

### Detalhes da Propriedade

| DealMachine | CRM | Tipo |
|---|---|---|
| `property_type` | propertyType | STRING |
| `beds` | beds | INT |
| `baths` | baths | INT |
| `sqft` | sqft | INT |
| `lot_sqft` | lotSqft | INT |
| `year_built` | yearBuilt | INT |
| `property_condition` | propertyCondition | STRING |
| `roof_age` | roofAge | INT |
| `roof_type` | roofType | STRING |
| `ac_age` | acAge | INT |
| `ac_type` | acType | STRING |
| `foundation_type` | foundationType | STRING |
| `pool` | pool | BOOLEAN |
| `garage_type` | garageType | STRING |
| `garage_spaces` | garageSpaces | INT |
| `stories` | stories | INT |
| `hoa_fee` | hoaFee | FLOAT |

### Informações Financeiras

| DealMachine | CRM | Tipo |
|---|---|---|
| `property_tax_amount` | propertyTaxAmount | FLOAT |
| `estimated_value` | estimatedValue | FLOAT |
| `equity_amount` | equityAmount | FLOAT |
| `equity_percent` | equityPercent | FLOAT |
| `days_on_market` | daysOnMarket | INT |
| `last_sale_date` | lastSaleDate | DATE |
| `last_sale_price` | lastSalePrice | FLOAT |

### Status da Propriedade

| DealMachine | CRM | Tipo | Valores |
|---|---|---|---|
| `occupancy_status` | occupancyStatus | ENUM | Owner-Occupied, Tenant-Occupied, Vacant |
| `mls_status` | mlsStatus | ENUM | Active, Sold, Expired, etc |
| `lease_type` | leaseType | ENUM | Lease, Rent, Own, etc |

### Hipotecas (4 Hipotecas Suportadas)

**Padrão para cada hipoteca (1-4):**

| DealMachine | CRM | Tipo |
|---|---|---|
| `mortgage_N_lender` | mtgNLender | STRING |
| `mortgage_N_loan_amt` | mtgNLoanAmt | FLOAT |
| `mortgage_N_est_loan_balance` | mtgNEstLoanBalance | FLOAT |
| `mortgage_N_est_payment_amount` | mtgNEstPaymentAmount | FLOAT |
| `mortgage_N_loan_type` | mtgNLoanType | STRING |
| `mortgage_N_type_financing` | mtgNTypeFinancing | STRING |
| `mortgage_N_est_interest_rate` | mtgNEstInterestRate | FLOAT |

**Exemplo:** `mortgage_1_lender` → `mtg1Lender`

### HOA e Referências

| DealMachine | CRM | Tipo |
|---|---|---|
| `hoa_fee_amount` | hoaFeeAmount | FLOAT |
| `h_o_a1_name` | hoa1Name | STRING |
| `h_o_a1_type` | hoa1Type | STRING |
| `mail` | mail | STRING |
| `dealmachine_url` | dealmachineUrl | STRING |

### Notas e Pesquisa

| DealMachine | CRM | Tipo |
|---|---|---|
| `notes_1` | notes1 | TEXT |
| `notes_2` | notes2 | TEXT |
| `notes_3` | notes3 | TEXT |
| `notes_4` | notes4 | TEXT |
| `notes_5` | notes5 | TEXT |
| `priority` | priority | STRING |

### Redes Sociais

| DealMachine | CRM | Tipo |
|---|---|---|
| `facebookprofile1` | facebookProfile1 | STRING |
| `facebookprofile2` | facebookProfile2 | STRING |
| `facebookprofile3` | facebookProfile3 | STRING |
| `facebookprofile4` | facebookProfile4 | STRING |

### Status de Pesquisa

| DealMachine | CRM | Tipo |
|---|---|---|
| `skiptracetruepeoplesearch` | skiptraceTrue | BOOLEAN |
| `calledtruepeoplesearch` | calledTrue | BOOLEAN |
| `done_with_facebook` | doneWithFacebook | BOOLEAN |
| `address_of_the_property` | addressOfProperty | STRING |
| `donemailing_-_onwers` | doneMailingOwners | BOOLEAN |
| `donemailingrelatives` | doneMailingRelatives | BOOLEAN |
| `emailonwersinstantly.ai` | emailOwnersInstantly | BOOLEAN |
| `idi_-_search` | idiSearch | BOOLEAN |
| `httpsofficialrecords.broward.orgacclaimwebsearchsearchtypename` | officialRecordsSearch | BOOLEAN |
| `httpscounty-taxes.netbrowardbrowardproperty-tax` | countyTaxSearch | BOOLEAN |
| `violationsearch` | violationSearch | BOOLEAN |
| `httpsofficialrecords.broward.orgacclaimwebsearchsearchtypesimplesearch` | simpleSearch | BOOLEAN |
| `httpsdpepp.broward.orgbcsdefault.aspxpossepresentationparcelpermitlistposseobjectid116746` | permitSearch | BOOLEAN |
| `skiptracemanus` | skiptraceManus | BOOLEAN |
| `calledmanus` | calledManus | BOOLEAN |
| `property_flags` | propertyFlags | STRING |

---

## 👥 Mapeamento de Contatos (1-14)

### Estrutura de Contato

Cada contato segue este padrão (substitua `N` pelo número: 1-14):

| DealMachine | CRM | Tipo | Descrição |
|---|---|---|---|
| `contact_N_name` | contactNName | STRING | Nome do contato |
| `contact_N_flags` | contactNFlags | STRING | Flags/tags do contato |
| `contact_N_phone1` | contactNPhone1 | STRING | Telefone 1 |
| `contact_N_phone1_type` | contactNPhone1Type | ENUM | Tipo: Mobile, Home, Work, Other |
| `contact_N_phone2` | contactNPhone2 | STRING | Telefone 2 |
| `contact_N_phone2_type` | contactNPhone2Type | ENUM | Tipo: Mobile, Home, Work, Other |
| `contact_N_phone3` | contactNPhone3 | STRING | Telefone 3 |
| `contact_N_phone3_type` | contactNPhone3Type | ENUM | Tipo: Mobile, Home, Work, Other |
| `contact_N_email1` | contactNEmail1 | STRING | Email 1 |
| `contact_N_email2` | contactNEmail2 | STRING | Email 2 |
| `contact_N_email3` | contactNEmail3 | STRING | Email 3 |

### Exemplos de Contatos

**Contact 1 (Colunas 175-185):**
- `contact_1_name` → contactName
- `contact_1_phone1` → contact1Phone1
- `contact_1_email1` → contact1Email1

**Contact 2 (Colunas 186-196):**
- `contact_2_name` → contact2Name
- `contact_2_phone1` → contact2Phone1
- `contact_2_email1` → contact2Email1

**... até Contact 14 (Colunas 318-328)**

---

## 🚀 Como Usar o Arquivo MAP

O arquivo `dealmachine-properties-MAPv2.xlsx` que você forneceu contém:

- **Coluna 1:** `our ref #` - Seu número de referência
- **Coluna 2:** `Add on the notes of the lead` - Notas para adicionar
- **Coluna 3:** `property_id` - ID único do DealMachine

### Passos para Importar

1. **Prepare seu arquivo Excel do DealMachine**
   - Certifique-se de que tem todas as 328 colunas
   - Nomes de coluna devem estar em snake_case (ex: `property_id`, `address_line_1`)
   - Dados devem começar na linha 2 (linha 1 = cabeçalhos)

2. **Verifique campos obrigatórios**
   - ✅ `address_line_1` (endereço)
   - ✅ `city` (cidade)
   - ✅ `state` (estado)
   - ✅ `zipcode` (CEP)

3. **Vá para Import Properties no CRM**
   - Clique em "Import Properties" na navegação
   - Selecione seu arquivo Excel
   - Opcionalmente selecione um agente
   - Clique "Import"

4. **Sistema fará automaticamente:**
   - ✅ Converte snake_case para camelCase
   - ✅ Valida campos obrigatórios
   - ✅ Detecta duplicatas por propertyId
   - ✅ Atribui a BIN desk
   - ✅ Define temperatura como TBD
   - ✅ Adiciona status tag "dealmachine_deep_search_chris_edsel_zach"
   - ✅ Importa até 14 contatos por propriedade
   - ✅ Importa telefones e emails

---

## ⚠️ Tratamento de Erros Comuns

| Erro | Causa | Solução |
|---|---|---|
| "Missing required fields" | Faltam address, city, state ou zipcode | Preencha todos os campos obrigatórios |
| "Duplicate property" | propertyId já existe | Sistema pula duplicatas automaticamente |
| "Invalid phone type" | Tipo de telefone não reconhecido | Use: Mobile, Home, Work, ou Other |
| "Column not found" | Nome de coluna diferente | Use nomes exatos do DealMachine (snake_case) |

---

## 📊 Estrutura do Arquivo

```
dealmachine-properties-2026-01-10.xlsx
├─ Linha 1: Cabeçalhos (328 colunas)
├─ Linha 2: Dados propriedade 1 + contatos 1-14
├─ Linha 3: Dados propriedade 2 + contatos 1-14
├─ ...
└─ Linha N: Dados propriedade N + contatos 1-14
```

---

## 🔍 Validação de Dados

### Tipos de Dados

- **STRING**: Texto (ex: "123 Main St", "John Smith")
- **INT**: Número inteiro (ex: 3, 2024)
- **FLOAT**: Número decimal (ex: 450000.50, 3.5)
- **BOOLEAN**: Verdadeiro/Falso (true/false, 1/0, yes/no)
- **DATE**: Data (ex: "2024-01-15", "01/15/2024")
- **ENUM**: Valores pré-definidos (ex: "Mobile", "Home", "Work")

### Conversão Automática

O sistema converte automaticamente:
- `"true"` → `true` (boolean)
- `"1"` → `1` (número)
- `""` (vazio) → `null`

---

## 📝 Exemplo de Linha Completa

```
property_id: "DM-12345"
address_line_1: "123 Main Street"
address_line_2: ""
city: "Miami"
state: "FL"
zipcode: "33101"
county: "Miami-Dade"
beds: 3
baths: 2
sqft: 1500
estimated_value: 450000
contact_1_name: "John Smith"
contact_1_phone1: "(305) 555-1234"
contact_1_phone1_type: "Mobile"
contact_1_email1: "john@example.com"
```

---

## ✅ Checklist de Importação

- [ ] Arquivo tem extensão .xlsx
- [ ] Linha 1 contém cabeçalhos
- [ ] Todos os campos obrigatórios preenchidos
- [ ] Nomes de coluna em snake_case
- [ ] Dados começam na linha 2
- [ ] Máximo 14 contatos por propriedade
- [ ] Telefones têm tipo válido (Mobile, Home, Work, Other)
- [ ] Sem caracteres especiais em campos críticos
- [ ] Arquivo não excede 50MB

---

## 🎯 Próximas Etapas Após Importação

1. **Dashboard**: Verifique "Total Properties" aumentou
2. **Properties**: Veja lista de propriedades importadas
3. **Assign Agents**: Atribua agentes a propriedades (se não fez na importação)
4. **Deep Search**: Adicione informações de pesquisa
5. **Tasks**: Crie tarefas para follow-up

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique se todos os campos obrigatórios estão preenchidos
2. Confirme que nomes de coluna estão em snake_case
3. Valide tipos de dados (strings vs números)
4. Procure por caracteres especiais problemáticos
5. Tente com um arquivo menor primeiro (5-10 propriedades)

---

**Versão:** 2.0  
**Data:** Janeiro 2026  
**Compatibilidade:** DealMachine Export Format 328 Colunas
