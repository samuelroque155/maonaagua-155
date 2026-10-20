# Migração dos trechos restantes do Firebase

## Estado

O código local usa somente Supabase. A dependência `firebase` e o módulo de inicialização foram removidos. Ainda não foi publicado.

**SQL aplicado ao projeto `mao-na-agua` (`gltstspgyzevjygtefnq`) em 20/10/2026**, após autorização explícita do responsável. Migração registrada: `20261020173538_migrar_equipe_alertas_fila_supabase`.

A conferência após a aplicação confirmou os mesmos 8 clientes e 11 visitas, autoria preenchida nas 11 visitas, tabela de alertas criada, gatilhos presentes e RLS habilitado nas quatro tabelas envolvidas. A RPC permite execução por usuários autenticados e bloqueia o papel anônimo. O código do aplicativo ainda não foi publicado.

O advisor de segurança retornou somente o aviso de proteção contra senhas vazadas desativada no Supabase Auth. Essa configuração não foi alterada nesta migração. Referência: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Alterações

- `equipes_links` passa a guardar nome, email e rotas numa única linha. Cadastro, edição e exclusão usam a sessão Supabase.
- A RPC `contexto_equipe` identifica o funcionário pelo email confirmado no servidor. Os campos de vínculo no perfil ou nos metadados editáveis não concedem acesso.
- O responsável vê seus clientes e relatórios. O funcionário vê somente os clientes atribuídos de uma empresa habilitada e pode inserir visitas nessas rotas. A edição de visitas finalizadas continua restrita ao responsável.
- Fotos permanecem no bucket privado `fotos-visitas`. A empresa pode abrir as fotos referenciadas nas visitas de seus clientes; funcionários só acessam fotos das rotas atribuídas e seus próprios uploads.
- Produtos faltantes geram alertas na mesma transação da visita. O responsável pode marcar o alerta como resolvido.
- A ocorrência técnica é guardada primeiro no IndexedDB, com UUID estável, conta de origem e empresa. A sincronização envia fotos ao Storage, grava a visita e confirma sua identidade antes de remover a cópia local.
- A fila é filtrada pela conta que criou cada registro. Uploads confirmados têm checkpoints e são reutilizados após falhas. Registros sem autoria permanecem no aparelho e aparecem como pendências antigas para revisão.
- O código antigo que sobrescrevia a lista inteira de clientes no Firestore foi removido. Cadastro e edição continuam usando a tabela `clientes`, por registro.
- Ocorrências têm `tipo = 'problema'`, aparecem nos relatórios e não contam como uma limpeza concluída.

## Banco

O script é transacional. Acrescenta `nome` em `equipes_links`, `tipo` e `criado_por` em `visitas`, `adiado_para` em `clientes`, a tabela `alertas_produtos` e helpers privados. Nas visitas anteriores, `criado_por` recebe `user_id`: não é possível reconstruir um autor histórico que não foi registrado.

Substitui as políticas de INSERT/UPDATE de visitas para validar também o cliente e a autoria. Acrescenta permissões de leitura por rota e de leitura de fotos referenciadas. As políticas pessoais de clientes, perfis e fotos são preservadas. Nenhuma assinatura é ativada pela migração.

O banco consultado antes da alteração tinha 8 clientes, 11 visitas e nenhum vínculo de equipe. Os registros foram preservados; somente o preenchimento de autoria e os novos campos padrão foram aplicados às visitas existentes.

Este trabalho migra os fluxos do aplicativo. Não copia automaticamente documentos, contas ou arquivos históricos do Firebase: isso exige exportação e um mapeamento confirmado entre os IDs antigos e os usuários/clientes do Supabase. O arquivo local de backup preexistente foi preservado.

## Validação

```powershell
node --test tests/*.test.mjs
npm.cmd run lint
npm.cmd run build
```

`tests/migracaoSupabase.test.mjs` executa o SQL completo em um Postgres PGlite isolado, com roles, sessões e RLS. Verifica convites, rotas de outra empresa, criação de visita, alertas, fotos, email não confirmado, suspensão e revogação. Os testes da fila verificam falhas de rede, checkpoints, isolamento de contas e confirmação antes da remoção local.

As tabelas, permissões e os advisors já foram conferidos no projeto após a aplicação. Ainda falta testar no aplicativo com duas contas de teste: uma empresa e um funcionário. Validar atribuição/remoção de rotas, ocorrência offline, retorno da conexão e abertura das fotos no relatório da empresa. A validação isolada não substitui esse teste no ambiente conectado nem um teste Android real.

Referência: [controle de acesso com RLS no Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).
