const pool = require('../database');
const { deployAgent } = require('../../controller-service/agentManager');

exports.deploy = async (req, res) => {
  const { userId, apiKey, telegramToken } = req.body;

  try {
    // Store agent info in Supabase Postgres
    await pool.query(
      'INSERT INTO agents(user_id, api_key, telegram_token, status) VALUES($1, $2, $3, $4)',
      [userId, apiKey, telegramToken, 'deploying']
    );

    // Deploy agent via PM2
    deployAgent(userId, apiKey, telegramToken);

    res.json({ status: 'deploying' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to deploy agent' });
  }
};

exports.status = async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query('SELECT status FROM agents WHERE user_id = $1', [userId]);
    if (result.rows.length > 0) {
      res.json({ status: result.rows[0].status });
    } else {
      res.status(404).json({ error: 'Agent not found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching agent status' });
  }
};
