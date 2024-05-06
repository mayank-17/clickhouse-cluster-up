#! /usr/bin/env node

const fs = require('node:fs');
const replace = require("replace");
const fsPromises = require('node:fs/promises');
const YAML = require("yaml");
const convert = require("xml-js");

const cwd = process.cwd();

const workingDirectory = cwd + "/" + "volume";

const performFileOperations = (shards, replicas, cluster) => {

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
                fs.copyFileSync(cwd + "/src/" + "users.xml", folderName + "/" + "users.xml");
                fs.copyFileSync(cwd + "/src/" + "config.xml", folderName + "/" + "config.xml");
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
            replace({
                regex: "__CLUSTER__",
                replacement: cluster,
                paths: [folderName + "/" + "config.xml"],
                recursive: false,
                silent: true,
            });
        }
    }
};

const addNewService = (shard, replica, ipv4) => {
    let service = {
        hostname: `clickhouse-${shard}-${replica}`,
        container_name: `clickhouse-${shard}-${replica}`,
        image: 'clickhouse/clickhouse-server:23.4.2',
        networks: { 'ckh-network': { "ipv4_address": `172.16.238.${ipv4}` } },
        volumes: [ '${PWD}' + `/volume/clickhouse-${shard}-${replica}:/etc/clickhouse-server` ],
        depends_on: [ 'zookeeper-0' ]
    };

    if (shard == 0 && replica == 0) {
        service["ports"] = [ '127.0.0.1:8123:8123', '127.0.0.1:9000:9000' ];
    }
    return service;
}

const configureDockerCompose = async (shards, replicas) => {
    try {
        const dockerComposeData = await fsPromises.readFile(cwd + "/src/" + 'docker-compose.yml', { encoding: 'utf8' });
        const parsedDockerComposeData = await YAML.parse(dockerComposeData);
        let subnet = 3;
        for (let shard = 0; shard < shards; shard++) {
            for (let replica = 0; replica < replicas; replica++) {
                parsedDockerComposeData["services"][`clickhouse-${shard}-${replica}`] = addNewService(shard, replica, subnet);
                subnet++;
            }
        }
        const createClusterDockerFile = (filePath, bufferStream) => new Promise(resolve => {
            let wstream = fs.createWriteStream(filePath, { flags: "w" });
            wstream.write(bufferStream);
            wstream.on('close', () => { resolve(bufferStream); })
        });
        createClusterDockerFile('clickhouse-cluster.yml', YAML.stringify(parsedDockerComposeData))
    } catch (err) {
        console.log(err);
    }
};

const configureConfigXml = async (shards, replicas, cluster) => {
    try {
        const configXML = await fsPromises.readFile(cwd + "/src/" + 'config_.xml', { encoding: 'utf8' });
        const parsedConfigXML = JSON.parse(convert.xml2json(configXML, { compact: true }));
        parsedConfigXML.clickhouse.remote_servers[cluster] = { shard: addNewShardAndReplica(shards, replicas) };
        let writer = fs.createWriteStream(cwd + "/src/" + 'config.xml');
        writer.write(convert.js2xml(parsedConfigXML, {compact: true, ignoreComment: true, spaces: 4}));
    } catch (err) {
        console.log(err);
    }
}

const addNewShardAndReplica = (shards, replicas) => {
    let shard = [];
    for (let s = 0; s < shards; s++) {
        let replica = [];
        for (let r = 0; r < replicas; r++) {
            let node = { host: { _text: `clickhouse-${s}-${r}` }, port: { _text: '9000' } };
            replica.push(node);
        }
        shard.push( { replica } );
    }
    return shard;
}

module.exports = { performFileOperations, configureDockerCompose, configureConfigXml };