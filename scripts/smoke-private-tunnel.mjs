import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {join} from 'node:path';
const transport=new StdioClientTransport({command:process.execPath,args:[join('dist','private-stdio.js')],stderr:'pipe'});
const client=new Client({name:'private-readonly-test',version:'1'});
try{
 await client.connect(transport);
 const listed=(await client.listTools()).tools;
 const names=listed.map(x=>x.name);
 const expected=['ma_health','ma_list_skills','ma_list_agents','ma_inbox','ma_mission_snapshot'];
 if(names.sort().join(',')!==expected.sort().join(','))throw new Error('Unexpected tool surface: '+names);
 if(listed.some(x=>!x.annotations?.readOnlyHint))throw new Error('All tools must be read-only');
 const health=await client.callTool({name:'ma_health',arguments:{}});
 const skills=await client.callTool({name:'ma_list_skills',arguments:{}});
 if(health.isError||skills.isError)throw new Error('Health or skills failed');
 const bad=await client.callTool({name:'start_process',arguments:{command:'Write-Output NEVER_EXECUTE'}});
 if(!bad.isError)throw new Error('Unsafe tool invocation was not rejected');
 const data=JSON.parse(skills.content.find(x=>x.type==='text').text);
 console.log(JSON.stringify({test:'PASS',tools:names.length,read_only:true,powershell_exposed:false,unsafe_call_rejected:true,skills:data.skills.length}));
}catch(e){console.error('PRIVATE_TUNNEL_TEST_FAILED',String(e));process.exitCode=1}
finally{await client.close().catch(()=>{})}
