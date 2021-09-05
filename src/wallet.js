const EC = require('elliptic').ec,
    fs = require('fs');

const ec = new EC('secp256k1'),
    privateKeyLocation = __dirname + '/wallet/private_key';

const initWallet = () => {
    let privateKey;

    if (fs.existsSync(privateKeyLocation)) {
        const buffer = fs.readFileSync(privateKeyLocation, 'utf8');
        privateKey = buffer.toString();
    } else {
        privateKey = generatePrivateKey();
        fs.writeFileSync(privateKeyLocation, privateKey);
    }

    const key = ec.keyFromPrivate(privateKey, 'hex');
    const publicKey = key.getPublic().encode('hex');

    return {
        privateKeyLocation,
        publicKey
    };
}

const generatePrivateKey = () => {
    const keyPair = ec.genKeyPair();
    const privateKey = keyPair.getPrivate();

    return privateKey.toString(16);
}

const wallet = {
    initWallet,
}

module.exports = wallet