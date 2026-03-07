

## Filtros compactos no Drawer (mobile)

### Problema
O Drawer de filtros na página de Pacientes (mobile) usa layout vertical com espaçamento grande (`py-3`, `space-y-6`), forçando rolagem para ver todos os filtros (Procedimento, Hospital, Status).

### Solução
Tornar os filtros mais compactos usando **chips/pills** horizontais em vez de lista vertical, e reduzir espaçamentos entre seções.

### Mudanças em `src/pages/Patients.tsx`

1. **Substituir listas verticais por grid de chips** — cada opção de filtro vira um botão compacto tipo pill/chip que fica highlighted quando selecionado, dispostos em `flex flex-wrap gap-2`
2. **Reduzir espaçamento entre seções** — de `space-y-6` para `space-y-4`, e remover padding excessivo nos itens
3. **Reduzir altura do DrawerContent** — ajustar `max-h` se necessário
4. **Manter a mesma lógica de toggle** — clicar no chip alterna o filtro

Resultado visual: 3 seções compactas (Procedimento, Hospital, Status) todas visíveis sem scroll, com chips coloridos indicando seleção ativa.

