const schedule = require('node-schedule');
let Web3 = require('web3');
let pasarDBService = require('./service/pasarDBService');
let config = require('./config');
let pasarContractABI = require('./pasarABI');
let stickerContractABI = require('./stickerABI');
let sendMail = require('./send_mail');
const BigNumber = require("bignumber.js");

module.exports = {
    run: function() {
        logger.info("========= Pasar Assist Service start =============")

        const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

        let web3WsProvider = new Web3.providers.WebsocketProvider(config.escWsUrl, {
            reconnect: {
                auto: true,
                delay: 5000,
                maxAttempts: 5,
                onTimeout: false,
            },
        })
        let web3Ws = new Web3(web3WsProvider);
        let pasarContractWs = new web3Ws.eth.Contract(pasarContractABI, config.pasarContract);
        let stickerContractWs = new web3Ws.eth.Contract(stickerContractABI, config.stickerContract);


        let web3Rpc = new Web3(config.escRpcUrl);
        let pasarContract = new web3Rpc.eth.Contract(pasarContractABI, config.pasarContract);
        let stickerContract = new web3Rpc.eth.Contract(stickerContractABI, config.stickerContract);

        let isGetForSaleOrderJobRun = false;
        let isGetTokenInfoJobRun = false;
        let now = Date.now();

        let recipients = [];
        recipients.push('lifayi2008@163.com');

        function updateOrder(orderId, blockNumber) {
            logger.info(`[GetOrderInfo] orderId: ${orderId}   blockNumber: ${blockNumber}`);

            pasarContract.methods.getOrderById(orderId).call().then(result => {
                let pasarOrder = {orderId: result.orderId, orderType: result.orderType, orderState: result.orderState,
                    tokenId: result.tokenId, amount: result.amount, price: result.price, endTime: result.endTime,
                    sellerAddr: result.sellerAddr, buyerAddr: result.buyerAddr, bids: result.bids, lastBidder: result.lastBidder,
                    lastBid: result.lastBid, filled: result.filled, royaltyOwner: result.royaltyOwner, royaltyFee: result.royaltyFee,
                    createTime: result.createTime, updateTime: result.updateTime, blockNumber}

                pasarDBService.updateOrInsert(pasarOrder);
            }).catch(error => {
                logger.info(error);
                logger.info(`[OrderForSale] Sync - getOrderById(${orderId}) call error`);
            })
        }

        let orderForSaleJobId = schedule.scheduleJob(new Date(now + 60 * 1000), async () => {
            isGetForSaleOrderJobRun = true;
            let lastHeight = await pasarDBService.getLastPasarOrderSyncHeight('OrderForSale');

            logger.info(`[OrderForSale] Sync start from height: ${lastHeight}`);

            pasarContractWs.events.OrderForSale({
                fromBlock: lastHeight + 1
            }).on("error", function (error) {
                logger.info(error);
                logger.info("[OrderForSale] Sync Ending ...")
                isGetForSaleOrderJobRun = false
            }).on("data", function (event) {
                let orderInfo = event.returnValues;
                let orderEventDetail = {orderId: orderInfo._orderId, event: event.event, blockNumber: event.blockNumber,
                    tHash: event.transactionHash, tIndex: event.transactionIndex, blockHash: event.blockHash,
                    logIndex: event.logIndex, removed: event.removed, id: event.id}

                logger.info(`[OrderForSale] orderEventDetail: ${JSON.stringify(orderEventDetail)}`)
                pasarDBService.insertOrderEvent(orderEventDetail);
                updateOrder(orderInfo._orderId, event.blockNumber);
            })
        });

        let orderFilledJobId = schedule.scheduleJob(new Date(now + 2 * 60 * 1000), async () => {
            let lastHeight = await pasarDBService.getLastPasarOrderSyncHeight('OrderFilled');

            logger.info(`[OrderFilled] Sync start from height: ${lastHeight}`);

            pasarContractWs.events.OrderFilled({
                fromBlock: lastHeight + 1
            }).on("error", function (error) {
                logger.info(error);
                logger.info("[OrderFilled] Sync Ending ...");
            }).on("data", function (event) {
                let orderInfo = event.returnValues;
                let orderEventDetail = {orderId: orderInfo._orderId, event: event.event, blockNumber: event.blockNumber,
                    tHash: event.transactionHash, tIndex: event.transactionIndex, blockHash: event.blockHash,
                    logIndex: event.logIndex, removed: event.removed, id: event.id}

                logger.info(`[OrderFilled] orderEventDetail: ${JSON.stringify(orderEventDetail)}`)
                pasarDBService.insertOrderEvent(orderEventDetail);
                updateOrder(orderInfo._orderId, event.blockNumber);
            })
        });

        let orderCanceledJobId = schedule.scheduleJob(new Date(now + 2 * 60 * 1000), async () => {
            let lastHeight = await pasarDBService.getLastPasarOrderSyncHeight('OrderCanceled');

            logger.info(`[OrderCanceled] Sync start from height: ${lastHeight}`);

            pasarContractWs.events.OrderCanceled({
                fromBlock: lastHeight + 1
            }).on("error", function (error) {
                logger.info(error);
                logger.info("[OrderCanceled] Sync Ending ...");
            }).on("data", function (event) {
                let orderInfo = event.returnValues;
                let orderEventDetail = {orderId: orderInfo._orderId, event: event.event, blockNumber: event.blockNumber,
                    tHash: event.transactionHash, tIndex: event.transactionIndex, blockHash: event.blockHash,
                    logIndex: event.logIndex, removed: event.removed, id: event.id};

                logger.info(`[OrderCanceled] orderEventDetail: ${JSON.stringify(orderEventDetail)}`)
                pasarDBService.insertOrderEvent(orderEventDetail);
                updateOrder(orderInfo._orderId, event.blockNumber);
            })
        });

        let orderPriceChangedJobId = schedule.scheduleJob(new Date(now + 3 * 60 * 1000), async () => {
            let lastHeight = await pasarDBService.getLastPasarOrderSyncHeight('OrderPriceChanged');

            logger.info(`[OrderPriceChanged] Sync start from height: ${lastHeight}`);

            pasarContractWs.events.OrderPriceChanged({
                fromBlock: lastHeight + 1
            }).on("error", function (error) {
                logger.info(error);
                logger.info("[OrderPriceChanged] Sync Ending ...");
            }).on("data", function (event) {
                let orderInfo = event.returnValues;
                let orderEventDetail = {orderId: orderInfo._orderId, event: event.event, blockNumber: event.blockNumber,
                    tHash: event.transactionHash, tIndex: event.transactionIndex, blockHash: event.blockHash,
                    logIndex: event.logIndex, removed: event.removed, id: event.id}

                logger.info(`[OrderPriceChanged] orderEventDetail: ${JSON.stringify(orderEventDetail)}`)
                pasarDBService.insertOrderEvent(orderEventDetail);
                updateOrder(orderInfo._orderId, event.blockNumber);
            })
        });

        let tokenInfoSyncJobId = schedule.scheduleJob(new Date(now + 60 * 1000), async () => {
            const burnAddress = '0x0000000000000000000000000000000000000000';
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

                logger.info(`[TokenInfo] Sync processing ... ${event.blockNumber} ${tokenId}`)

                if(to === burnAddress) {
                    await pasarDBService.burnToken(tokenId);
                    return;
                }

                if(from === burnAddress) {
                    try {
                        let result = await stickerContract.methods.tokenInfo(tokenId).call();
                        let token = {blockNumber: event.blockNumber, tokenIndex: result.tokenIndex, tokenId,
                            quantity: result.tokenSupply, royalties:result.royaltyFee, royaltyOwner: result.royaltyOwner,
                            holder: result.royaltyOwner, createTime: result.createTime, updateTime: result.updateTime}

                        token.tokenIdHex = '0x' + new BigNumber(tokenId).toString(16);

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
                    return;
                }

                //update token holder
                await pasarDBService.updateToken(tokenId, to);
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

        /**
         *  Pasar order sync check
         */
        schedule.scheduleJob({start: new Date(now + 60 * 1000), rule: '0 */2 * * * *'}, async () => {
            let orderCount = await pasarDBService.pasarOrderCount();
            let orderCountContract = await pasarContract.methods.getOrderCount().call();
            if(orderCountContract - orderCount > 2) {
                sendMail("Pasar Order Sync", "pasar assist sync service sync failed", recipients.join());
            }
        });

        /**
         *  Sticker sync check
         */
        schedule.scheduleJob({start: new Date(now + 60 * 1000), rule: '0 */2 * * * *'}, async () => {
            let stickerCount = await pasarDBService.stickerCount();
            let stickerCountContract = await stickerContract.methods.totalSupply().call();
            if(stickerCountContract - stickerCount > 2) {
                sendMail("Sticker Sync", "pasar assist sync service sync failed", recipients.join());
            }
        });
    }
}
