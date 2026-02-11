const express = require('express');
const router = express.Router();
const controller = require('../controllers/agentController');

router.post('/deploy', controller.deploy);
router.get('/status/:userId', controller.status);

module.exports = router;