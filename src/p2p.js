const crypto = require('crypto'),
    Swarm = require('discovery-swarm'),
    defaults = require('dat-swarm-defaults'),
    getPort = require('get-port');

const peers = {};
let connSeq = 0;
let channel = 'myBlockchain';

const myPeerId = crypto.randomBytes(32);
console.log('myPeerId:',myPeerId.toString('hex'));

const config = defaults({
    id: myPeerId,
});

const swarm = new Swarm(config);

(async () => {
    const port = await getPort();

    swarm.listen(port);
    console.log('Listening port:', port);

    swarm.join(channel);
    swarm.on('connection', (conn, info) => {
        const seq = connSeq;
        const peerId = info.id.toString('hex');

        console.log(`Connected #${seq} to peer: ${peerId}`);
        if (info.initiator) {
            try {
                conn.setKeepAlive(true, 600);
            } catch (exception) {
                console.log('exception', exception);
            }
        }

        conn.on('data', data => {
            let msg = JSON.parse(data);
            console.log('----------------- Received Message Start -----------------');
            console.log('from:', peerId.toString('hex'));
            console.log('to:', peerId.toString(msg.to));
            console.log('my:', myPeerId.toString('hex'));
            console.log('type:', JSON.stringify(msg.type));
            console.log('----------------- Received Message End -----------------');
        });

        conn.on('close', () => {
            console.log(`Connection ${seq} closed, peerId: ${peerId}`);

            if (peers[peerId].seq === seq) {
                delete peers[peerId];
            }
        });

        if (!peers[peerId]) {
            peers[peerId] = {};
        }

        peers[peerId].conn = conn;
        peers[peerId].seq = seq;
        connSeq++;
    });
}) ();

setTimeout(() => {
    writeMessageToPeers('hello', null);
}, 10000);

const writeMessageToPeers = (type, data) => {
    for (let id in peers) {
        console.log('----------------- writeMessageToPeers Start -----------------');
        console.log('type:', type);
        console.log('to:', id);
        console.log('----------------- writeMessageToPeers End -----------------');

        sendMessage(id, type, data);
    }
}

const writeMessageToPeerToId = (toId, type, data) => {
    for (let id in peers) {
        console.log('----------------- writeMessageToPeerToId start -----------------');
        console.log('type:', type);
        console.log('to:', toId);
        console.log('type:', type);
        console.log('----------------- writeMessageToPeerToId end -----------------');
        sendMessage(id, type, data);
    }
}

const sendMessage = (id, type, data) => {
    peers[id].conn.write(JSON.stringify({
        to: id,
        from: myPeerId,
        type,
        data
    }));
}