const {Block, BlockHeader} = require('./block'),
    moment = require('moment'),
    CryptoJs = require('crypto-js'),
    level = require('level'),
    fs = require('fs');

let db;

const getGenesisBlock = () => {
    let blockHeader = new BlockHeader(1, null,
        '0x1bc3300000000000000000000000000000000000000000000',
        moment().unix());

    return new Block(blockHeader, 0, null);
}

const getLatestBlock = () => blockchain[blockchain.length-1];

const generateNextBlock = txns => {
    const prevBlock = getLatestBlock(),
        prevMerkleRoot = prevBlock.blockHeader.merkleRoot,
        nextIndex = prevBlock.index + 1,
        nextTime = moment().unix(),
        nextMerkleRoot = CryptoJs.SHA256(1, prevMerkleRoot, nextTime).toString();
    
    const blockHeader = new BlockHeader(1, prevMerkleRoot, nextMerkleRoot, nextTime);
    const newBlock = new Block(blockHeader, nextIndex, txns);

    blockchain.push(newBlock);
    storeBlock(newBlock);
    
    return newBlock;
}

const addBlock = newBlock => {
    let prevBlock = getLatestBlock();

    if (prevBlock.index < newBlock.index 
        && 
        newBlock.blockHeader.previousBlockHeader === prevBlock.blockHeader.merkleRoot) {
            blockchain.push(newBlock);
            storeBlock(newBlock);
        }
}

const getBlock = index => {
    if (blockchain.length - 1 >= index) {
        return blockchain[index];
    } else {
        return null;
    }
}

const createDb = peerId => {
    let dir = __dirname + '/db/' + peerId;
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
        db = level(dir);
        storeBlock(getGenesisBlock());
    }
}

const storeBlock = newBlock => {
    db.put(newBlock.index, JSON.stringify(newBlock), err => {
        if (err) {
            return console.log('Oops!', err);
        }

        console.log('--- Inserting block index:', newBlock.index);
    });
}

const getDbBlock = (index, res) => {
    db.get(index, (err, value) => {
        if (err) {
            return res.send(JSON.stringify(err));
        }

        return res.send(value);
    });
}

const blockchain = [getGenesisBlock()];

const chain = {
    addBlock,
    generateNextBlock,
    getBlock,
    blockchain,
    getLatestBlock,
    createDb,
    getDbBlock,
};

module.exports = chain