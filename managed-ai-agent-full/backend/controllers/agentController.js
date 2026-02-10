const { deployAgent } = require('../../controller-service/agentManager');
exports.deploy = (req,res) => {
  const { userId, apiKey, telegramToken } = req.body;
  deployAgent(userId, apiKey, telegramToken);
  res.json({status:'deploying'});
};