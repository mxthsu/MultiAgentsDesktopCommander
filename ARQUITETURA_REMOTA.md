# Arquitetura remota — MultiAgents Desktop Commander

## Objetivo

Oferecer a experiência do plugin remoto Desktop Commander em conversas **ChatGPT Chat**, acrescentando missões, agentes, skills, mensagens e memória compartilhada, sem consumir uma API de modelo de IA.

## O que é aberto e o que não é

O projeto [DesktopCommanderMCP](https://github.com/wonderwhy-er/DesktopCommanderMCP) inclui o servidor MCP local e parte do cliente Remote Device, sob licença MIT. O serviço hospedado **Remote Desktop Commander**, que oferece autenticação OAuth, roteamento e conexão direta ao ChatGPT, é proprietário e não foi herdado no nosso fork. Ver [documentação remota](https://github.com/desktop-commander/remote-desktop-commander).

**Importante:** alterar um servidor local ou instalar uma skill não cria uma integração hospedada no catálogo ChatGPT.

## Topologia atual testada

```text
Cliente MCP local #1 ---.
                       +--> 127.0.0.1:8877/mcp (HTTP + Bearer)
Cliente MCP local #2 ---'          |
                                  v
                  MCP Node (DesktopCommanderMCP fork)
                     + 25 ferramentas nativas
                     + 26 ferramentas de coordenação
                                  |
                                  v
                    Backend local Python (stdio)
                                  |
                                  v
                    SQLite + skills + missões
                      MultiAgentsWorkspace
```

A sessão HTTP é separada por cliente. O backend nativo pode ser compartilhado sem duplicar a fila. Os comandos executam com as permissões da conta local, não em sandbox.

## Topologia para paridade remota com o plugin original

```text
ChatGPT Chat (app/plugin reconhecido e autorizado)
       |
       | HTTPS + OAuth, ferramentas MCP publicadas
       v
Gateway próprio na nuvem (identidade, auditoria, roteamento)
       |
       | Canal de saída autenticado pelo dispositivo
       v
Agent Device IL-7417 -> MCP local do fork -> ferramentas e workspace
```

O **IL-7417 não deve receber porta pública**. O Device Agent estabelece a conexão de saída. O gateway verifica identidade do usuário e dispositivo, permissões, escopos de ferramenta, limites de tempo e duplicação de chamadas. Comandos sensíveis exigem autorização e o controle da conexão precisa poder ser revogado.

## Diferenças entre as formas de uso

- **Plugin MCP local**: pode oferecer ferramentas ao aplicativo ChatGPT Desktop se o plugin estiver instalado e aprovado. Não habilita automaticamente acesso pelo ChatGPT Web.
- **Plugin com app remoto**: exige um serviço HTTPS com autenticação e uma integração que a conta ChatGPT realmente disponibilize. ChatGPT Sites ou integração MCP do workspace são caminhos de publicação possíveis, dependendo da conta e das permissões.
- **MCP local via teste**: confirma o protocolo e o código, mas não prova que o modelo ChatGPT teve acesso ao servidor.

## Requisitos que faltam para anunciar paridade remota

1. Hospedagem autorizada do gateway de controle remoto com OAuth e TLS.
2. Pareamento de dispositivos e canal de saída com rotação e revogação de credenciais.
3. Roteamento por `device_id` e `request_id`, sem fallback silencioso.
4. Políticas por usuário e por ferramenta, limites de execução e auditoria com redação de segredos.
5. Conexão do app/plugin ao ChatGPT Chat aprovada na interface.
6. Teste de uma chamada real **ChatGPT → gateway → IL-7417 → retorno**.
7. Teste de duas conversas GPT ativas compartilhando a missão, respeitando reivindicações e reservas de arquivos.

Não se deve considerar o projeto concluído enquanto os itens 5 e 6 não forem comprovados.

## Testes locais disponíveis

```powershell
node scripts/smoke-multiagents.mjs
node scripts/smoke-http.mjs
node scripts/smoke-concurrent.mjs
node scripts/test-agent-collaboration.mjs
```

O último teste inicia um gateway separado em porta livre e um workspace temporário, simula dois clientes MCP, testa disputa pelo mesmo lease, mensagem, dependências e conclusão de tarefas, encerrando os processos e eliminando os dados temporários. **Não invoca modelos GPT nem suas conversas.**
