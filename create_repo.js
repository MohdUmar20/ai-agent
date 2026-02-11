// create_repo.js
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, 'managed-ai-agent-full');

// All necessary folders
const folders = [
  'frontend/pages',
  'frontend/components',
  'frontend/styles',
  'frontend/pages/api/auth',
  'backend/controllers',
  'backend/routes',
  'backend/utils',
  'controller-service',
  'user_envs',
];

// Create folders
folders.forEach(folder => fs.mkdirSync(path.join(repoRoot, folder), { recursive: true }));

// Files with content
const files = {
  // Frontend
  'frontend/pages/index.tsx': `export default function Home() { return <h1 className="text-3xl font-bold text-center mt-20">Welcome to Your Managed AI Agent Platform</h1>; }`,
  'frontend/pages/dashboard.tsx': `
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const { data: session } = useSession();
  const [status, setStatus] = useState('unknown');

  const fetchStatus = async () => {
    const res = await fetch(\`/api/agent/status/\${session?.user?.id}\`);
    if(res.ok){
      const data = await res.json();
      setStatus(data.status);
    }
  }

  const deployAgent = async () => {
    const res = await fetch('/api/agent/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: session?.user?.id, apiKey: 'USER_OPENAI_KEY', telegramToken: 'USER_TELEGRAM_TOKEN' })
    });
    if(res.ok) {
      alert('Agent deploying!');
      fetchStatus();
    }
  };

  useEffect(() => { if(session?.user?.id) fetchStatus(); }, [session]);

  return (
    <div className="p-10 text-center">
      <h1>Welcome, {session?.user?.name}</h1>
      <button onClick={deployAgent} className="mt-5 px-5 py-3 bg-blue-600 text-white rounded-lg">Deploy My Agent</button>
      <div className="mt-5">Agent Status: {status}</div>
    </div>
  );
}
`,
  'frontend/pages/api/auth/[...nextauth].ts': `
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!
    })
  ],
  secret: process.env.NEXTAUTH_SECRET
});
`,
  'frontend/components/Navbar.tsx': `export default function Navbar() { return <div className="bg-gray-100 p-4">Your Brand Navbar</div>; }`,
  'frontend/components/DeployButton.tsx': `export default function DeployButton({onClick}) { return <button onClick={onClick}>Deploy</button>; }`,
  'frontend/components/AgentStatusCard.tsx': `export default function AgentStatusCard({status}) { return <div>Status: {status}</div>; }`,

  // Backend
  'backend/database.js': `
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.SUPABASE_CONNECTION,
  ssl: { rejectUnauthorized: false }
});

module.exports = pool;
`,
  'backend/server.js': `
const express = require('express');
const agentRoutes = require('./routes/agentRoutes');
const app = express();
app.use(express.json());
app.use('/api/agent', agentRoutes);
app.listen(3000, ()=>console.log('Backend running on 3000'));
`,
  'backend/controllers/agentController.js': `
const pool = require('../database');
const { deployAgent } = require('../../controller-service/agentManager');

exports.deploy = async (req,res) => {
  const { userId, apiKey, telegramToken } = req.body;
  try {
    await pool.query(
      'INSERT INTO agents(user_id, api_key, telegram_token, status) VALUES($1, $2, $3, $4)',
      [userId, apiKey, telegramToken, 'deploying']
    );
    deployAgent(userId, apiKey, telegramToken);
    res.json({ status: 'deploying' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to deploy agent' });
  }
};

exports.status = async (req,res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query('SELECT status FROM agents WHERE user_id=$1', [userId]);
    if(result.rows.length>0) res.json({ status: result.rows[0].status });
    else res.status(404).json({ error:'Agent not found' });
  } catch(err){
    console.error(err);
    res.status(500).json({ error:'Error fetching agent status' });
  }
};
`,
  'backend/routes/agentRoutes.js': `
const express = require('express');
const router = express.Router();
const controller = require('../controllers/agentController');

router.post('/deploy', controller.deploy);
router.get('/status/:userId', controller.status);

module.exports = router;
`,

  // Controller Service
  'controller-service/agentManager.js': `
const fs = require('fs');
const { exec } = require('child_process');

exports.deployAgent = (userId, apiKey, telegramToken) => {
  const envPath = \`./user_envs/\${userId}.env\`;
  fs.writeFileSync(envPath, \`API_KEY=\${apiKey}\\nTELEGRAM_TOKEN=\${telegramToken}\`);
  exec(\`pm2 start ../../agent.js --name agent_\${userId} --env-file \${envPath}\`, (err, stdout)=>{
    if(err) console.error(err); else console.log(stdout);
  });
};

exports.stopAgent = (userId) => {
  exec(\`pm2 stop agent_\${userId} && pm2 delete agent_\${userId}\`, (err)=>{
    if(err) console.error(err); else console.log('Stopped');
  });
};
`,
  'controller-service/index.js': `
const express = require('express');
const { deployAgent } = require('./agentManager');
const app = express();
app.use(express.json());
app.post('/deploy', (req,res)=>{
  const {userId, apiKey, telegramToken} = req.body;
  deployAgent(userId, apiKey, telegramToken);
  res.json({status:'deploying'});
});
app.listen(4000, ()=>console.log('Controller running on 4000'));
`,

  // Agent
  'agent.js': `console.log("User agent running..."); setInterval(()=>{},1000);`,

  // Config
  '.env.example': `GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
NEXTAUTH_SECRET=xxx
SUPABASE_CONNECTION=postgresql://postgres:[YOUR-PASSWORD]@db.sapgdmzffksekinzrerr.supabase.co:5432/postgres
`,

  'package.json': `{"name":"managed-ai-agent","version":"1.0.0","dependencies":{}}`,

  'README.md': `# Managed AI Agent Hosting (Supabase Integrated)

## Setup Supabase
1. Create a table 'agents':
\`\`\`sql
CREATE TABLE agents (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  api_key TEXT NOT NULL,
  telegram_token TEXT NOT NULL,
  status TEXT DEFAULT 'deploying',
  created_at TIMESTAMP DEFAULT now()
);
\`\`\`

## Deployment
- Set environment variables in .env
- Install dependencies in frontend, backend, controller-service
- Start backend: pm2 start backend/server.js --name backend
- Start controller: pm2 start controller-service/index.js --name controller
- Start frontend: npm run build && npm run start
- Dashboard: login with Google and deploy agent
`
};

// Write files (ensure parent folders exist)
Object.entries(files).forEach(([relativePath, content]) => {
  const filePath = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.trim());
});

console.log('✅ Managed AI Agent repo (Supabase integrated) created at ./managed-ai-agent-full');
