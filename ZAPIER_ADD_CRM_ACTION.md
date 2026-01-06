# 🔌 Adicionar CRM como Segunda Ação no Zapier

## 📋 Resumo

Você já tem um Zapier funcionando:
```
WordPress → Google Sheets ✅
```

Agora vamos adicionar o CRM como uma **segunda ação simultânea**:
```
WordPress → Google Sheets ✅
        ↓
        → CRM (novo!)
```

Ambas as ações acontecem ao mesmo tempo quando um lead é enviado!

---

## Passo a Passo: Adicionar CRM ao Zapier

### Passo 1: Abrir sua Zap Existente

1. Acesse https://zapier.com
2. Clique em **"My Apps"** ou **"Dashboard"**
3. Encontre sua Zap que envia para Google Sheets
4. Clique nela para abrir

### Passo 2: Entrar em Modo de Edição

1. Clique em **"Edit"** (botão de lápis)
2. Você verá o fluxo atual:
   ```
   Trigger: Webhooks by Zapier
   Action 1: Google Sheets
   ```

### Passo 3: Adicionar Segunda Ação

1. Clique em **"+ Add Step"** (ou **"+ Add Action"**)
2. Uma nova seção aparecerá para a **Action 2**

### Passo 4: Escolher Webhooks como Action

1. Procure por **"Webhooks by Zapier"**
2. Selecione **"POST"** (enviar dados)
3. Clique em **"Continue"**

### Passo 5: Configurar o Webhook para o CRM

#### URL do Webhook
Cole a URL do seu CRM:
```
https://3000-i8f8h5o1q55vlroxoeecq-29164bdd.sg1.manus.computer/api/trpc/webhook.submitLead
```

#### Payload Type
Selecione: **"JSON"**

#### Data (Dados a Enviar)

Clique em **"Add value set"** para cada campo e configure assim:

```
{
  "fullName": [Selecione o campo de Nome do seu formulário],
  "email": [Selecione o campo de Email],
  "phone": [Selecione o campo de Telefone],
  "address": [Selecione o campo de Endereço],
  "city": [Selecione o campo de Cidade],
  "state": [Selecione o campo de Estado],
  "zipcode": [Selecione o campo de CEP],
  "propertyType": [Selecione o campo de Tipo de Propriedade],
  "estimatedValue": [Selecione o campo de Valor Estimado],
  "bedrooms": [Selecione o campo de Quartos],
  "bathrooms": [Selecione o campo de Banheiros],
  "squareFeet": [Selecione o campo de Metragem],
  "ownerName": [Selecione o campo de Nome do Proprietário],
  "marketStatus": [Selecione o campo de Status do Mercado],
  "leadTemperature": [Selecione o campo de Temperatura do Lead],
  "notes": [Selecione o campo de Notas/Mensagem]
}
```

### Passo 6: Mapear os Campos

Para cada campo acima:

1. Clique no campo (ex: onde diz "Selecione o campo de Nome")
2. Uma lista de campos disponíveis aparecerá
3. Escolha o campo correspondente do seu formulário

**Exemplo:**
- Campo CRM: `fullName`
- Clique no valor
- Selecione: `Full Name` (ou `Name` - depende do seu formulário)

### Passo 7: Testar a Nova Ação

1. Clique em **"Test & Continue"**
2. Zapier enviará um teste para seu CRM
3. Se funcionar, você verá ✅ (checkmark verde)

### Passo 8: Salvar e Ativar

1. Clique em **"Save & Continue"**
2. Revise toda a Zap:
   ```
   Trigger: Webhooks by Zapier ✅
   Action 1: Google Sheets ✅
   Action 2: CRM Webhook ✅
   ```
3. Clique em **"Turn on Zap"** (se ainda não estiver ativa)

---

## Resultado Final

Agora sua Zap funciona assim:

```
┌─────────────────────────────────────┐
│  WordPress Form Submission          │
│  (Trigger: Webhooks by Zapier)      │
└────────────────┬────────────────────┘
                 │
        ┌────────┴────────┐
        ↓                 ↓
   ┌─────────────┐   ┌──────────────┐
   │ Google      │   │ CRM Webhook  │
   │ Sheets      │   │ (submitLead) │
   │ (Create Row)│   │              │
   └─────────────┘   └──────────────┘
        ✅               ✅
```

**Ambas as ações acontecem simultaneamente!**

---

## Testar a Integração Completa

### Passo 1: Enviar um Lead de Teste

1. Abra seu site WordPress
2. Preencha e envie o formulário com dados de teste
3. Aguarde 30-60 segundos

### Passo 2: Verificar Google Sheets

1. Abra seu Google Sheets
2. Verifique se a nova linha foi adicionada ✅

### Passo 3: Verificar CRM

