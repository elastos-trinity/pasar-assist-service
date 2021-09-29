let express = require('express');
let router = express.Router();
let dbService = require('../service/indexDBService');
let pasarOrder = require('../service/pasarOrderDBService');

router.post('/register', function(req, res) {
    let ntfToken = req.body;
    if(!ntfToken.tokenId || !ntfToken.name ) {
        res.json({code: 400, message: 'required parameter absence'})
        return;
    }

    dbService.registerNFT(ntfToken).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/get', function(req, res) {
    let tokenId = req.query.tokenId;
    if(!tokenId) {
        res.json({code: 400, message: 'parameter absence'})
        return;
    }

    dbService.getNFT(tokenId).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
})

router.get('/remove', function(req, res) {
    let tokenId = req.query.tokenId;
    if(!tokenId) {
        res.json({code: 400, message: 'bad request'})
        return;
    }

    dbService.removeNFT(tokenId).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/list', function(req, res) {
    let pageNumStr = req.query.pageNum;
    let pageSizeStr = req.query.pageSize;

    let pageNum, pageSize;

    try {
        if(pageNumStr) {
            pageNum = parseInt(pageNumStr);
            if(!pageSizeStr) {
                pageSize = 20;
            } else {
                pageSize = parseInt(pageSizeStr);
            }
        }

        if(pageNum < 1 || pageSize < 1) {
            res.json({code: 400, message: 'bad request'})
            return;
        }
    }catch (e) {
        console.log(e);
        res.json({code: 400, message: 'bad request'});
        return;
    }

    dbService.listNFT(pageNum, pageSize).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

router.get('/listPasarOrder', function(req, res) {
    let pageNumStr = req.query.pageNum;
    let pageSizeStr = req.query.pageSize;

    let pageNum, pageSize;

    try {
        if(pageNumStr) {
            pageNum = parseInt(pageNumStr);
            if(!pageSizeStr) {
                pageSize = 20;
            } else {
                pageSize = parseInt(pageSizeStr);
            }
        }

        if(pageNum < 1 || pageSize < 1) {
            res.json({code: 400, message: 'bad request'})
            return;
        }
    }catch (e) {
        console.log(e);
        res.json({code: 400, message: 'bad request'});
        return;
    }

    pasarOrder.listPasarOrder(pageNum, pageSize).then(result => {
        res.json(result);
    }).catch(error => {
        console.log(error);
        res.json({code: 500, message: 'server error'});
    })
});

module.exports = router;