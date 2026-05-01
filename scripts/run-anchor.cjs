const { spawnSync } = require("node:child_process");
const os = require("node:os");
const path = require("node:path");

const anchorArgs = process.argv.slice(2);

if (anchorArgs.length === 0) {
  console.error("Usage: node scripts/run-anchor.cjs <anchor-command> [...args]");
  process.exit(1);
}

function shellQuote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function toWslPath(windowsPath) {
  const resolved = path.resolve(windowsPath);
  const match = resolved.match(/^([A-Za-z]):\\(.*)$/);

  if (!match) {
    throw new Error(`Cannot convert Windows path to WSL path: ${resolved}`);
  }

  const drive = match[1].toLowerCase();
  const rest = match[2].replace(/\\/g, "/");
  return `/mnt/${drive}/${rest}`;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    shell: false,
    stdio: "inherit",
  });

  if (typeof result.status === "number") {
    process.exit(result.status);
  }

  if (result.error) {
    console.error(result.error.message);
  }

  process.exit(1);
}

if (os.platform() !== "win32") {
  run("anchor", anchorArgs, { cwd: process.cwd() });
}

const repoPath = toWslPath(process.cwd());
const quotedAnchorArgs = anchorArgs.map(shellQuote).join(" ");

const wslCommand = [
  "[ -s /root/.nvm/nvm.sh ] && . /root/.nvm/nvm.sh",
  `cd ${shellQuote(repoPath)}`,
  `anchor ${quotedAnchorArgs}`,
].join(" && ");

run("wsl.exe", ["-d", "Ubuntu-22.04", "--", "bash", "-lc", wslCommand], {
  cwd: process.cwd(),
});
