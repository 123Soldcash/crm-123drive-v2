# 📥 Como Usar o Importador DealMachine

## Guia Rápido e Simples (ADHD-Friendly)

---

## ✅ 3 Passos Simples

### 1️⃣ Coloque seu arquivo Excel no servidor

Faça upload do arquivo DealMachine (.xlsx) para:
```
/home/ubuntu/upload/
```

### 2️⃣ Execute o comando

```bash
cd /home/ubuntu/crm-123drive-v2
node scripts/import-dealmachine-simple.mjs /home/ubuntu/upload/SEU_ARQUIVO.xlsx
```

### 3️⃣ Aguarde e pronto!

O script importa automaticamente:
- ✅ Propriedades
- ✅ Contatos (até 20 por propriedade)
- ✅ Telefones (até 3 por contato)
- ✅ Emails (até 3 por contato)

---

## 📊 Exemplo Real

```bash
# Importar o arquivo Rolando
node scripts/import-dealmachine-simple.mjs /home/ubuntu/upload/dealmachine-properties-2026-01-12-220953_rolando.xlsx
```

**Resultado:**
```
✅ IMPORT COMPLETE!
  • Properties: 252
  • Contacts: 1,021
  • Phones: 1,329
  • Emails: 1,444
```

---

## 🎯 O que acontece automaticamente?

**FASE 1:**
- Importa propriedades com todos os dados do Excel
- Importa TODOS os 20 contatos por propriedade
- Importa TODOS os 3 telefones por contato
- Importa TODOS os 3 emails por contato
- Salva property flags (High Equity, Off Market, etc.)

**FASE 2:**
- Converte GPS em endereços completos (Google Maps)
- Preenche endereços que estavam vazios no Excel

---

## ⚠️ Importante

- ✅ **Não cria duplicatas** - pula propriedades que já existem
- ✅ **100% automático** - não precisa configurar nada
- ✅ **Seguro** - pode executar múltiplas vezes sem problemas

---

## 🆘 Problemas?

**Erro: "File not found"**
→ Verifique o caminho do arquivo

**Erro: "Database connection failed"**
→ Verifique se o CRM está rodando

**Propriedades duplicadas**
→ Normal! O script pula automaticamente

---

## 📝 Próximos Passos

Após importar:

1. Acesse `/properties` no CRM
2. Veja suas propriedades importadas
3. Use os filtros de Property Flags
4. Crie Saved Searches

---

**Simples assim! 🎉**
