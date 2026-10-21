# Validação local: agenda, adiamentos e produtos

Publicação autorizada em 21/10/2026. Migração `agenda_adiamentos_visitas` aplicada no Supabase de produção antes do envio do código. Nenhum registro real foi criado, excluído ou usado em testes, e nenhuma mensagem foi enviada.

## Causas e correções

| Problema | Causa identificada | Comportamento preparado |
|---|---|---|
| Piscinas de segunda apareciam na quarta | A conclusão e a pausa eram condições alternativas ao dia agendado | A lista de hoje considera apenas a recorrência daquele dia ou um reagendamento com data exata, descontando conclusões e adiamentos |
| Contador diferente da lista | Funcionário iniciava em todas as rotas, enquanto o contador usava outro filtro | A tela abre nas pendências de hoje. Contador e lista usam `resumirAgendaDia`. Todas as rotas ficam em uma consulta separada, sem permitir iniciar uma limpeza fora da agenda |
| Troca de dia pouco clara | Regras misturavam o relógio local e datas de conclusão de outros dias | O calendário usa `America/Sao_Paulo`, timer até a meia-noite e atualização ao retornar do segundo plano |
| Aviso de registros antigos na página inicial | Um aviso informativo era mostrado permanentemente | Somente esse aviso foi retirado. Os registros locais continuam preservados e não são enviados sem identificar a conta. Erros de conexão e sincronização continuam visíveis |
| Adiar sem perder recorrência | O antigo campo numérico não representava uma ocorrência com data | Um histórico separado registra a ocorrência original, o motivo, o comparecimento, a nova data e a foto opcional |
| Produtos depois de finalizar | A lista simples estava disponível durante o atendimento | O histórico da visita finalizada agora oferece uma mensagem curta, sem preços, usando somente os produtos daquela visita |

Uma limpeza concluída permanece no histórico e na agenda semanal, mas sai da lista de pendências. Adiar não cria uma limpeza concluída. Quando a nova data coincide com um dia fixo do mesmo cliente, há uma única pendência naquela data. A programação recorrente seguinte permanece intacta.

## Como validar a interface sem dados reais

No computador deste projeto:

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5181
```

Abra `http://127.0.0.1:5181/dev/agenda-preview.html`. A prévia usa somente dados fictícios em memória. Recarregar a página restaura os exemplos. Não use a página inicial normal para testar gravações reais antes de preparar um Supabase de desenvolvimento.

1. Em 21/10/2026, confira duas piscinas pendentes. O cliente de segunda não aparece.
2. Use “Finalizar Ana (simulação)”: o contador cai para um e a Ana sai da lista.
3. Use “Avançar um dia”: em 22/10 não há programação, o contador fica zero e aparece “Nenhuma piscina para limpar hoje.”.
4. Recarregue a prévia. Abra “Adiar visita” de Ana, informe motivo e uma nova data. Foto é opcional. Depois de confirmar, Ana sai da pendência original.
5. Avance até a data escolhida: Ana reaparece uma única vez. Finalize a simulação para removê-la das pendências.
6. Em “Histórico de Ana”, escolha “Relatório do mês”: o adiamento continua visível junto da limpeza finalizada, com suas datas e motivo.
7. Clique em “Enviar produtos a repor pelo WhatsApp”: a prévia mostra o texto em um diálogo local, sem abrir conversa nem enviar mensagem.
8. Use “Testar como funcionário”: ele pode iniciar/adiar as rotas do dia, mas o envio ao cliente permanece com a empresa. A consulta “todas as rotas” mostra o cadastro separado das pendências.

O formulário e a agenda foram conferidos também com largura de 360 pixels. A página de prévia não entra no build de produção do Vite.

## Migração SQL aplicada após autorização

Arquivo: `scripts/adiamentos-visitas.sql`.

O script depende das migrações anteriores de equipe já existentes no projeto e executa uma transação com:

- Nova tabela `adiamentos_visitas`: UUID, empresa/proprietário, autor, cliente, data e horário originais, motivo, nova data, horário do registro, comparecimento e caminho da foto.
- Restrição de uma ocorrência por empresa/cliente/data original, impedindo adiamentos duplicados. Uma nova remarcação da data reagendada gera outro evento histórico, sem apagar o anterior.
- Políticas RLS: empresa/autônomo acessam seus próprios clientes; funcionário somente as rotas vinculadas ao seu email confirmado. Não há permissão de atualizar ou excluir eventos históricos pela API.
- Trigger que valida a visita de hoje, a nova data futura, a programação, a autoria e a foto da própria conta. Datas de registro/comparecimento são fixadas pelo servidor; o horário original vem do cadastro.
- Validação que impede adiar uma limpeza já concluída e impede registrar uma limpeza nova na ocorrência que já foi adiada. A trava do cliente coordena operações concorrentes.
- Política de leitura das fotos privadas dos adiamentos para a empresa e a equipe autorizada, no bucket existente `fotos-visitas`.
- RPC `conclusoes_agenda`: retorna somente identificador, cliente e data de conclusão. Assim, um funcionário reconhece uma rota já concluída por outro responsável sem receber os produtos ou o relatório privado dele.

