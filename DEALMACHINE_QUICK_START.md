# 🚀 DealMachine Import - Quick Start Guide

## ⚡ 3 Passos Simples

### 1️⃣ Converter seu arquivo Excel

Seu arquivo DealMachine tem nomes de coluna diferentes do CRM. Use o conversor:

```bash
python3 scripts/convert-dealmachine-excel.py seu-arquivo.xlsx
```

**Resultado:** Novo arquivo `seu-arquivo-converted.xlsx` com nomes de coluna corretos

### 2️⃣ Fazer upload no CRM

1. Abra o CRM
2. Clique em "Import Properties" (na navegação)
3. Selecione o arquivo **convertido** (.xlsx)
4. (Opcional) Escolha um agente para atribuir
5. Clique "Import Properties"

### 3️⃣ Verificar resultado

- Vá para "Dashboard"
- Verifique "Total Properties" aumentou
- Clique em "Properties" para ver a lista

---

## 📋 O que o Conversor Faz

Transforma nomes de coluna DealMachine em nomes que o CRM espera:

| DealMachine | CRM |
|---|---|
| `property_address_line_1` | `addressLine1` |
| `property_address_city` | `city` |
| `property_address_state` | `state` |
| `property_address_zipcode` | `zipcode` |
| `owner_1_name` | `owner1Name` |
| `beds` | `totalBedrooms` |
| `sqft` | `buildingSquareFeet` |
| `contact_1_name` | `contact1Name` |
| ... e mais 300+ campos |

---

## ✅ Campos Obrigatórios

Seu arquivo DEVE ter:
- ✅ `addressLine1` (endereço)
- ✅ `city` (cidade)
- ✅ `state` (estado)
- ✅ `zipcode` (CEP)

Sem estes campos, a importação falhará.

---

## 🔍 Solução de Problemas

### "Imported 0 properties. 1 rows had errors."

**Causa:** Arquivo não foi convertido

**Solução:** Use o conversor Python primeiro

```bash
python3 scripts/convert-dealmachine-excel.py seu-arquivo.xlsx
```

### Arquivo convertido não aparece

**Causa:** Arquivo salvo em local diferente

**Solução:** Verifique o caminho completo

```bash
ls -la seu-arquivo-converted.xlsx
```

### Alguns campos não foram importados

**Causa:** CRM não tem todos os campos do DealMachine

**Solução:** Campos extras são salvos em `dealMachineRawData` (JSON)

---

## 📂 Arquivos Importantes

| Arquivo | Descrição |
|---|---|
| `scripts/convert-dealmachine-excel.py` | Conversor de colunas |
| `DEALMACHINE_FIELD_MAPPING_COMPLETE.md` | Mapeamento completo (328 campos) |
| `DEALMACHINE_IMPORT_GUIDE_V2.md` | Guia detalhado |

---

## 💡 Dicas

1. **Teste com poucos registros primeiro** (5-10 propriedades)
2. **Verifique se o arquivo tem 328 colunas** antes de converter
3. **Nomes de coluna devem estar na linha 1**
4. **Dados começam na linha 2**

---

## 🎯 Exemplo Completo

```bash
# 1. Converter arquivo
python3 scripts/convert-dealmachine-excel.py dealmachine-properties-2026-01-10.xlsx

# 2. Verificar arquivo convertido
ls -la dealmachine-properties-2026-01-10-converted.xlsx

# 3. Fazer upload no CRM
# (Abra o CRM e use "Import Properties")
```

---

**Versão:** 1.0  
**Data:** Janeiro 2026  
**Compatibilidade:** DealMachine 328 Colunas
