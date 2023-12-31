const { spawn } = require("child_process");
const net = require("net");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { localTorDir } = require("./config");

module.exports = class TorProxy {
    #executablePath;
    #options;
    #torProcess;
    #pid;
    #torIPCTimeOut;

    async #createTorrcFile(torrcPath, controlPassword) {
        let torrcOptions = [];
        torrcOptions.push(
            `HashedControlPassword ${await this.#createControlPassword(
                controlPassword
            )}`
        );

        fs.writeFileSync(torrcPath, torrcOptions.join("\n"), "utf8");
    }

    #createControlPassword(controlPassword) {
        return new Promise((resolve, reject) => {
            console.log(this.#executablePath);
            spawn(this.#executablePath, ["--hash-password", controlPassword])
                .stdout.on("data", (data) => {
                    let hashedPassword = data.toString().trim().split`\n`[0];
                    if (/^\d{2}:/.test(hashedPassword)) resolve(hashedPassword);
                })
                .on("error", (err) => {
                    reject(err);
                })
                .on("close", (code) => {
                    reject(
                        `Tor process exited with code ${code} (UNKNOWN ERROR)`
                    );
                });
        });
    }

    #torIPC(commands) {
        return new Promise((resolve, reject) => {
            let socket = net.connect(
                {
                    host: this.#options.ip,
                    port: this.#options.controlPort,
                },
                function () {
                    let commandString = commands.join("\n") + "\n";
                    socket.write(commandString);
                    //resolve(commandString);
                }
            );

            socket.on("error", function (err) {
                reject(err);
            });

            let data = "";
            socket.on("data", function (chunk) {
                data += chunk.toString();
            });

            socket.on("end", function () {
                resolve(data);
            });
        });
    }

    constructor(options) {
        if (typeof options === "string" || typeof options === "number") {
            options = {
                port: options,
            };
        }
        console.log(`data path ${path.join(__dirname, localTorDir, "data", "default")}`);
        console.log(`torrc path ${path.join(__dirname, localTorDir, "Tor", "torrc")}`);
        this.#options = {
            path: path.join(__dirname, localTorDir, "Tor"),
            ip: "127.0.0.1",
            port: "9050",
            controlPort: "9151",
            controlPassword: "giraffe", // default password
            dataPath: path.join(__dirname, localTorDir, "data", "default"),
            torrcPath: path.join(__dirname, localTorDir, "Tor", "torrc"),
            ...options,
        };

        this.#executablePath = `${this.#options.path}/${this.#options.executable ? this.#options.executable : "tor.exe"
            }`;

        if (!fs.existsSync(this.#options.dataPath)) {
            fs.mkdirSync(this.#options.dataPath, { recursive: true });
        }
    }
    async startTorProcess() {
        await this.#createTorrcFile(
            this.#options.torrcPath,
            this.#options.controlPassword
        );
        if (this.#pid) {
            await this.killTorProcess();
            this.#pid = null;
        }

        return await new Promise((resolve, reject) => {
            this.#torProcess = spawn(this.#executablePath, [
                "--SocksPort",
                this.#options.port,
                "--ControlPort",
                this.#options.controlPort,
                "--DataDirectory",
                this.#options.dataPath,
                "-f",
                this.#options.torrcPath,
                "--GeoIPv6File",
                path.resolve(this.#options.path, "geoip6"),
                "--GeoIPFile",
                path.resolve(this.#options.path, "geoip"),
            ]);
            this.#torProcess.stdout.on("data", (data) => {
                // console.log(data.toString() + "\n__________");
                if (data.toString().includes("100% (done)")) {
                    this.#pid = this.#torProcess.pid;
                    resolve(this.#options.port);
                }
                if (data.toString().includes("Address already in use")) {
                    if (data.toString().includes("Opening Control listener")) {
                        throw new Error("Control port already in use");
                    }
                    throw new Error("Port already in use");
                }
                if (data.toString().includes("same data directory.")) {
                    throw new Error(
                        "It looks like another Tor process is running with the same data directory."
                    );
                }
                if (data.toString().includes("[err]")) {
                    throw new Error(
                        "Tor process failed to start \n" + data.toString()
                    );
                }
            });
            this.#torProcess
                .on("error", (err) => {
                    reject(`Tor process error: ${err}`);
                })
                .on("close", (code) => {
                    reject(`tor process closed with code ${code}`);
                })
                .on("exit", (code) => {
                    reject(`tor process exited with code ${code}`);
                })
                .on("error", (err) => {
                    reject(`Tor process stderr error: ${err}`);
                });
        });
    }

    killTorProcess() {
        return new Promise((resolve, reject) => {
            try {
                let pid = this.#pid;
                if (!pid) throw new Error("Tor process not running");
                this.#torProcess.kill();
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }

    newTorSession() {
        let commands = [
            'authenticate "' + this.#options.controlPassword + '"', // authenticate the connection
            "signal newnym", // send the signal (renew Tor session)
            "quit", // close the connection
        ];
        return new Promise((resolve, reject) => {
            let rateLimitingTime = this.#torIPCTimeOut - new Date().getTime();
            if (!this.#torIPCTimeOut || rateLimitingTime < 0)
                rateLimitingTime = 0;
            setTimeout(() => {
                this.#torIPC(commands)
                    .then((data) => {
                        let lines = data.split(os.EOL).slice(0, -1);
                        let success = lines.every((val, ind, arr) => {
                            // each response from the ControlPort should start with 250 (OK STATUS)
                            return val.length <= 0 || val.indexOf("250") >= 0;
                        });

                        if (!success) {
                            if (data.toString().includes("Password did not match HashedControlPassword")) {
                                throw new Error(
                                    "controlPassword password did not match 'HashedControlPassword' (in torrc file)"
                                );
                            }
                            let err = new Error(
                                "Error communicating with Tor ControlPort\n" +
                                data
                            );
                            reject(err);
                        }
                        let RATE_LIMITING_NEWNYM_REQUEST_TIME = 10000;
                        this.#torIPCTimeOut =
                            new Date().getTime() +
                            RATE_LIMITING_NEWNYM_REQUEST_TIME;
                        resolve("Tor session successfully renewed!!");
                        //resolve(data);
                    })
                    .catch(function (err) {
                        reject(err);
                    });
            }, rateLimitingTime);
        });
    }
};
