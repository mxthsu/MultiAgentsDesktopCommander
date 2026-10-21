import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
const secretFile = path.join(os.homedir(),'Documents','MultiAgentsWorkspace','.multiagents-desktop-commander','http-auth-token');
const token = fs.readFileSync(secretFile,'utf8').trim();
const transport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:8877/mcp'),{requestInit:{headers:{Authorization:'Bearer '+token}}});
const client = new Client({name:'multiagents-local-http-smoke',version:'0.6.0'});
let passed=false;
try{
  const denied=await fetch('http://127.0.0.1:8877/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  if(denied.status!==401)throw new Error('Unauthenticated request returned '+denied.status);
  await client.connect(transport);
  const tools=(await client.listTools()).tools.map(t=>t.name);
  for(const name of ['start_process','ma_health','ma_list_skills','ma_agent_sync','ma_create_mission'])if(!tools.includes(name))throw new Error('Missing '+name);
  const res=await client.callTool({name:'ma_health',arguments:{}});
  if(res.isError)throw new Error(JSON.stringify(res.content).slice(0,600));
  const skills=await client.callTool({name:'ma_list_skills',arguments:{}});
  if(skills.isError)throw new Error('skills failed');
  const raw=(skills.content||[]).find(x=>x.type==='text')?.text||'{}';
  const count=JSON.parse(raw).skills.length;
  console.log(JSON.stringify({status:'PASS',http:true,unauthenticated:401,tool_count:tools.length,skill_count:count,model_api_calls:0}));
  passed=true;
}catch(e){console.error('HTTP_MCP_TEST_FAILED',String(e));process.exitCode=1}
finally {await client.close().catch(()=>{}); if(!passed)process.exitCode=1}
