const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.post('/login', authController.userLoginController);
router.post('/register', authController.userRegisterController);
router.post('/logout', authMiddleware.authMiddleware, authController.userLogoutController);


module.exports = router;