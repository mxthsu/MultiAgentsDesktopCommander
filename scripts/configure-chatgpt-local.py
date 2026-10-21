"""Configure installed local ChatGPT plugin to launch the native fork MCP over stdio.
Does not access credentials or use model APIs. Backups all existing config files.
"""
from pathlib import Path
import datetime
import json
import re
import shutil
import subprocess
import tomllib

home = Path.home()
fork = home / "Documents" / "MultiAgentsDesktopCommander-Fork"
node_path = shutil.which("node")
if not node_path or not (fork / "dist" / "index.js").is_file():
    raise RuntimeError("Native fork build or Node missing")
stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
sources = [
    home / ".codex/plugins/multiagents-desktop-commander",
    home / ".codex/plugins/cache/personal-local/multiagents-desktop-commander/local",
    home / ".agents/plugins/plugins/multiagents-desktop-commander",
]
updated = []
for root in sources:
    if not root.is_dir():
        continue
    legacy = root / ".codex-plugin/plugin.json"
    portable = root / "plugin.json"
    for filename in ["mcp.json", ".mcp.json", "plugin.json", ".codex-plugin/plugin.json"]:
        f = root / filename
        if f.exists():
            shutil.copy2(f, str(f) + ".native-backup-" + stamp)
    for filename, extra in [("mcp.json", {"type":"stdio"}),(".mcp.json", {})]:
        f = root / filename
        data = {
          "mcpServers": {
            "multiagents-desktop-commander":{
              **extra,
              "command":node_path,
              "args":[str(fork / "dist" / "index.js"), "--no-onboarding"],
              "cwd":str(fork),
            }
          }
        }
        f.write_text(json.dumps(data, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    for f in [legacy, portable]:
        if f.exists():
            obj = json.loads(f.read_text(encoding="utf-8"))
            obj["version"] = "0.6.0"
            f.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    updated.append(str(root))

cfg=home / ".codex/config.toml"
old=cfg.read_text(encoding="utf-8-sig")
tomllib.loads(old)
shutil.copy2(cfg, str(cfg) + ".native-backup-" + stamp)
section = r'(?ms)^\[mcp_servers\.multiagents_local\]\r?\n.*?(?=^\[|\Z)'
body = '[mcp_servers.multiagents_local]\n'
body += 'command = '+json.dumps(node_path)+'\n'
body += 'args = '+json.dumps([str(fork / "dist" / "index.js"), "--no-onboarding"])+'\n'
body += 'cwd = '+json.dumps(str(fork))+'\n'
body += 'enabled = true\nrequired = false\nstartup_timeout_sec = 20\n\n'
body += '[mcp_servers.multiagents_local.tools.ma_health]\napproval_mode = "auto"\n'
body += '[mcp_servers.multiagents_local.tools.ma_list_skills]\napproval_mode = "auto"\n'
body += '[mcp_servers.multiagents_local.tools.ma_inbox]\napproval_mode = "auto"\n'
sections_to_remove = [
    'mcp_servers.multiagents_local',
    'mcp_servers.multiagents_local.tools.health',
    'mcp_servers.multiagents_local.tools.list_skills',
    'mcp_servers.multiagents_local.tools.inbox',
    'mcp_servers.multiagents_local.tools.ma_health',
    'mcp_servers.multiagents_local.tools.ma_list_skills',
    'mcp_servers.multiagents_local.tools.ma_inbox',
]
result=old
for name in sections_to_remove:
    regex=r'(?ms)^\['+re.escape(name)+r'\]\r?\n.*?(?=^\[|\Z)'
    result=re.sub(regex,'',result)
result=result.rstrip()+'\n\n'+body
checked=tomllib.loads(result)
assert checked["mcp_servers"]["multiagents_local"]["command"]==node_path
cfg.write_text(result,encoding="utf-8")
print(json.dumps({"plugin_sources_updated":len(updated),"config":"native Node MCP enabled",
                  "transport":"stdio","tool_names":"ma_* + DesktopCommander original",
                  "fork":str(fork),"chatgpt_chat_verified":False},ensure_ascii=False))
