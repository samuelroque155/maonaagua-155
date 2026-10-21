# Documentos, acessórios e lembretes

## Recursos

- Configurações: preço individual dos acessórios, preservado junto ao catálogo do perfil. A lista da visita permite compartilhar somente os nomes ou valores e total, com indicação de preços ausentes.
- Adiar visita: o campo de comprovação solicita a câmera traseira em celulares compatíveis (`capture="environment"`). O comportamento final depende do navegador e do aparelho.
- Ocorrência técnica: foto e texto persistem em IndexedDB por conta e cliente. O PDF separado inclui alerta, identificação do cliente, empresa, cidade e imagem profissional. A ocorrência registrada continua disponível no relatório e no PDF completo, inclusive depois da conclusão da visita.
- Novo cliente → Orçamento: cadastro avulso separado da agenda. Permite guardar o orçamento e o anexo neste aparelho; compartilhar o PDF pronto ou gerar apresentação com empresa/logo seguida das páginas do anexo. Não grava cliente recorrente nem agenda uma visita.
- Configurações → Notificações: horário de Brasília e opção de desligar por aparelho. O envio com o app fechado usa Web Push, Edge Function e agendamento no Supabase.

## Arquivos principais

`src/pages/Configuracoes.jsx`, `src/pages/AdiarVisita.jsx`, `src/pages/Visita.jsx`, `src/pages/VerRelatorio.jsx`, `src/pages/NovoCliente.jsx`, `src/pages/OrcamentoAvulso.jsx`, `src/components/ConfiguracaoLembretes.jsx`, `src/App.jsx`, `public/sw.js` e serviços de documentos, armazenamento local e notificações em `src/services/`.

## Servidor de notificações

1. Migração: `supabase/migrations/20261021053105_lembretes_push.sql`. RLS restringe dispositivos à própria conta; somente `service_role` pode reservar entregas e marcar a data do envio.
2. Função: `supabase/functions/enviar-lembretes/index.ts`. Configurar `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT` e `LEMBRETES_CRON_SECRET` nos segredos da função. Autenticação própria pelo cabeçalho `x-cron-secret`; o deploy usa `verify_jwt: false`.
3. Guardar a URL da função em `lembretes_function_url` e o segredo de agendamento em `lembretes_cron_secret` no Supabase Vault. Habilitar `pg_cron` e `pg_net`, então executar `scripts/agendar-lembretes-push.sql`.
4. Configurar somente a chave pública em `VITE_WEB_PUSH_PUBLIC_KEY` no frontend e gerar novo build. Nunca colocar a chave privada ou o segredo de agendamento em variáveis `VITE_*`.

O servidor envia apenas a quantidade de piscinas pendentes, sem nomes ou endereços. Usa reserva de cinco minutos contra processamento concorrente e marca o dia após entrega aceita. O worker do navegador guarda um identificador por dispositivo e dia em IndexedDB: entregas repetidas ou simultâneas são ignoradas, inclusive depois de reiniciar o worker. Endpoints expirados são desativados. Limpar os dados do navegador remove também esse controle local.

## Validação em 21/10/2026

- A suíte inicial de 76 testes passou. A versão preparada para publicação passou em 73 testes; ela inclui o novo teste de reentrega e exclui quatro testes das alterações de cadastro que continuam locais.
- Build aprovado; lint sem erros, com 33 avisos existentes. Corrigida a exportação do componente da página de prévia.
- `deno check` da Edge Function aprovado.
- Migrações de notificações e leitura mínima aplicadas ao projeto `gltstspgyzevjygtefnq`. Segredos configurados, função implantada e cron ativo a cada minuto. A execução real retornou HTTP 200 com `enviados: 0, falhas: 0`; nenhum aparelho estava inscrito durante a conferência.
- Verificado no banco: `anon` e `authenticated` não leem os campos de identidade; somente `service_role` recebeu SELECT de `id`, `email` e `email_confirmed_at`. Não foram concedidas permissões de UPDATE ou DELETE em usuários. RLS de dispositivos ativo; RPC de reserva indisponível para usuários comuns.
- Requisição externa sem o segredo de agendamento recebeu HTTP 401. Chave privada e segredo estão nos segredos da Edge Function e no Vault, conforme necessário ao cron. A cópia temporária local foi removida; somente a chave pública foi configurada no frontend/Vercel.
- Capturas das prévias: `docs/acessorios-precos-previa.png`, `docs/orcamento-avulso-previa.png`, `docs/orcamento-pdf-previa.png`, `docs/ocorrencia-tecnica-pdf-previa.png`.

## Conferência no celular

1. Salvar um preço de acessório, reabrir o app e conferir a lista com e sem valores.
2. Abrir a câmera na comprovação do adiamento.
3. Registrar foto/texto de ocorrência, trocar de tela, fechar/reabrir e conferir o rascunho e o PDF separado. Finalizar a visita e conferir a ocorrência no relatório completo.
4. Criar orçamento avulso e testar as duas opções de PDF; confirmar que ele não entrou na agenda.
5. No celular, abrir o app atualizado em HTTPS e entrar na própria conta. Manter uma piscina pendente na agenda de hoje. Em Configurações → Notificações, ativar e aceitar a permissão do navegador; escolher horário de Brasília dois ou três minutos à frente. Fechar o app sem forçar a parada do Chrome nem desligar a internet. Aguardar o horário e mais um minuto para o cron; tocar no aviso deve abrir o app. A mesma inscrição recebe um lembrete por dia; mudar o horário após o envio não cria outro teste no mesmo dia. Desligar a opção cancela a inscrição do aparelho.

Não foi feita entrega real de push nem compartilhamento externo de documentos nos testes automatizados. Web Push depende de internet, permissão e condições do sistema; não é um alarme de precisão.
