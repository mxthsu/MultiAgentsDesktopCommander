# Integração privada ao ChatGPT via Secure MCP Tunnel

Esta etapa usa o cliente oficial [openai/tunnel-client](https://github.com/openai/tunnel-client), sem abrir portas públicas no Windows, sem hospedagem própria e **sem usar modelos pela API**. Ainda é necessário ter permissões para túneis na OpenAI Platform e para criar plugins MCP no ChatGPT.

## O que está pronto

- Cliente oficial Windows x64 baixado da release atual, com SHA-256 conferido.
- `dist/private-stdio.js`: perfil inicial estritamente de leitura.
- Ferramentas remotas permitidas: `ma_health`, `ma_list_skills`, `ma_list_agents`, `ma_inbox`, `ma_mission_snapshot`.
- Terminal, arquivos, alterações, comandos, reivindicação de tarefas e mensagens **não estão expostos por esse perfil**. Não substitui as 51 ferramentas locais.
- Scripts de configuração, start, stop e status.
- A inicialização automática do Windows só inicia o túnel após uma configuração autenticada localmente.

## 1. Criar o túnel e a chave (ação na sua conta)

No navegador, acesse [Tunnels da OpenAI Platform](https://platform.openai.com/settings/organization/tunnels) e crie um Secure MCP Tunnel. Copie o `tunnel_id`.

Em [Runtime API keys](https://platform.openai.com/settings/organization/api-keys), crie uma chave com as permissões exigidas pelo cliente de túnel (Tunnels Read + Use). O usuário também precisa da permissão de criação ou gerenciamento para criar o túnel, e a associação ao seu workspace ChatGPT deve estar correta.

**Não cole a chave no ChatGPT e não a coloque no Git.** Essa chave é utilizada no plano de controle do túnel, não na API de inferência de modelos.

A execução do túnel e a instalação do plugin também estão sujeitas às políticas da sua conta e do workspace. Se as opções não aparecerem, será necessário obter a permissão correspondente.

## 2. Configurar no Windows

Abra o PowerShell **na sessão local do IL-7417** e execute:

```powershell
cd "$HOME\Documents\MultiAgentsDesktopCommander-Fork"
.\Setup-MultiAgents-Tunnel.ps1
```

Informe o `tunnel_id` e depois a chave na entrada segura do PowerShell. A chave fica criptografada com DPAPI no perfil desse usuário Windows, em `runtime/tunnel/platform-key.dpapi`, que é ignorado pelo Git.

O script cria o perfil `multiagents-readonly` e prepara a inicialização do cliente, usando `dist/private-stdio.js` como servidor MCP de destino.

## 3. Iniciar e verificar

```powershell
.\Start-MultiAgents-Tunnel.ps1
.\Status-MultiAgents-Tunnel.ps1
```

Se necessário, consulte a interface local `http://127.0.0.1:8878/ui` para verificar a conexão do cliente. **Não a disponibilize pela rede.**

O cliente é iniciado automaticamente na próxima entrada no Windows, se a configuração estiver concluída. Para interromper:

```powershell
.\Stop-MultiAgents-Tunnel.ps1
```

## 4. Conectar ao ChatGPT Chat

Abra **ChatGPT → Plugins → Adicionar (+) → Adicionar servidor MCP personalizado**. Em **Conexão**, escolha **Túnel** e selecione ou informe seu `tunnel_id`. Configure a autenticação exigida pelas permissões da sua conta, aceite o aviso de segurança, crie e instale o plugin.

Em uma conversa normal, selecione o novo plugin com `@` e solicite:

> Chame ma_health e ma_list_skills e mostre quantas skills estão disponíveis. Não altere arquivos nem execute comandos.

Somente após observar **chamadas de ferramentas feitas pelo ChatGPT** pode-se declarar a integração final ativa. A existência de uma conexão local testada não comprova isso.

## 5. Evoluir para paridade com Desktop Commander

Após validar acesso pelo ChatGPT, habilitar gradualmente operações de leitura de arquivos e de colaboração. Para PowerShell, edições e escrita, implementar escopos por ferramenta, aprovação humana e auditoria para chamadas remotas antes de ampliar o allowlist. O perfil inicial não aceita nenhuma dessas operações.

Nunca publique a porta 8877 do MCP original ou o token local do workspace em um endpoint público.

## Documentação oficial

- [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)
- [Adicionar servidor MCP personalizado](https://developers.openai.com/api/docs/guides/custom-mcp-server)
- [Conectando MCP no ChatGPT](https://help.openai.com/pt-br/articles/12584461-connecting-custom-mcp-servers-in-chatgpt)
