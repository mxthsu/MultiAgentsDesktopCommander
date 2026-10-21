/**
 * Local-only, authenticated MCP gateway for independent concurrent agent sessions.
 * A native Desktop Commander stdio child is created for each MCP HTTP session.
 * All children share the local SQLite MultiAgents workspace, not LLM contexts.
 */
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const port = Number(process.env.MULTIAGENTS_HTTP_PORT || 8877);
const workspace = process.env.MULTIAGENTS_WORKSPACE || path.join(os.homedir(), 'Documents', 'MultiAgentsWorkspace');
const secretFile = path.join(workspace, '.multiagents-desktop-commander', 'http-auth-token');
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid HTTP port');
if (!fs.existsSync(secretFile)) throw new Error('Missing existing MultiAgents bearer token file');
const secret = Buffer.from(fs.readFileSync(secretFile, 'utf8').trim());
if (secret.length < 32) throw new Error('Invalid bearer token');

function authorized(value: string | undefined) {
  if (!value?.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(value.slice(7));
  return supplied.length === secret.length && timingSafeEqual(supplied, secret);
}

type Session = {
  transport: StreamableHTTPServerTransport;
  server: Server;
  client: Client;
  lastSeen: number;
};
const sessions = new Map<string, Session>();
const MAX_SESSIONS = 24;
const SESSION_IDLE_MS = 45 * 60 * 1000;

let sharedNative: Client | undefined;
let sharedConnecting: Promise<Client> | undefined;
async function getNativeClient(): Promise<Client> {
  if (sharedNative) return sharedNative;
  if (!sharedConnecting) {
    sharedConnecting = (async () => {
      const candidate = new Client({name:'multiagents-local-gateway',version:'0.6.0'});
      const child = new StdioClientTransport({
        command:process.execPath,
        args:[path.join(import.meta.dirname,'index.js'),'--no-onboarding'],
        cwd:path.resolve(import.meta.dirname,'..'),
        stderr:'pipe',
      });
      await candidate.connect(child);
      sharedNative = candidate;
      return candidate;
    })().catch(error => {
      sharedConnecting = undefined;
      sharedNative = undefined;
      throw error;
    });
  }
  return sharedConnecting;
}
async function createSession(): Promise<Session> {
  const native = await getNativeClient();
  const server = new Server(
    {name:'multiagents-desktop-commander',version:'0.6.0'},
    {capabilities:{tools:{}}}
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => native.listTools());
  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    await native.callTool({
      name:request.params.name,
      arguments:request.params.arguments || {},
    }) as any
  );
  let registeredId: string | undefined;
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator:() => randomUUID(),
    enableJsonResponse:true,
    onsessioninitialized(id) { registeredId=id; sessions.set(id,session); },
  });
  const session: Session = {transport,server,client:native,lastSeen:Date.now()};
  transport.onclose = () => {
    if(registeredId) sessions.delete(registeredId);
    void server.close().catch(()=>{});
  };
  await server.connect(transport);
  return session;
}

const listener = http.createServer(async (req,res) => {
  let fresh:Session|undefined;
  try{
    const route=req.url?.split('?')[0];
    if(route==='/health' && req.method==='GET'){
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
      res.end(JSON.stringify({ok:true,name:'multiagents-desktop-commander',transport:'local-http',sessions:sessions.size,pid:process.pid}));
      return;
    }
    if(route!=='/mcp'){res.writeHead(404);res.end('Not found');return}
    if(!authorized(req.headers.authorization)){
      res.writeHead(401,{'Cache-Control':'no-store','WWW-Authenticate':'Bearer'});
      res.end('Unauthorized');return;
    }
    if(!['POST','GET','DELETE'].includes(req.method||'')){
      res.writeHead(405);res.end('Method not allowed');return;
    }
    const length=Number(req.headers['content-length'] || 0);
    if(length>2_000_000){res.writeHead(413);res.end('Request too large');return}
    const sessionId=req.headers['mcp-session-id'];
    if(sessionId && typeof sessionId !== 'string'){
      res.writeHead(400);res.end('Bad session header');return;
    }
    const existing=sessionId ? sessions.get(sessionId) : undefined;
    if(sessionId && !existing){res.writeHead(404);res.end('Unknown MCP session');return}
    if(!existing && req.method!=='POST'){res.writeHead(400);res.end('MCP initialization required');return}
    if(!existing && sessions.size>=MAX_SESSIONS){res.writeHead(503);res.end('Session limit reached');return}
    const current=existing || (fresh=await createSession());
    current.lastSeen=Date.now();
    await current.transport.handleRequest(req,res);
    // The request did not initialize a session; discard its child immediately.
    if(fresh && !fresh.transport.sessionId) await fresh.transport.close();
  }catch(e){
    console.error('Native MCP request error:',e instanceof Error ? e.message : String(e));
    if(fresh && !fresh.transport.sessionId) await fresh.transport.close().catch(()=>{});
    if(!res.headersSent)res.writeHead(500);
    if(!res.writableEnded)res.end('MCP internal error');
  }
});
const reap=setInterval(()=>{
  const now=Date.now();
  for(const s of sessions.values()){
    if(now-s.lastSeen>SESSION_IDLE_MS)void s.transport.close().catch(()=>{});
  }
},60_000);
reap.unref();

listener.listen(port,'127.0.0.1',()=>
  console.error('MultiAgents HTTP gateway listening at 127.0.0.1:'+port+' (authentication enabled)')
);
process.once('SIGTERM',()=>{listener.close();for(const s of sessions.values())void s.transport.close()});
process.once('SIGINT',()=>{listener.close();for(const s of sessions.values())void s.transport.close()});
