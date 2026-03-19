const express = require('express');
const router = express.Router();
const accountController = require('../controllers/account.controller');
const authorizeUser = require('../middlewares/auth.middleware');

router.post('/create-account', authorizeUser, accountController.createAccount);

module.exports = router;