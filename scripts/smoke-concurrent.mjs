import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';
const token=readFileSync(join(homedir(),'Documents','MultiAgentsWorkspace','.multiagents-desktop-commander','http-auth-token'),'utf8').trim();
const active=[];
try{
  const result=await Promise.all(Array.from({length:3},async(_,i)=>{
    const transport=new StreamableHTTPClientTransport(new URL('http://127.0.0.1:8877/mcp'),{requestInit:{headers:{Authorization:'Bearer '+token}}});
    const client=new Client({name:'agent-concurrent-'+i,version:'0.6'});
    active.push(client);
    await client.connect(transport);
    const [tools,health,inbox]=await Promise.all([client.listTools(),client.callTool({name:'ma_health',arguments:{}}),client.callTool({name:'ma_inbox',arguments:{}})]);
    if(health.isError||inbox.isError)throw new Error('Agent '+i+' MCP failed');
    return {client:i,tools:tools.tools.length,workspace:JSON.parse(health.content.find(c=>c.type==='text').text).workspace};
  }));
  if(result.some(x=>x.tools!==51))throw new Error('Tool list incomplete');
  const status=await fetch('http://127.0.0.1:8877/health').then(x=>x.json());
  if(status.sessions < 3)throw new Error('Concurrent sessions missing '+status.sessions);
  console.log(JSON.stringify({pass:true,active_sessions:status.sessions,agents:result.map(x=>x.client),tools_per_agent:result[0].tools,same_workspace:result.every(x=>x.workspace===result[0].workspace)}));
}catch(err){console.error('CONCURRENT_TEST_FAILED',String(err));process.exitCode=1}
finally{await Promise.allSettled(active.map(c=>c.close()))}
