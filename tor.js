const TorProxy = require("./libs/tors");

let tor = new TorProxy(9051);

(async () => {
    await tor.startTorProcess();
    //=> tor is now running (127.0.0.1:9051)

    await tor.newTorSession();
    //=> new tor ip address

    await tor.killTorProcess();
    //=> tor is now stopped
})().catch(console.log)