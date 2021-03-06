let MongoClient = require('mongodb').MongoClient;
let config = require('../config');
const Web3 = require("web3");
const diaContractABI = require('../contractABI/diaTokenABI');

module.exports = {
    insertCoinsPrice: async function (record) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_cmc_price');
            await collection.insertOne(record);
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    },

    removeOldPriceRecords: async function (time) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_cmc_price');
            await collection.deleteMany({timestamp: {$lt: time}})
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    },

    getLatestPrice: async function (record) {
        let mongoClient = new MongoClient(config.mongodb, {useNewUrlParser: true, useUnifiedTopology: true});
        try {
            await mongoClient.connect();
            const collection = mongoClient.db(config.dbName).collection('pasar_cmc_price');
            return await collection.findOne({},{sort:{timestamp: -1}});
        } catch (err) {
            logger.error(err);
        } finally {
            await mongoClient.close();
        }
    },

    diaBalance: async function(addresses) {
        let web3 = new Web3('https://api.elastos.io/eth');
        let diaContract = new web3.eth.Contract(diaContractABI, '0x2C8010Ae4121212F836032973919E8AeC9AEaEE5');

        let promises = [];
        addresses.forEach(address => {
            promises.push(diaContract.methods.balanceOf(address).call());
        })

        let balances = await Promise.all(promises);
        let result = {};
        addresses.forEach((address, index) => {
            result[address] = balances[index];
        })

        return result;
    }
}
