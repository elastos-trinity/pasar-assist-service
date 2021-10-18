const schedule = require('node-schedule');
let Web3 = require('web3');
let pasarDBService = require('./service/pasarDBService');
let config = require('./config');
let pasarContractABI = require('./pasarABI');
let stickerContractABI = require('./stickerABI');

module.exports = {
    run: function() {

        const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

        let web3WsProvider = new Web3.providers.WebsocketProvider(config.escWsUrl, {
            reconnect: {
                auto: true,
                delay: 5000,
                maxAttempts: 5,
                onTimeout: false,
            },
        })
        let web3 = new Web3(web3WsProvider);
        let pasarContract = new web3.eth.Contract(pasarContractABI, config.pasarContract);

        let web3Sticker = new Web3(config.escRpcUrl);
        let stickerContract = new web3Sticker.eth.Contract(stickerContractABI, config.stickerContract);

        let stickerContractWs = new web3.eth.Contract(stickerContractABI, config.stickerContract);

        let isGetForSaleOrderJobRun = false;
        let isGetTokenInfoJobRun = false;
        let now = Date.now();

        let orderForSaleJobId = schedule.scheduleJob(new Date(now + 60 * 1000), async () => {
            logger.info("[OrderForSale] Sync Starting ...")
            isGetForSaleOrderJobRun = true;
            let lastHeight = await pasarDBService.getLastPasarOrderSyncHeight('OrderForSale');
            logger.info("[OrderForSale] Sync last height: " + lastHeight)
            pasarContract.events.OrderForSale({
                fromBlock: lastHeight + 1
            }).on("error", function (error) {
                logger.info(error);
                logger.info("[OrderForSale] Sync Ending ...")
                isGetForSaleOrderJobRun = false
            }).on("data", function (event) {
                let orderInfo = event.returnValues;
                let pasarOrder = {orderId: orderInfo._orderId, event: event.event, seller: orderInfo._seller,
                    tokenId: orderInfo._tokenId, amount: orderInfo._amount, price: orderInfo._price}

                let orderEventDetail = {orderId: orderInfo._orderId, event: event.event, blockNumber: event.blockNumber,
                    tHash: event.transactionHash, tIndex: event.transactionIndex, blockHash: event.blockHash,
                    logIndex: event.logIndex, removed: event.removed, id: event.id}

                pasarDBService.insertOrderEvent(orderEventDetail);
                pasarDBService.insertOrder(pasarOrder);
            })
        });

        let orderFilledJobId = schedule.scheduleJob(new Date(now + 2 * 60 * 1000), async () => {
            logger.info("[OrderFilled] Sync Starting ...")
            let lastHeight = await pasarDBService.getLastPasarOrderSyncHeight('OrderFilled');
            pasarContract.events.OrderFilled({
                fromBlock: lastHeight + 1
            }).on("error", function (error) {
                logger.info(error);
                logger.info("[OrderFilled] Sync Ending ...");
            }).on("data", function (event) {
                let orderInfo = event.returnValues;
                let pasarOrder = {orderId: orderInfo._orderId, event: event.event, seller: orderInfo._seller,
                    buyer: orderInfo._buyer, copyrightOwner: orderInfo._copyrightOwner, price: orderInfo._price,
                    royalty: orderInfo._royalty};

                let orderEventDetail = {orderId: orderInfo._orderId, event: event.event, blockNumber: event.blockNumber,
                    tHash: event.transactionHash, tIndex: event.transactionIndex, blockHash: event.blockHash,
                    logIndex: event.logIndex, removed: event.removed, id: event.id}

                pasarDBService.insertOrderEvent(orderEventDetail);
                pasarDBService.updateOrder(pasarOrder);
            })
        });

        let orderCanceledJobId = schedule.scheduleJob(new Date(now + 2 * 60 * 1000), async () => {
            logger.info("[OrderCanceled] Sync Starting ...")
            let lastHeight = await pasarDBService.getLastPasarOrderSyncHeight('OrderCanceled');
            pasarContract.events.OrderCanceled({
                fromBlock: lastHeight + 1
            }).on("error", function (error) {
                logger.info(error);
                logger.info("[OrderCanceled] Sync Ending ...");
            }).on("data", function (event) {
                let orderInfo = event.returnValues;
                let pasarOrder = {orderId: orderInfo._orderId, event: event.event, seller: orderInfo._seller};

                let orderEventDetail = {orderId: orderInfo._orderId, event: event.event, blockNumber: event.blockNumber,
                    tHash: event.transactionHash, tIndex: event.transactionIndex, blockHash: event.blockHash,
                    logIndex: event.logIndex, removed: event.removed, id: event.id};

                pasarDBService.insertOrderEvent(orderEventDetail);
                pasarDBService.updateOrder(pasarOrder);
            })
        });

        let orderPriceChangedJobId = schedule.scheduleJob(new Date(now + 3 * 60 * 1000), async () => {
            logger.info("[OrderPriceChanged] Sync Starting ...")
            let lastHeight = await pasarDBService.getLastPasarOrderSyncHeight('OrderPriceChanged');
            pasarContract.events.OrderPriceChanged({
                fromBlock: lastHeight + 1
            }).on("error", function (error) {
                logger.info(error);
                logger.info("[OrderPriceChanged] Sync Ending ...");
            }).on("data", function (event) {
                let orderInfo = event.returnValues;
                let pasarOrder = {orderId: orderInfo[1], price: orderInfo[3]}

                let orderEventDetail = {orderId: orderInfo[1], event: event.event, blockNumber: event.blockNumber,
                    tHash: event.transactionHash, tIndex: event.transactionIndex, blockHash: event.blockHash,
                    logIndex: event.logIndex, removed: event.removed, id: event.id}

                pasarDBService.insertOrderEvent(orderEventDetail);
                pasarDBService.updateOrder(pasarOrder);
            })
        });

        let tokenInfoSyncJobId = schedule.scheduleJob(new Date(now + 60 * 1000), async () => {
            let lastHeight = await pasarDBService.getLastStickerSyncHeight();
            isGetTokenInfoJobRun = true;
            logger.info(`[TokenInfo] Sync Starting ... from block ${lastHeight + 1}`)

            stickerContractWs.events.TransferSingle({
                fromBlock: lastHeight + 1
            }).on("error", function (error) {
                logger.info(error);
                logger.info("[TokenInfo] Sync Ending ...");
                isGetTokenInfoJobRun = false
            }).on("data", async function (event) {
                let from = event.returnValues._from;
                let to = event.returnValues._to;
                let tokenId = event.returnValues._id;
                if(to === "0x0000000000000000000000000000000000000000") {
                    await pasarDBService.burnToken(tokenId);
                }

                if(from === "0x0000000000000000000000000000000000000000") {
                    try {
                        let result = await stickerContract.methods.tokenInfo(tokenId).call();
                        let token = {blockNumber: event.blockNumber, tokenIndex: result.tokenIndex, tokenId, quantity: result.tokenSupply,
                            royalties:result.royaltyFee, royaltyOwner: result.royaltyOwner, createTime: result.createTime,
                            updateTime: result.updateTime}

                        let tokenCID = result.tokenUri.split(":")[2];

                        let response = await fetch(config.ipfsNodeUrl + tokenCID);
                        let data = await response.json();
                        token.kind = data.kind;
                        token.type = data.type;
                        token.asset = data.image;
                        token.name = data.name;
                        token.description = data.description;
                        token.thumbnail = data.thumbnail;

                        await pasarDBService.replaceToken(token);
                    } catch (e) {
                        logger.info(`[TokenInfo] Sync error at ${event.blockNumber} ${tokenId}`);
                        logger.info(e);
                    }
                }
            })
        });

        schedule.scheduleJob({start: new Date(now + 61 * 1000), rule: '0 */2 * * * *'}, () => {
            let now = Date.now();

            if(!isGetForSaleOrderJobRun) {
                orderForSaleJobId.reschedule(new Date(now + 60 * 1000));
                orderFilledJobId.reschedule(new Date(now + 2 * 60 * 1000));
                orderCanceledJobId.reschedule(new Date(now + 2 * 60 * 1000));
                orderPriceChangedJobId.reschedule(new Date(now + 3 * 60 * 1000));
            }

            if(!isGetTokenInfoJobRun) {
                tokenInfoSyncJobId.reschedule(new Date(now + 60 * 1000))
            }
        });
    }
}
