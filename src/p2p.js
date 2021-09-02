const { CronJob } = require('cron');
const crypto = require('crypto'),
    Swarm = require('discovery-swarm'),
    defaults = require('dat-swarm-defaults'),
    getPort = require('get-port');
const { getLatestBlock } = require('./chain');

const chain = require('./chain');

const peers = {};
let connSeq = 0;
let channel = 'myBlockchain';

const myPeerId = crypto.randomBytes(32);
console.log('myPeerId:',myPeerId.toString('hex'));

const config = defaults({
    id: myPeerId,
});

const swarm = new Swarm(config);

let registeredMiners = [];
let lastBlockMinedBy = null;

let MessageType = {
    REQUEST_BLOCK: 'requestBlock',
    RECEIVE_NEXT_BLOCK: 'receiveNextBlock',
    RECEIVE_NEW_BLOCK: 'receiveNewBlock',
    RECEIVE_ALL_BLOCK: 'receiveNewBlock',
    REQUEST_ALL_REGISTERED_MINERS: 'requestAllRegisteredMiners',
    REGISTER_MINER: 'registerMiner',
};

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

            switch (msg.type) {
                case MessageType.REQUEST_BLOCK:
                    console.log('----------- REQUEST_BLOCK -------------');
                    let requestedIndex = (JSON.parse(JSON.stringify(msg.data)))
                        .index;
                    let requestedBlock = chain.getBlock(requestedIndex);

                    if (requestedBlock) {
                        writeMessageToPeerToId(
                            peerId.toString('hex'),
                            MessageType.RECEIVE_NEXT_BLOCK,
                            requestedBlock
                        );
                    } else {
                        console.log('No block found @ index: '+requestedIndex);
                        console.log('----------- REQUEST_BLOCK -------------');
                    }
                    break;

                case MessageType.RECEIVE_NEXT_BLOCK:
                    console.log('----------- RECEIVE_NEXT_BLOCK -------------');
                    
                    chain.addBlock(JSON.parse(JSON.stringify(msg.data)));
                    console.log(JSON.stringify(chain.blockchain));
                    
                    let nextBlockIndex = chain.getLatestBlock().index + 1;
                    console.log('-- request next block @index: '+nextBlockIndex);
                    writeMessageToPeerToId(MessageType.REQUEST_BLOCK, { index: nextBlockIndex });

                    console.log('----------- RECEIVE_NEXT_BLOCK -------------');
                    break;

                case MessageType.RECEIVE_NEW_BLOCK:
                    if (msg.to === myPeerId.toString('hex') && msg.from !== myPeerId.toString('hex')) {
                        console.log('----------- RECEIVE_NEW_BLOCK -----------'+msg.to);
                        chain.addBlock(JSON.parse(JSON.stringify(msg.data)));
                        console.log(JSON.stringify(chain.blockchain));
                        console.log('----------- RECEIVE_NEW_BLOCK -----------' + msg.to);
                    }
                    break;
                    
                case MessageType.REQUEST_ALL_REGISTERED_MINERS:
                    console.log('----------- REQUEST_ALL_REGISTERED_MINERS -------------'+msg.to);
                    writeMessageToPeers(MessageType.REGISTER_MINER, registeredMiners);
                    registeredMiners = JSON.parse(JSON.stringify(msg.data));
                    console.log('------------- REQUEST_ALL_REGISTERED_MINERS -------------' + msg.to);
                    break;

                case MessageType.REGISTER_MINER:
                    console.log('------------- REGISTER_MINER -------------'+msg.to);
                    let miners = JSON.stringify(msg.data);
                    registeredMiners = JSON.parse(miners);
                    console.log(registeredMiners);
                    console.log('------------- REGISTER_MINER -------------' + msg.to);
                    break;
                }
        });

        conn.on('close', () => {
            console.log(`Connection ${seq} closed, peerId: ${peerId}`);

            if (peers[peerId].seq === seq) {
                delete peers[peerId];
                console.log('--- registeredMiners before: '+JSON.stringify(registeredMiners));
                let index = registeredMiners.indexOf(peerId);

                if (index > -1) {
                    registeredMiners.splice(index, 1);
                }

                console.log('--- registeredMiners end: ' + JSON.stringify(registeredMiners));
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

//Request new block every 5 seconds
setTimeout(() => {
    writeMessageToPeers(MessageType.REQUEST_BLOCK,
        { index: getLatestBlock().index + 1 });
}, 5000);

//Request all registered miners every 5 seconds
setTimeout(() => {
    writeMessageToPeers(MessageType.REQUEST_ALL_REGISTERED_MINERS, null);
}, 5000);

//Send my list of miners to other peers every 7 seconds
setTimeout(() => {
    registeredMiners.push(myPeerId.toString('hex'));
    console.log('----------- Register my miner -----------');
    console.log(registeredMiners);

    writeMessageToPeers(MessageType.REGISTER_MINER, registeredMiners);
    console.log('----------- Register my miner -----------');
}, 7000);

//Mine a block every 30 seconds
const job = new CronJob('30 * * * * *', () => {
    let index = 0;

    if (lastBlockMinedBy) {
        let newIndex = registeredMiners.indexOf(lastBlockMinedBy);
        index = (newIndex + 1 > registeredMiners.length-1) > 0
                ? 0
                : newIndex + 1;
    }

    //Calculating who has to mine the next block
    lastBlockMinedBy = registeredMiners[index];

    console.log('-- REQUESTING NEW BLOCK FROM: '+registeredMiners[index]+', index: '+index);
    console.log(JSON.stringify(registeredMiners));

    if (registeredMiners[index] === myPeerId.toString('hex')) {
        console.log('----------- create next block -----------');

        let newBlock = chain.generateNextBlock(null);
        chain.addBlock(newBlock);
        console.log(JSON.stringify(newBlock));
        writeMessageToPeerToId(MessageType.RECEIVE_NEXT_BLOCK, newBlock);
        console.log(JSON.stringify(chain.blockchain));

        console.log('----------- create next block -----------');
    }
});

job.start();

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