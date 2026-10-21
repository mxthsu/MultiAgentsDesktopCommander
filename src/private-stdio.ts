/**
 * Minimal read-only MCP entrypoint for private Secure MCP Tunnel bootstrap.
 *
 * Explicitly excludes terminal, filesystem writes, configuration writes, task
 * claims and other actions until host-level approval policy is established.
 */
import path from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {ListToolsRequestSchema, CallToolRequestSchema} from '@modelcontextprotocol/sdk/types.js';

const allowed = new Set([
  'ma_health',
  'ma_list_skills',
  'ma_list_agents',
  'ma_inbox',
  'ma_mission_snapshot',
]);
const trustedRoot=path.resolve(import.meta.dirname,'..');
let client:Client|undefined;
let pending:Promise<Client>|undefined;

async function native():Promise<Client>{
  if(client)return client;
  if(!pending){
    pending=(async()=>{
      const candidate=new Client({name:'multiagents-private-readonly',version:'0.6.1'});
      // Never propagate control-plane API credentials into a tool-capable child.
      const envAllowlist=['PATH','PATHEXT','SYSTEMROOT','WINDIR','USERPROFILE',
        'APPDATA','LOCALAPPDATA','TEMP','TMP','COMSPEC','PROCESSOR_ARCHITECTURE'];
      const env:Record<string,string>={};
      for(const key of envAllowlist){
        const found=Object.keys(process.env).find(k=>k.toUpperCase()===key);
        if(found && process.env[found]) env[found]=process.env[found]!;
      }
      const child=new StdioClientTransport({
        command:process.execPath,
        args:[path.join(trustedRoot,'dist','index.js'),'--no-onboarding'],
        cwd:trustedRoot,
        env,
        stderr:'pipe',
      });
      await candidate.connect(child);
      client=candidate;
      return candidate;
    })().catch(err=>{pending=undefined;client=undefined;throw err});
  }
  return pending;
}
const server=new Server({
  name:'multiagents-desktop-commander-private',
  version:'0.6.1',
},{capabilities:{tools:{}}});

server.setRequestHandler(ListToolsRequestSchema,async()=>{
  const full=(await(await native()).listTools()).tools;
  return {tools:full.filter(t=>allowed.has(t.name)).map(t=>({
    ...t,
    description:'[Read-only private MCP] '+t.description,
    annotations:{...(t.annotations||{}),readOnlyHint:true,destructiveHint:false,openWorldHint:false},
  }))};
});
server.setRequestHandler(CallToolRequestSchema,async req=>{
  const {name,arguments:args}=req.params;
  if(!allowed.has(name))
    return {content:[{type:'text',text:'Tool not authorized in read-only tunnel profile'}],isError:true};
  const serialized=JSON.stringify(args||{});
  if(serialized.length>12000)
    return {content:[{type:'text',text:'Request is too large'}],isError:true};
  try{
    return await (await native()).callTool({name,arguments:args||{}}) as any;
  }catch(err){
    console.error('[private MCP] tool error:',err instanceof Error?err.name:'Error');
    return {content:[{type:'text',text:'Private MCP tool failed; see local server logs'}],isError:true};
  }
});
const transport=new StdioServerTransport();
await server.connect(transport);
