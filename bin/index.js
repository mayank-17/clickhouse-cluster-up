#! /usr/bin/env node
const chalk = require('chalk')
const boxen = require('boxen')
const yargs = require("yargs");
const figlet = require('figlet');
const fs = require('node:fs');
const process = require('process');
const replace = require("replace");
const { spawn } = require("child_process");

const usage = chalk.keyword('magenta')("\nUsage: clickhouse-cluster-up -s <shard> -r <replica> \n"
                + boxen(chalk.green("\n" + "Clickhouse Cluster with configurable shards and replicas." + "\n"), {padding: 1, borderColor: 'cyan', dimBorder: true, margin: {top: 1}}) + "\n");

const options = yargs
      .usage(usage)
      .option("s", {alias:"shard", describe: "No. of Shards", type: "string", demandOption: false })
      .option("r", {alias:"replica", describe: "No. of Replicas", type: "string", demandOption: false })
      .help(true)
      .argv;

const argv = require('yargs/yargs')(process.argv.slice(2)).argv;

if(argv.replica == null && argv.r == null){
    console.log(
        chalk.yellow(
          figlet.textSync('Clickhouse  Cluster Toolkit', { horizontalLayout: 'default' })
        )
      );
    yargs.showHelp();
    return;
}
if(argv.shard == null && argv.s == null){
    yargs.showHelp();
    return;
}

const shards = argv.s !== undefined ? argv.s : argv.shard;

const replicas = argv.r !== undefined ? argv.r : argv.replica;

const cwd = process.cwd();

const workingDirectory = cwd + "/" + "volume";

try {
    if(fs.existsSync(workingDirectory)) {
        fs.rmSync(workingDirectory, { recursive: true, force: true });
    }
} catch (err) {
    console.log(err);
}

try {
    if (!fs.existsSync(workingDirectory)) {
        fs.mkdirSync(workingDirectory);
    }
} catch (err) {
    console.error(err);
}

for (let shard = 0; shard < shards; shard++) {
    for (let replica = 0; replica < replicas; replica++) {
        const folderName = workingDirectory + "/" + `clickhouse-${shard}-${replica}`;
        try {
            if (!fs.existsSync(folderName)) {
                fs.mkdirSync(folderName);
            }
            fs.copyFileSync("users.xml", folderName + "/" + "users.xml");
            fs.copyFileSync("config.xml", folderName + "/" + "config.xml");
        } catch (err) {
            console.error(err);
        }
        replace({
            regex: "__SHARD__",
            replacement: shard.toString(),
            paths: [folderName + "/" + "config.xml"],
            recursive: false,
            silent: true,
        });
        replace({
            regex: "__REPLICA__",
            replacement: replica.toString(),
            paths: [folderName + "/" + "config.xml"],
            recursive: false,
            silent: true,
        });
    }
}

const dockerCompose = spawn("docker", ["compose", "up"]);

dockerCompose.stdout.on("data", data => {
    console.log(`stdout: ${data}`);
});

dockerCompose.stderr.on("data", data => {
    console.log(`stderr: ${data}`);
});

dockerCompose.on('error', (error) => {
    console.log(`error: ${error.message}`);
});

dockerCompose.on("close", () => {
    console.log(`✅ The server has been stopped.`);
});

process.on('SIGINT', () => {
    spawn("docker", ["compose", "down"]);
});  // CTRL+C
process.on('SIGQUIT', () => {
    spawn("docker", ["compose", "down"])
}); // Keyboard quit
process.on('SIGTERM', () => {
    spawn("docker", ["compose", "down"])
}); // `kill` command
