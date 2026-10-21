/**
 * MultiAgents bridge: native Desktop Commander tools + existing SQLite agent coordination.
 * Separate local stdio processes; no model API, external gateway, or remote listener.
 */
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const EXPOSED = new Set([
  'health','list_skills','skill_index','recommend_skills','read_skill',
  'inbox','mission_snapshot','create_mission','ready_chatgpt_tasks',
  'register_agent','list_agents','agent_inbox','agent_sync',
  'claim_agent_task','renew_agent_task','claim_and_context',
  'submit_agent_result','get_task_result',
  'post_agent_message','read_agent_messages',
  'lock_file','unlock_file',
  'save_knowledge','search_knowledge','get_knowledge',
  'workspace_delta'
]);
const PREFIX = 'ma_';
const instructions = 'MultiAgents: coordination across independently active ChatGPT conversations. ' +
  'The MCP does not create ChatGPT sessions. CLI workers are not LLM agents. ' +
  'Changes and executions need user authorization.';
let client: Client | undefined;
let connecting: Promise<Client> | undefined;

function config() {
  const documents = path.join(os.homedir(), 'Documents');
  const legacy = path.join(documents, 'MultiAgentsDesktopCommander');
  const win = process.platform === 'win32';
  return {
    command: process.env.MULTIAGENTS_PYTHON ||
      path.join(legacy, '.venv', win ? 'Scripts' : 'bin', win ? 'python.exe' : 'python'),
    cwd: process.env.MULTIAGENTS_BACKEND || legacy,
    root: process.env.MULTIAGENTS_WORKSPACE || path.join(documents, 'MultiAgentsWorkspace'),
  };
}

async function connect(): Promise<Client> {
  if (client) return client;
  if (!connecting) {
    connecting = (async () => {
      const settings = config();
      const candidate = new Client({name: 'multiagents-desktop-commander-native', version: '0.6.0'});
      const transport = new StdioClientTransport({
        command: settings.command, cwd: settings.cwd,
        args: ['-m', 'multiagents_desktop_commander', '--root', settings.root, 'stdio'],
        stderr: 'pipe',
      });
      await candidate.connect(transport);
      client = candidate;
      return candidate;
    })().catch((error) => {
      connecting = undefined;
      client = undefined;
      throw error;
    });
  }
  return connecting;
}

export async function listMultiAgentsTools(): Promise<any[]> {
  try {
    const api = await connect();
    const { tools } = await api.listTools();
    return tools.filter(t => EXPOSED.has(t.name)).map(t => ({
      name: PREFIX + t.name,
      description: '[MultiAgents] ' + t.description + '\n' + instructions,
      inputSchema: t.inputSchema,
      annotations: {
        title: 'MultiAgents: ' + t.name,
        readOnlyHint: ['health','list_skills','skill_index','recommend_skills','read_skill',
          'inbox','mission_snapshot','ready_chatgpt_tasks','list_agents','agent_inbox',
          'agent_sync','get_task_result','read_agent_messages','search_knowledge',
          'get_knowledge','workspace_delta'].includes(t.name),
        openWorldHint: false,
      },
    }));
  } catch (error) {
    return [{
      name: 'ma_connection_status',
      description: 'Diagnose local MultiAgents backend connection (no changes).',
      inputSchema: {type:'object', properties:{}},
      annotations: {readOnlyHint:true, openWorldHint:false}
    }];
  }
}

export function isMultiAgentsTool(name: string): boolean {
  return name.startsWith(PREFIX);
}

export async function callMultiAgentsTool(name: string, args: unknown): Promise<any> {
  if (name === 'ma_connection_status') {
    try {
      await connect();
      return {content:[{type:'text',text:'MultiAgents coordination backend connected.'}],isError:false};
    } catch(error) {
      return {content:[{type:'text',text:'MultiAgents backend unavailable: '+String(error).slice(0,300)}],isError:true};
    }
  }
  const real = name.slice(PREFIX.length);
  if (!EXPOSED.has(real)) return {content:[{type:'text',text:'Unknown MultiAgents tool'}],isError:true};
  try {
    const api = await connect();
    return await api.callTool({name:real,arguments:(args && typeof args === 'object' ? args : {}) as Record<string,unknown>});
  } catch (error) {
    client = undefined;
    connecting = undefined;
    return {content:[{type:'text',text:'MultiAgents tool failed: '+String(error).slice(0,400)}],isError:true};
  }
}
