/**
 * Local integration test: two independent MCP sessions collaborating on one
 * simulated ChatGPT mission, without invoking an LLM or touching user data.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import net from 'node:net';

const repo = resolve(import.meta.dirname, '..');
const workspace = mkdtempSync(join(tmpdir(), 'multiagents-collab-test-'));
const token = randomBytes(32).toString('hex');
const state = join(workspace, '.multiagents-desktop-commander');
mkdirSync(state, { recursive:true });
writeFileSync(join(state,'http-auth-token'), token, {mode:0o600});
const listenPort = await new Promise((resolvePort,reject)=>{
  const probe=net.createServer();
  probe.once('error',reject);
  probe.listen(0,'127.0.0.1',()=>{
    const port=probe.address().port;
    probe.close(()=>resolvePort(port));
  });
});
const endpoint = new URL('http://127.0.0.1:'+listenPort+'/mcp');
const child = spawn(process.execPath,[join(repo,'dist/native-http.js')],{
  cwd:repo,windowsHide:true,stdio:['ignore','pipe','pipe'],
  env:{...process.env,MULTIAGENTS_WORKSPACE:workspace,MULTIAGENTS_HTTP_PORT:String(listenPort)}
});
const clients=[];
let stderr='';
child.stderr.on('data',x=>{stderr=(stderr+x.toString()).slice(-1200)});
let succeeded=false;
async function waitUp(){
  for(let i=0;i<100;i++){
    if(child.exitCode!==null) throw new Error('Server exited: '+stderr);
    try{ const x=await fetch('http://127.0.0.1:'+listenPort+'/health');
      if(x.ok) return;
    }catch{}
    await new Promise(r=>setTimeout(r,150));
  }
  throw new Error('Timeout starting local server: '+stderr);
}
async function connect(name){
  const transport=new StreamableHTTPClientTransport(endpoint,{requestInit:{headers:{Authorization:'Bearer '+token}}});
  const client=new Client({name,version:'1.0'});
  clients.push(client);
  await client.connect(transport);
  return client;
}
async function call(client,name,args={}){
  const r=await client.callTool({name,arguments:args});
  const msg=(r.content||[]).filter(v=>v.type==='text').map(v=>v.text).join('\n');
  if(r.isError)throw new Error(name+' failed: '+msg.slice(0,350));
  try{return JSON.parse(msg)}catch{return msg}
}
try{
  await waitUp();
  const [dev,qa] = await Promise.all([connect('simulated-gpt-dev'),connect('simulated-gpt-qa')]);
  const [h1,h2] = await Promise.all([call(dev,'ma_health'),call(qa,'ma_health')]);
  if(h1.workspace.toLowerCase()!==workspace.toLowerCase() || h2.workspace.toLowerCase()!==workspace.toLowerCase())throw new Error('Workspace was not isolated; expected='+workspace+' got='+h1.workspace+' / '+h2.workspace);
  await Promise.all([
    call(dev,'ma_register_agent',{agent_id:'smokedev',role:'backend',display_name:'Simulated ChatGPT backend'}),
    call(qa,'ma_register_agent',{agent_id:'smokeqa',role:'review',display_name:'Simulated ChatGPT QA'})
  ]);
  await call(dev,'ma_create_mission',{
    title:'Local simulated collaboration',
    mission_id:'smokeMission',
    tasks:[
      {id:'smokeBuild',role:'backend',kind:'chatgpt',instruction:'Simulate creating a feature',workdir:'.',depends_on:[]},
      {id:'smokeReview',role:'review',kind:'chatgpt',instruction:'Simulate code review',workdir:'.',depends_on:['smokeBuild']}
    ]
  });
  await call(dev,'ma_agent_inbox',{agent_id:'smokedev',mission_id:'smokeMission'});
  const first=await call(dev,'ma_claim_agent_task',{task_id:'smokeBuild',agent_id:'smokedev'});
  if(typeof first.lease_token!=='string')throw new Error('Missing first lease');
  const duplicate=await qa.callTool({name:'ma_claim_agent_task',arguments:{task_id:'smokeBuild',agent_id:'smokeqa'}});
  if(!duplicate.isError)throw new Error('Concurrent task claim was not rejected');
  await call(dev,'ma_post_agent_message',{mission_id:'smokeMission',sender:'smokedev',recipient:'smokeqa',body:'Build simulated; review after completion'});
  await call(qa,'ma_read_agent_messages',{mission_id:'smokeMission',agent_id:'smokeqa'});
  await call(dev,'ma_submit_agent_result',{task_id:'smokeBuild',lease_token:first.lease_token,result:'Simulated build completed',success:true});
  const second=await call(qa,'ma_claim_agent_task',{task_id:'smokeReview',agent_id:'smokeqa'});
  if(typeof second.lease_token!=='string')throw new Error('Missing second lease');
  await call(qa,'ma_submit_agent_result',{task_id:'smokeReview',lease_token:second.lease_token,result:'Simulated review passed',success:true});
  const done=await call(dev,'ma_mission_snapshot',{mission_id:'smokeMission'});
  if(done.status_counts?.completed!==2)throw new Error('Mission not fully completed: '+JSON.stringify(done.status_counts));
  succeeded=true;
  console.log(JSON.stringify({
    result:'PASS',http_sessions:2,shared_workspace:true,backend_calls_real:true,
    reasoning_agents_simulated:true,mission_tasks:2,completed:2,
    simultaneous_claim_rejected:true,chatgpt_model_sessions:0,user_workspace_unchanged:true
  }));
}catch(err){ console.error('COLLABORATION_TEST_FAILED',String(err));process.exitCode=1;
}finally{
  await Promise.allSettled(clients.map(x=>x.close()));
  child.kill();
  await new Promise(r=>setTimeout(r,250));
  rmSync(workspace,{recursive:true,force:true,maxRetries:5,retryDelay:250});
}
