const express = require('express'),
    chain = require('./chain'),
    wallet = require('./wallet');
const getPort = require('get-port');

const initHttpServer = port => {
    let httpPort = `80${port.toString().slice(-2)}`;
    const app = express();

    app.use(express.json());

    app.get('/blocks', (req, res) => res.send(chain.blockchain))

    app.get('/getBlock', (req, res) => {
        let blockIndex = req.query.index;
        res.send(chain.blockchain[blockIndex]);
    });

    app.get('/getDBBlock', (req, res) => {
        let blockIndex = req.query.index;
        chain.getDbBlock(blockIndex, res);
    });

    app.get('/getWallet', (req, res) => {
        res.send(wallet.initWallet());
    });

    app.listen(httpPort, () => console.log(`Listening on port ${httpPort}`))
}

(async () => {
    const port = await getPort();
    initHttpServer(port);
})();