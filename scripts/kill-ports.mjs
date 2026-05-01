/**
 * kill-ports.mjs
 * Aggressively frees ports 3000 & 3001 before `npm run dev`.
 * Kills by port number AND by process name (catches zombie next/server processes).
 */

import { execSync } from "child_process";

const PORTS = [3000, 3001];

function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
  } catch {
    return "";
  }
}

function killByPort(port) {
  if (process.platform === "win32") {
    const result = run(`netstat -ano | findstr ":${port} "`);
    const pids = new Set(
      result
        .split("\n")
        .map((line) => line.trim().split(/\s+/).pop())
        .filter((pid) => pid && pid !== "0" && /^\d+$/.test(pid))
    );
    for (const pid of pids) {
      const killed = run(`taskkill /PID ${pid} /F`);
      if (killed.includes("SUCCESS")) {
        console.log(`  ✓ Freed port ${port} (killed PID ${pid})`);
      }
    }
  } else {
    const pids = run(`lsof -ti tcp:${port}`).trim().split("\n").filter(Boolean);
    for (const pid of pids) {
      run(`kill -9 ${pid}`);
      console.log(`  ✓ Freed port ${port} (killed PID ${pid})`);
    }
  }
}

function killByName(processName) {
  if (process.platform === "win32") {
    // Find node.exe processes whose command line contains the script name
    const result = run(
      `wmic process where "name='node.exe'" get ProcessId,CommandLine`
    );
    const lines = result.split("\n").filter((l) => l.includes(processName));
    for (const line of lines) {
      const pid = line.trim().split(/\s+/).pop();
      if (pid && /^\d+$/.test(pid)) {
        const killed = run(`taskkill /PID ${pid} /F`);
        if (killed.includes("SUCCESS")) {
          console.log(`  ✓ Killed zombie "${processName}" (PID ${pid})`);
        }
      }
    }
  } else {
    const pids = run(`pgrep -f "${processName}"`).trim().split("\n").filter(Boolean);
    for (const pid of pids) {
      run(`kill -9 ${pid}`);
      console.log(`  ✓ Killed zombie "${processName}" (PID ${pid})`);
    }
  }
}

console.log("🔌 Clearing dev ports...");

// Kill known zombie process names first
killByName("next-dev.mjs");
killByName("next-server");

// Then sweep by port to catch anything else
for (const port of PORTS) {
  killByPort(port);
}

// Small delay to let OS release the ports
await new Promise((r) => setTimeout(r, 500));

console.log("✅ Ports clear — starting dev server\n");
