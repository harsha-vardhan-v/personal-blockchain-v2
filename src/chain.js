let Block = require('./block').Block,
    BlockHeader = require('./block').BlockHeader,
    moment = require('moment');

const getGenesisBlock = () => {
    let blockHeader = new BlockHeader(1, null,
        '0x1bc3300000000000000000000000000000000000000000000',
        moment().unix());

    return new Block(blockHeader, 0, null);
}

const getLatestBlock = () => blockchain[blockchain.length-1];

const addBlock = newBlock => {
    let prevBlock = getLatestBlock();

    if (prevBlock.index < newBlock.index 
        && 
        newBlock.blockHeader.previousBlockHeader === prevBlock.blockHeader.merkleRoot) {
            blockchain.push(newBlock);
        }
}

const getBlock = index => {
    if (blockchain.length - 1 >= index) {
        return blockchain[index];
    } else {
        return null;
    }
}

const blockchain = [getGenesisBlock()];

const chain = {
    addBlock,
    getBlock,
    blockchain,
    getLatestBlock,
};

module.exports = chain