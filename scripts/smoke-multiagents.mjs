import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const transport = new StdioClientTransport({ command: process.execPath, args:['dist/index.js','--no-onboarding'],cwd:root,stderr:'pipe' });
const client = new Client({name:'multiagents-smoke',version:'0.6.0'});
const out = {ok:false};
try {
  await client.connect(transport);
  const list = await client.listTools();
  const names = list.tools.map(t=>t.name);
  out.nativeCount = names.filter(n=>!n.startsWith('ma_')).length;
  out.multiagentCount = names.filter(n=>n.startsWith('ma_')).length;
  for(const key of ['start_process','read_file','ma_health','ma_list_skills','ma_agent_sync']){
    if (!names.includes(key)) throw new Error('tool absent: '+key);
  }
  for(const [tool,args] of [['ma_health',{}],['ma_list_skills',{}]]){
    const res=await client.callTool({name:tool,arguments:args});
    out[tool]={error:res.isError||false,preview:(res.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n').slice(0,1100)};
    if(res.isError)throw new Error(tool+' failed: '+out[tool].preview);
  }
  const processResult = await client.callTool({name:'start_process',arguments:{timeout_ms:15000,command:"Write-Output MULTIAGENTS_NATIVE_POWERSHELL_OK; Write-Output ('PSVERSION='+$PSVersionTable.PSVersion.ToString())"}});
  out.powershell = {error:processResult.isError||false,text:(processResult.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n').slice(0,1800)};
  if(processResult.isError)throw new Error('Powershell tool failed '+out.powershell.text);
  out.ok=true;
} catch(error){
  out.error=String(error);
  process.exitCode=1;
} finally {
  await client.close().catch(()=>{});
  process.stdout.write(JSON.stringify(out,null,2)+'\n');
}
