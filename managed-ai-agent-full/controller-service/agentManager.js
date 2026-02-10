const fs = require('fs');
const { exec } = require('child_process');
exports.deployAgent = (userId, apiKey, telegramToken) => {
  const envPath = `./user_envs/${userId}.env`;
  fs.writeFileSync(envPath, `API_KEY=${apiKey}\nTELEGRAM_TOKEN=${telegramToken}`);
  exec(`pm2 start ../../agent.js --name agent_${userId} --env-file ${envPath}`, (err, stdout)=>{if(err) console.error(err); else console.log(stdout);});
};
exports.stopAgent = (userId) => {
  exec(`pm2 stop agent_${userId} && pm2 delete agent_${userId}`, (err)=>{if(err) console.error(err); else console.log('Stopped');});
};