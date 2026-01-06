# 🔌 Guia Completo: Integrar WordPress/Elementor com CRM via Zapier

## 📋 Índice
1. [Por que usar Zapier?](#por-que-usar-zapier)
2. [Pré-requisitos](#pré-requisitos)
3. [Criar uma Zap](#criar-uma-zap)
4. [Configurar Trigger (Elementor)](#configurar-trigger-elementor)
5. [Configurar Action (CRM Webhook)](#configurar-action-crm-webhook)
6. [Testar e Ativar](#testar-e-ativar)
7. [Troubleshooting](#troubleshooting)

---

## Por que usar Zapier?

✅ **Mais confiável** - Zapier gerencia a conexão e retries automáticos  
✅ **Sem código** - Interface visual e intuitiva  
✅ **Histórico de execução** - Veja cada lead que foi enviado  
✅ **Filtros e transformações** - Customize os dados antes de enviar  
✅ **Suporte 24/7** - Zapier tem excelente documentação  
✅ **Múltiplas tentativas** - Se falhar, tenta novamente automaticamente  

---

## Pré-requisitos

✅ Conta no Zapier (https://zapier.com) - Plano gratuito funciona!  
✅ Formulário Elementor no WordPress  
✅ URL do seu CRM  
✅ Acesso ao painel do WordPress  

---

## Criar uma Zap

### Passo 1: Acessar Zapier

1. Vá para https://zapier.com
2. Clique em **Sign Up** (se não tiver conta)
3. Faça login na sua conta

### Passo 2: Criar Nova Zap

1. Clique em **Create** (botão laranja no canto superior)
2. Você verá a tela de criar uma nova automação

---

## Configurar Trigger (Elementor)

### Passo 1: Escolher o Trigger

1. Na seção **Trigger**, procure por **"Elementor"**
2. Se não encontrar, procure por **"Webhooks by Zapier"** (alternativa)

### Opção A: Usando Elementor (Recomendado)

1. Selecione **Elementor**
2. Escolha o evento: **"Form Submission"** (Envio de Formulário)
3. Clique em **Continue**

### Opção B: Usando Webhooks (Se Elementor não aparecer)

1. Procure por **"Webhooks by Zapier"**
2. Escolha **"Catch Raw Hook"**
3. Clique em **Continue**

### Passo 2: Conectar sua Conta Elementor

1. Clique em **"Connect"** ou **"Sign in"**
2. Faça login na sua conta WordPress/Elementor
3. Autorize o Zapier a acessar seus formulários
4. Clique em **Continue**

### Passo 3: Selecionar o Formulário

1. Escolha o site WordPress na lista
2. Selecione o **formulário específico** que você quer integrar
3. Clique em **Continue**

### Passo 4: Testar o Trigger

1. Zapier pedirá para você enviar um teste do formulário
2. Abra seu site WordPress em outra aba
3. Preencha o formulário com dados de teste
4. Envie o formulário
5. Volte ao Zapier e clique em **"Test Trigger"**
6. Se funcionar, você verá os dados do formulário aparecerem

---

## Configurar Action (CRM Webhook)

### Passo 1: Escolher a Action

1. Na seção **Action**, procure por **"Webhooks by Zapier"**
2. Escolha **"POST"** (enviar dados)
3. Clique em **Continue**

### Passo 2: Conectar Webhooks

1. Clique em **"Connect"** (se necessário)
2. Não precisa de autenticação para webhooks
3. Clique em **Continue**

### Passo 3: Configurar o Webhook

Preencha os seguintes campos:

#### URL
```
https://3000-i8f8h5o1q55vlroxoeecq-29164bdd.sg1.manus.computer/api/trpc/webhook.submitLead
```

#### Payload Type
Selecione: **"JSON"**

#### Data
Aqui você vai mapear os campos do formulário para o CRM. Clique em **"Add Field"** para cada campo:

```json
{
  "fullName": "Nome Completo do Formulário",
  "email": "Email do Formulário",
  "phone": "Telefone do Formulário",
  "address": "Endereço do Formulário",
  "city": "Cidade do Formulário",
  "state": "Estado do Formulário",
  "zipcode": "CEP do Formulário",
  "propertyType": "Tipo de Propriedade",
  "estimatedValue": "Valor Estimado",
  "bedrooms": "Quartos",
  "bathrooms": "Banheiros",
  "squareFeet": "Metragem",
  "ownerName": "Nome do Proprietário",
  "marketStatus": "Status do Mercado",
  "leadTemperature": "Temperatura do Lead",
  "notes": "Mensagem/Notas"
}
```

### Passo 4: Mapear Campos do Formulário

Para cada campo acima, você precisa:

1. Clique no campo de valor (ex: "Nome Completo do Formulário")
2. Uma lista de campos do seu formulário aparecerá
3. Selecione o campo correspondente

#### Exemplo de Mapeamento:

| Campo CRM | Campo Elementor | Como Selecionar |
|-----------|-----------------|-----------------|
| fullName | Nome Completo | Clique e escolha "Full Name" ou "Name" |
| email | Email | Clique e escolha "Email" |
| phone | Telefone | Clique e escolha "Phone" ou "Phone Number" |
| address | Endereço | Clique e escolha "Address" |
| city | Cidade | Clique e escolha "City" |
| state | Estado | Clique e escolha "State" ou "Province" |
| zipcode | CEP | Clique e escolha "Postal Code" ou "Zip" |

### Passo 5: Exemplo Visual no Zapier

```
┌─────────────────────────────────────────────────┐
│ Data to Send (Dados para Enviar)                │
├─────────────────────────────────────────────────┤
│ fullName: [Selecione] Full Name                 │
│ email: [Selecione] Email Address                │
│ phone: [Selecione] Phone Number                 │
│ address: [Selecione] Address                    │
│ city: [Selecione] City                          │
│ state: [Selecione] State                        │
│ zipcode: [Selecione] Postal Code                │
│ propertyType: [Selecione] Property Type         │
│ estimatedValue: [Selecione] Estimated Value     │
└─────────────────────────────────────────────────┘
```

---

## Testar e Ativar

### Passo 1: Testar o Webhook

1. Clique em **"Test & Continue"**
2. Zapier enviará um teste para seu CRM
3. Se funcionar, você verá uma mensagem de sucesso

### Passo 2: Revisar e Ativar

1. Revise toda a configuração
2. Dê um nome para sua Zap (ex: "WordPress Elementor → CRM")
3. Clique em **"Turn on Zap"** (botão azul)

### Passo 3: Confirmar que Está Funcionando

1. Abra seu site WordPress
2. Preencha e envie o formulário com dados de teste
3. Aguarde 30 segundos
4. Abra seu CRM e verifique se o lead apareceu em **Properties**

**Sucesso!** ✅ Se o lead apareceu, a integração está funcionando!

---

## Estrutura de Dados Esperada

### Campos Obrigatórios (pelo menos um deve ter valor):
- `address` - Endereço
- `city` - Cidade
- `state` - Estado
- `zipcode` - CEP

### Campos Opcionais (mas recomendados):
- `fullName` - Nome completo
- `email` - Email
- `phone` - Telefone
- `propertyType` - Tipo de propriedade
- `estimatedValue` - Valor estimado
- `bedrooms` - Quartos
- `bathrooms` - Banheiros
- `squareFeet` - Metragem quadrada

### Valores Válidos para Enums

**marketStatus:**
```
Off Market, Cash Buyer, Free And Clear, High Equity, Senior Owner, 
Tired Landlord, Absentee Owner, Corporate Owner, Empty Nester, 
Interested, Not Interested, Follow Up
```

**leadTemperature:**
```
SUPER HOT, HOT, WARM, COLD, TBD, DEAD
```

---

## Monitorar a Zap

### Ver Histórico de Execução

1. Clique na sua Zap
2. Vá para **"Runs"** ou **"History"**
3. Você verá cada lead que foi enviado
4. Clique em um para ver detalhes

### Desativar ou Editar

1. Clique na sua Zap
2. Para **desativar**: Clique no toggle (on/off)
3. Para **editar**: Clique em **"Edit"**

---

## Troubleshooting

### ❌ Problema: Zap não está enviando dados

**Solução 1: Verificar se a Zap está ativa**
- Abra a Zap e verifique se o toggle está **ON** (azul)
- Se estiver OFF, clique para ativar

**Solução 2: Verificar o histórico de execução**
1. Clique na Zap
2. Vá para **"Runs"**
3. Procure por erros (mensagens em vermelho)
4. Clique no erro para ver detalhes

**Solução 3: Testar novamente**
1. Clique em **"Edit"**
2. Vá até o final
3. Clique em **"Test & Continue"** novamente
4. Envie um formulário de teste

### ❌ Problema: Erro 404 (URL não encontrada)

**Solução:**
- Verifique se a URL do webhook está correta
- Certifique-se de que não há espaços extras
- Teste a URL no navegador para confirmar que o CRM está online

### ❌ Problema: Dados incompletos no CRM

**Solução:**
- Verifique o mapeamento de campos na Zap
- Certifique-se de que você selecionou o campo correto do formulário
- Alguns campos podem estar vazios se não forem preenchidos no formulário

### ❌ Problema: Elementor não aparece em Zapier

**Solução:**
1. Use a opção **"Webhooks by Zapier"** em vez de Elementor
2. Escolha **"Catch Raw Hook"**
3. Copie a URL do webhook que Zapier gera
4. Vá para seu formulário Elementor
5. Configure um webhook manual com essa URL

---

## Exemplo Completo: Passo a Passo Visual

### Seu Formulário Elementor:
```
[Nome Completo] _______________
[Email] _______________
[Telefone] _______________
[Endereço] _______________
[Cidade] _______________
[Estado] _______________
[CEP] _______________
[Tipo de Propriedade] _______________
[Valor Estimado] _______________
[Enviar]
```

### Mapeamento no Zapier:
```
fullName → Nome Completo
email → Email
phone → Telefone
address → Endereço
city → Cidade
state → Estado
zipcode → CEP
propertyType → Tipo de Propriedade
estimatedValue → Valor Estimado
```

### Resultado no CRM:
```
✅ Nova propriedade criada
✅ Contato adicionado com email e telefone
✅ Status: BIN (pronto para atribuição)
✅ Dados completos e organizados
```

---

## Próximos Passos

Depois de configurar a integração Zapier:

1. **Monitore os leads** - Verifique o histórico de execução da Zap
2. **Customize os filtros** - Use filtros do Zapier para enviar apenas leads qualificados
3. **Adicione múltiplas ações** - Configure o Zapier para enviar notificações por email também
4. **Configure desks** - Atribua os leads a desks específicos no CRM

---

## Plano Gratuito vs Pago

### Plano Gratuito do Zapier:
- ✅ Até 100 tarefas por mês
- ✅ Até 5 Zaps ativas
- ✅ Suporte por email

### Plano Pago (Starter - $19.99/mês):
- ✅ Até 750 tarefas por mês
- ✅ Até 20 Zaps ativas
- ✅ Suporte prioritário

Para a maioria dos casos, o **plano gratuito é suficiente**!

---

## Suporte

Se tiver dúvidas:
1. Verifique este guia novamente
2. Consulte a documentação do Zapier: https://zapier.com/help
3. Entre em contato com o suporte do CRM

**Boa sorte com sua integração Zapier! 🚀**
