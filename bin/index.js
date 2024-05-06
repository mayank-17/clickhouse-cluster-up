#! /usr/bin/env node
const chalk = require('chalk')
const boxen = require('boxen')
const yargs = require("yargs");
const figlet = require('figlet');
const process = require('process');
const { spawn } = require("child_process");
const { performFileOperations, configureDockerCompose, configureConfigXml } = require("./helper.js");

const usage = chalk.keyword('magenta')("\nUsage: clickhouse-cluster-up -s <shard> -r <replica> -c <cluster>\n"
                + boxen(chalk.green("\n" + "Clickhouse Cluster with configurable shards and replicas." + "\n"), {padding: 1, borderColor: 'cyan', dimBorder: true, margin: {top: 1}}) + "\n");

const options = yargs
      .usage(usage)
      .option("s", {alias:"shard", describe: "No. of Shards", type: "string", demandOption: false })
      .option("r", {alias:"replica", describe: "No. of Replicas", type: "string", demandOption: false })
      .option("c", {alias:"cluster", describe: "Name of Cluster", type: "string", demandOption: false })
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
if(argv.cluster == null && argv.c == null){
    yargs.showHelp();
    return;
}

const shards = argv.s !== undefined ? argv.s : argv.shard;

const replicas = argv.r !== undefined ? argv.r : argv.replica;

const cluster = argv.c !== undefined ? argv.c : argv.cluster;

const func = async () => {
    await configureDockerCompose(shards, replicas);
    await configureConfigXml(shards, replicas, cluster);
    performFileOperations(shards, replicas, cluster);
}

func().then(() => {
    const dockerCompose = spawn("docker", ["compose", "-f", "clickhouse-cluster.yml", "up"]);

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

    // CTRL+C
    process.on('SIGINT', () => {
        spawn("docker", ["compose", "-f", "clickhouse-cluster.yml", "stop"]);
    });

    // Keyboard quit
    process.on('SIGQUIT', () => {
        spawn("docker", ["compose", "-f", "clickhouse-cluster.yml", "stop"])
    });

    // `kill` command
    process.on('SIGTERM', () => {
        spawn("docker", ["compose", "-f", "clickhouse-cluster.yml", "stop"])
    });

});

