# Clientes e relatórios da equipe

- **Empresa → Equipe:** cadastra o email exato de login, escolhe os clientes e salva as rotas. Para retirar um cliente do funcionário, edita as rotas e desmarca esse cliente. Os relatórios recebidos continuam pertencendo à empresa.
- **Funcionário:** ao entrar com o email confirmado vinculado, recebe o modo funcionário automaticamente, independentemente do tipo antigo da conta. Vê suas rotas, realiza limpezas e ocorrências e altera sua foto. Não cadastra, edita ou exclui clientes e relatórios, nem envia produtos ao cliente.
- **Equipe → Relatórios recebidos:** mostra atendimentos enviados pelos funcionários, com filtro por responsável e acesso a parâmetros, fotos e PDF. Também há um atalho no cartão de cada funcionário.
- **Equipe → Alertas:** recebe os produtos faltantes. A empresa pode revisar nomes, quantidades e preços, salvar a revisão e abrir o WhatsApp para encaminhar ao cliente com ou sem valores. O app não envia mensagens automaticamente.

Os produtos de atendimentos da equipe ficam em `alertas_produtos`, protegidos por RLS para a empresa. O relatório e a edição recuperam esses itens apenas para o responsável. Repetir uma sincronização não sobrescreve uma revisão já feita pela empresa.

Scripts incrementais, após as migrações anteriores: `scripts/controle-equipe.sql` e `scripts/produtos-restritos-empresa.sql`. Não recriam contas nem apagam relatórios.