1. Abra seu CRM
2. Vá para **Properties**
3. Procure pelo novo lead ✅

**Se ambos aparecerem, está funcionando perfeitamente!** 🎉

---

## Monitorar a Zap

### Ver Histórico de Execução

1. Clique na sua Zap
2. Vá para **"Runs"** ou **"History"**
3. Você verá cada execução com:
   - ✅ Trigger executado
   - ✅ Action 1 (Google Sheets) executada
   - ✅ Action 2 (CRM) executada

### Verificar Erros

Se uma ação falhar:
1. Clique na execução
2. Procure pela ação que falhou (marcada em vermelho)
3. Leia a mensagem de erro
4. Ajuste a configuração conforme necessário

---

## Troubleshooting

### ❌ Problema: CRM Action não está sendo executada

**Solução 1: Verificar se a Zap está ativa**
- Abra a Zap
- Verifique se o toggle está **ON** (azul)

**Solução 2: Verificar o mapeamento de campos**
- Clique em **"Edit"**
- Vá para a Action 2 (CRM)
- Verifique se todos os campos estão mapeados corretamente

**Solução 3: Testar novamente**
- Clique em **"Edit"**
- Vá para a Action 2
- Clique em **"Test & Continue"**
- Verifique se o teste passa

### ❌ Problema: Erro 404 (URL não encontrada)

**Solução:**
- Verifique se a URL do CRM está correta
- Certifique-se de que não há espaços extras
- Teste a URL no navegador

### ❌ Problema: Dados incompletos no CRM

**Solução:**
- Verifique o mapeamento de campos
- Alguns campos podem estar vazios se não forem preenchidos no formulário
- Verifique se os nomes dos campos estão corretos

---

## Campos Obrigatórios vs Opcionais

### Obrigatórios (pelo menos um deve ter valor):
- `address` - Endereço
- `city` - Cidade
- `state` - Estado
- `zipcode` - CEP

### Opcionais (mas recomendados):
- `fullName` - Nome completo
- `email` - Email
- `phone` - Telefone
- `propertyType` - Tipo de propriedade
- `estimatedValue` - Valor estimado

Se um campo obrigatório não for preenchido, o CRM usará um valor padrão.

---

## Valores Válidos para Campos Específicos

### marketStatus (Status do Mercado):
```
Off Market, Cash Buyer, Free And Clear, High Equity, Senior Owner,
Tired Landlord, Absentee Owner, Corporate Owner, Empty Nester,
Interested, Not Interested, Follow Up
```

### leadTemperature (Temperatura do Lead):
```
SUPER HOT, HOT, WARM, COLD, TBD, DEAD
```

---

## Exemplo Prático

### Seu Formulário tem estes campos:
```
- Full Name
- Email Address
- Phone Number
- Property Address
- City
- State
- Postal Code
- Property Type
- Estimated Value
- Message
```

### Mapeamento no Zapier:
```
fullName → Full Name
email → Email Address
phone → Phone Number
address → Property Address
city → City
state → State
zipcode → Postal Code
propertyType → Property Type
estimatedValue → Estimated Value
notes → Message
```

### Resultado:
```
✅ Linha adicionada ao Google Sheets
✅ Nova propriedade criada no CRM
✅ Contato adicionado com email e telefone
✅ Status: BIN (pronto para atribuição)
```

---

## Próximos Passos

Depois de configurar a integração CRM:

1. **Monitore os leads** - Verifique o histórico da Zap regularmente
2. **Configure filtros** - Use filtros do Zapier para enviar apenas leads qualificados
3. **Customize os dados** - Use transformadores do Zapier para formatar dados
4. **Crie automações adicionais** - Configure notificações por email, Slack, etc.

---

## Dúvidas Frequentes

**P: Posso usar a mesma Zap para múltiplas ações?**
R: Sim! Você pode adicionar quantas ações quiser (Google Sheets, CRM, Email, Slack, etc.)

**P: As ações acontecem em sequência ou simultaneamente?**
R: Simultaneamente! Todas as ações são executadas ao mesmo tempo.

**P: Posso desativar apenas a ação do CRM?**
R: Não diretamente. Você teria que editar a Zap e remover a ação. Mas pode desativar toda a Zap.

**P: Quanto custa adicionar mais uma ação?**
R: Nada! O Zapier conta cada execução como uma "tarefa". Adicionar mais ações não aumenta o custo.

**P: Posso adicionar mais ações depois?**
R: Sim! Você pode editar a Zap a qualquer momento e adicionar novas ações.

---

## Suporte

Se tiver dúvidas:
1. Verifique este guia novamente
2. Consulte a documentação do Zapier: https://zapier.com/help
3. Entre em contato com o suporte do CRM

**Boa sorte com sua integração! 🚀**
