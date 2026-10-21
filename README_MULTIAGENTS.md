# MultiAgents Desktop Commander

Fork do [Desktop Commander MCP](https://github.com/wonderwhy-er/DesktopCommanderMCP), distribuído sob licença MIT. Mantém as ferramentas originais e adiciona coordenação de agentes através do MultiAgents local.

## Funcionalidades instaladas no IL-7417

- **Desktop Commander original:** terminal PowerShell, arquivos, edição, busca e processos.
- **26 ferramentas `ma_...`:** papéis, missões, filas, dependências, mensagens, reservas de arquivos, memória e skills.
- **Um mesmo workspace:** `~/Documents/MultiAgentsWorkspace`, persistido em SQLite.
- **MCP local:** `http://127.0.0.1:8877/mcp`, com autenticação Bearer. O servidor escuta **somente em 127.0.0.1**.
- **Autostart:** scripts PowerShell no Windows e entrada do usuário atual no registro.

O servidor MCP **não executa um modelo de IA**. Cada subagente ChatGPT é uma conversa independente que deve estar ativa para realizar raciocínio; o serviço permite distribuir, compartilhar e registrar tarefas. O supervisor Python pode executar tarefas CLI, mas não é um subagente GPT.

## Operação no Windows

Na pasta do fork:

```powershell
.\Start-MultiAgents-System.ps1
.\Status-MultiAgents-Native.ps1
.\Stop-MultiAgents-Native.ps1
.\Install-MultiAgents-Autostart.ps1
```

A instalação Python anterior continua em `~/Documents/MultiAgentsDesktopCommander`. O novo fork fica em `~/Documents/MultiAgentsDesktopCommander-Fork`; um utiliza o outro por conexão MCP stdio. Não se deve deletar a instalação Python antes de implementar a migração de estado.

## Validar

```powershell
npm ci --ignore-scripts
npm run build
node scripts/smoke-multiagents.mjs
node scripts/smoke-http.mjs
```

O teste `smoke-multiagents.mjs` inicializa o servidor Node, lista as ferramentas, consulta a coordenação pelo backend Python e executa um `Write-Output` seguro por `start_process`, verificando o **PowerShell nativo do fork**. O teste HTTP verifica também rejeição sem autenticação.

## Segurança

O token permanece em `~/Documents/MultiAgentsWorkspace/.multiagents-desktop-commander/http-auth-token`, **não é versionado**. O gateway local não oferece acesso direto pela Internet nem possui OAuth para um cliente remoto. Não abra porta 8877 para a rede ou configure túnel público sem um gateway autenticado com escopos e aprovação de ações.

As ferramentas do Desktop Commander original têm grande capacidade operacional. Defina diretórios autorizados, regras e políticas de aprovação antes de permitir que outras pessoas usem o serviço.

## ChatGPT Desktop e subagentes

O cliente local pode conversar com um servidor MCP via stdio; o endereço HTTP é destinado a clientes MCP locais com autenticação. A disponibilização das ferramentas no **ChatGPT Chat** depende da interface e das permissões efetivamente oferecidas pelo aplicativo. Não declare conexão com o modelo até confirmar uma chamada real na conversa.

Fluxo de colaboração:

1. Conversa coordenadora cria uma missão com tarefas de backend, frontend e revisão.
2. Cada conversa de agente ativa registra sua identidade e reivindica uma tarefa.
3. Agentes trocam mensagens e consultam skills/memória com ferramentas `ma_...`.
4. O coordenador consulta o estado e integra resultados.
5. Comandos e operações de arquivos podem ser realizados pelo Desktop Commander original, com autorização adequada.

Nenhum componente acorda conversas GPT inativas por conta própria.

## Direitos e origem

Este projeto é um fork do código de Eduard Ruzga e contribuidores, sob licença MIT; a licença e avisos originais foram preservados. Consulte `LICENSE`.


## Configurar o plugin ChatGPT Desktop para o fork Node

No IL-7417, execute ap?s compilar o fork:

```powershell
& "$HOME\Documents\MultiAgentsDesktopCommander\.venv\Scripts\python.exe" "scripts\configure-chatgpt-local.py"
```

O script faz backup das configura??es existentes e substitui o antigo servidor Python do plugin local pelo MCP Node do fork. Reinicie o ChatGPT Desktop para carregar as mudan?as. **A conex?o em uma conversa ChatGPT s? estar? comprovada depois que o pr?prio modelo chamar `ma_health` ou `start_process` com sucesso**, n?o pelo teste de um cliente SDK isolado.

O servi?o HTTP aceita clientes MCP locais independentes e mant?m sess?es separadas; um ?nico processo de backend nativo atende as sess?es. Cada conversa GPT ativa ainda precisa reivindicar suas pr?prias tarefas.
