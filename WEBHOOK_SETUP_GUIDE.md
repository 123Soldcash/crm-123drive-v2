# 🔗 Guia Completo: Configurar Webhook WordPress/Elementor → CRM

## 📋 Índice
1. [Pré-requisitos](#pré-requisitos)
2. [Encontrar sua URL do CRM](#encontrar-sua-url-do-crm)
3. [Configurar Webhook no Elementor](#configurar-webhook-no-elementor)
4. [Mapear Campos do Formulário](#mapear-campos-do-formulário)
5. [Testar a Integração](#testar-a-integração)
6. [Troubleshooting](#troubleshooting)

---

## Pré-requisitos

✅ Você tem acesso ao painel do WordPress  
✅ Você tem um formulário criado no Elementor  
✅ Você tem acesso ao seu CRM (Manus)  
✅ Elementor Pro (versão com suporte a webhooks)

---

## Encontrar sua URL do CRM

### Passo 1: Abrir o CRM
1. Acesse seu CRM em: https://seu-crm-domain.manus.space
2. Copie a URL completa da barra de endereços

### Exemplo de URL do CRM:
```
https://3000-i8f8h5o1q55vlroxoeecq-29164bdd.sg1.manus.computer
```

### Passo 2: Construir a URL do Webhook
Adicione `/api/trpc/webhook.submitLead` ao final da sua URL:

```
https://3000-i8f8h5o1q55vlroxoeecq-29164bdd.sg1.manus.computer/api/trpc/webhook.submitLead
```

**SALVE ESTA URL - você vai precisar dela!**

---

## Configurar Webhook no Elementor

### Passo 1: Abrir o Formulário no Elementor

1. Acesse seu WordPress Dashboard
2. Vá para **Elementor** → **Meus Templates** (ou a página com seu formulário)
3. Clique em **Editar com Elementor**
4. Clique no formulário para selecioná-lo

### Passo 2: Acessar Configurações do Formulário

1. Com o formulário selecionado, clique em **Editar Formulário** (ícone de engrenagem)
2. Na janela que abrir, clique na aba **Ações Após Envio** (After Submit)
3. Procure por **Webhooks** na lista de ações

### Passo 3: Adicionar um Novo Webhook

1. Clique em **+ Adicionar Ação** → **Webhooks**
2. Uma nova seção de webhook aparecerá

### Passo 4: Configurar o Webhook

Preencha os seguintes campos:

| Campo | Valor |
|-------|-------|
| **Nome do Webhook** | CRM Lead Submission |
| **URL do Webhook** | `https://seu-crm-domain.com/api/trpc/webhook.submitLead` |
| **Método de Requisição** | POST |
| **Tipo de Conteúdo** | application/json |

---

## Mapear Campos do Formulário

### Passo 1: Adicionar Campos para Enviar

Na seção de webhook, você verá **"Dados para Enviar"** (Data to Send):

1. Clique em **+ Adicionar Campo**
2. Selecione um campo do seu formulário (ex: "Nome")
3. Escolha o campo CRM correspondente

### Passo 2: Mapeamento Recomendado

Aqui está como mapear seus campos Elementor para o CRM:

```
Formulário Elementor          →    Campo CRM
─────────────────────────────────────────────
Nome                          →    fullName
Email                         →    email
Telefone                      →    phone
Endereço                      →    address
Cidade                        →    city
Estado                        →    state
CEP/Código Postal             →    zipcode
Tipo de Propriedade           →    propertyType
Valor Estimado                →    estimatedValue
Quartos                       →    bedrooms
Banheiros                     →    bathrooms
Metragem (sq ft)              →    squareFeet
Nome do Proprietário          →    ownerName
Localização do Proprietário   →    ownerLocation
Status do Mercado             →    marketStatus
Temperatura do Lead           →    leadTemperature
Notas Adicionais              →    notes
```

### Passo 3: Exemplo Visual

```
┌─────────────────────────────────────────┐
│ Dados para Enviar                       │
├─────────────────────────────────────────┤
│ Campo Elementor  │  Campo CRM           │
├──────────────────┼──────────────────────┤
│ Nome Completo    │  fullName            │
│ Email            │  email               │
│ Telefone         │  phone               │
│ Endereço         │  address             │
│ Cidade           │  city                │
│ Estado           │  state               │
│ CEP              │  zipcode             │
└─────────────────────────────────────────┘
```

---

## Testar a Integração

### Passo 1: Salvar o Formulário

1. Clique em **Salvar** no Elementor
2. Clique em **Publicar** ou **Atualizar**

### Passo 2: Testar com um Lead de Teste

1. Abra seu site WordPress em uma aba nova
2. Localize o formulário
3. Preencha com dados de teste:
   ```
   Nome: João Silva
   Email: joao@teste.com
   Telefone: (11) 99999-9999
   Endereço: 123 Rua Principal
   Cidade: Fort Lauderdale
   Estado: FL
   CEP: 33312
   ```
4. Clique em **Enviar**

### Passo 3: Verificar no CRM

1. Abra seu CRM
2. Vá para **Properties** (Propriedades)
3. Procure pelo lead "João Silva"
4. Verifique se todos os dados foram preenchidos corretamente

**Sucesso!** ✅ Se o lead apareceu, o webhook está funcionando!

---

## Valores Válidos para Campos Específicos

### marketStatus (Status do Mercado)

Escolha um destes valores:
- `Off Market`
- `Cash Buyer`
- `Free And Clear`
- `High Equity`
- `Senior Owner`
- `Tired Landlord`
- `Absentee Owner`
- `Corporate Owner`
- `Empty Nester`
- `Interested`
- `Not Interested`
- `Follow Up`

### leadTemperature (Temperatura do Lead)

Escolha um destes valores:
- `SUPER HOT` 🔥🔥
- `HOT` 🔥
- `WARM` 🌡️
- `COLD` ❄️
- `TBD` (A Determinar)
- `DEAD` ☠️

---

## Troubleshooting

### ❌ Problema: O lead não aparece no CRM

**Solução 1: Verificar a URL do Webhook**
- Copie a URL novamente com cuidado
- Certifique-se de que não há espaços extras
- Verifique se a URL começa com `https://`

**Solução 2: Verificar os Logs do WordPress**
1. Acesse seu servidor via FTP ou File Manager
2. Abra `/wp-content/debug.log`
3. Procure por erros relacionados a webhooks

**Solução 3: Testar o Webhook Manualmente**
Use este comando no terminal:
```bash
curl -X POST https://seu-crm-domain.com/api/trpc/webhook.submitLead \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Teste",
    "email": "teste@example.com",
    "phone": "+1234567890",
    "address": "123 Main St",
    "city": "Fort Lauderdale",
    "state": "FL",
    "zipcode": "33312"
  }'
```

### ❌ Problema: Erro 404 (URL não encontrada)

**Solução:**
- Verifique se a URL do CRM está correta
- Certifique-se de que o CRM está online
- Tente acessar a URL no navegador para confirmar

### ❌ Problema: Erro 500 (Erro do servidor)

**Solução:**
- Verifique se todos os campos obrigatórios estão sendo enviados
- Certifique-se de que os valores de enum (marketStatus, leadTemperature) são válidos
- Verifique os logs do CRM

### ❌ Problema: Dados incompletos no CRM

**Solução:**
- Verifique o mapeamento de campos
- Certifique-se de que o nome do campo Elementor corresponde ao nome do campo CRM
- Alguns campos podem estar vazios se não forem preenchidos no formulário

---

## Campos Opcionais vs Obrigatórios

**Obrigatórios no CRM:**
- `address` (Endereço)
- `city` (Cidade)
- `state` (Estado)
- `zipcode` (CEP)

**Opcionais (mas recomendados):**
- `fullName` ou `firstName` + `lastName`
- `email`
- `phone`
- `propertyType`
- `estimatedValue`
- `bedrooms`
- `bathrooms`

Se um campo obrigatório não for preenchido no formulário, o webhook usará um valor padrão.

---

## Exemplo Completo: Formulário de Contato

### Seu Formulário Elementor tem:
```
- Nome Completo
- Email
- Telefone
- Endereço da Propriedade
- Cidade
- Estado
- CEP
- Tipo de Propriedade
- Valor Estimado
- Mensagem
```

### Mapeamento para o CRM:
```json
{
  "fullName": "João Silva",
  "email": "joao@example.com",
  "phone": "(11) 99999-9999",
  "address": "123 Rua Principal",
  "city": "Fort Lauderdale",
  "state": "FL",
  "zipcode": "33312",
  "propertyType": "Single Family Home",
  "estimatedValue": 275000,
  "notes": "Mensagem do cliente aqui"
}
```

### Resultado no CRM:
✅ Nova propriedade criada  
✅ Contato adicionado com email e telefone  
✅ Status: BIN (pronto para atribuição)  
✅ Notas adicionadas  

---

## Próximos Passos

Depois de configurar o webhook:

1. **Teste com vários leads** - Envie alguns testes para confirmar que está funcionando
2. **Configure notificações** - Receba alertas quando novos leads chegam
3. **Atribua desks** - Configure desks (Sales, Follow-up, etc.) para organizar o trabalho
4. **Crie tarefas automáticas** - Configure tarefas que se criam automaticamente para cada novo lead

---

## Suporte

Se tiver dúvidas ou problemas:
1. Verifique este guia novamente
2. Consulte a seção Troubleshooting
3. Entre em contato com o suporte do CRM

**Boa sorte com sua integração! 🚀**
