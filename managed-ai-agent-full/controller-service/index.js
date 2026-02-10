const express = require('express');
const { deployAgent } = require('./agentManager');
const app = express();
app.use(express.json());
app.post('/deploy', (req,res)=>{const {userId,apiKey,telegramToken}=req.body; deployAgent(userId,apiKey,telegramToken); res.json({status:'deploying'});});
app.listen(4000,()=>console.log('Controller running on 4000'));