O script não altera dias fixos, autenticação, perfis, assinaturas, visitas, produtos ou fotos existentes. Não converte automaticamente antigos campos de dia da semana em datas futuras, pois isso inventaria uma ocorrência que não foi registrada.

**Situação atual:** migração aplicada ao projeto de produção após aprovação. As permissões foram conferidas e o diagnóstico de segurança não apontou problemas novos nesta migração. Não é necessário criar outro bucket, configurar assinaturas, modificar Google Login ou adicionar variáveis de ambiente.

Até aplicar a migração no ambiente de desenvolvimento, o aplicativo normal informa que os adiamentos não puderam ser carregados e desabilita o botão de reagendar. Históricos antigos continuam acessíveis quando a nova tabela ainda não existe. Falhas de rede reais continuam sendo informadas.

## Arquivos alterados

| Arquivos | Finalidade |
|---|---|
| `src/services/agendaService.js` | Datas brasileiras, meia-noite, recorrência, conclusão e contador compartilhado |
| `src/context/AppContext.jsx`, `src/App.jsx` | Relógio, leitura/atualização da agenda, salvamento do adiamento, fotos e composição do histórico |
| `src/pages/Home.jsx`, `src/pages/Agenda.jsx` | Pendências corretas, aviso removido, agenda semanal com datas, ação de adiar |
| `src/pages/AdiarVisita.jsx`, `src/services/adiamentoService.js` | Novo formulário, foto opcional, sessão verificada e confirmação idempotente do registro |
| `src/pages/VerRelatorio.jsx`, `src/services/adiamentoRelatorio.js`, `src/services/pdfService.js` | Adiamentos no histórico/PDF, mensagem de produtos da visita finalizada e download alternativo quando o navegador recusa compartilhar PDF |
| `src/services/whatsappService.js` | Nova mensagem simples; opção anterior com valores preservada |
| `src/services/equipeService.js`, `src/pages/GestaoEquipe.jsx` | Adiamentos dos funcionários também aparecem nos relatórios recebidos pela empresa |
| `scripts/adiamentos-visitas.sql` | Estrutura e permissões descritas acima |
| `tests/agendaAdiamentos.test.mjs`, `tests/adiamentosRls.test.mjs`, `tests/adiamentoPdf.test.mjs` | Casos novos da agenda, serviços, SQL, RLS e PDFs |
| `tests/helpers/supabaseFixture.mjs`, `tests/migracaoSupabase.test.mjs` | Fixture compartilhada do Postgres descartável, preservando os testes anteriores |
| `dev/agenda-preview.html`, `dev/agenda-preview.jsx` | Prévia navegável sem gravação em contas reais |

## Verificações realizadas

Resultado final: **64 testes aprovados**, `npm.cmd run build` concluído e lint com **zero erros** (33 avisos de variáveis/importações já existentes no projeto). Nenhum pacote foi adicionado.

- Virada de 23:59:59 para 00:00 no Brasil, inclusive com horário UTC já no dia seguinte, e retorno de aba suspensa.
- Dia sem cadastro, dias em texto/número, conclusão, novo cadastro e contador usando os mesmos clientes da lista.
- Adiamento, reagendamento em cadeia, coincidência com recorrência, conclusão posterior e preservação do histórico.
- SQL e RLS reais em Postgres isolado (PGlite): três perfis, conta errada, autoria forjada, cliente de outra empresa, foto privada, revogação de rota, recusa de duplicação, acesso anônimo bloqueado e eventos históricos imutáveis.
- Mensagem curta sem preços nem parâmetros; compartilhamento anterior com valores mantido; lista vazia informada.
- Gerador completo de PDF com visita e adiamento, foto incorporada, motivo longo com paginação e margens verificadas. Um PDF fictício também foi aberto e conferido visualmente no navegador.
- Navegação da prévia: contador 2→1→0, adiamento removendo o cliente do dia original, retorno na nova data e histórico preservado após concluir.

Comando dos testes, limitando a compilação WebAssembly para evitar o excesso de memória observado neste Windows:

```powershell
node --liftoff-only --no-wasm-tier-up --wasm-num-compilation-tasks=1 --test --test-concurrency=1 tests/*.test.mjs
npm.cmd run lint
npm.cmd run build
```

A seleção automatizada de um arquivo pelo navegador foi bloqueada pela permissão da extensão de automação, sem alterar essa permissão. A foto foi verificada nas regras de upload, no RLS e no PDF com imagem fictícia; a seleção manual e o upload completo pelo celular devem ser conferidos em um Supabase de desenvolvimento. Nenhuma foto foi enviada ao bucket real para testes.

Não houve teste de ponta a ponta contra o PostgREST de um Supabase de desenvolvimento externo: a interface foi validada com a prévia em memória, e a persistência/permissões foram verificadas separadamente no Postgres descartável. Isso evita alterar dados reais antes da sua validação.

