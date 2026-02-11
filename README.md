# Managed AI Agent Hosting (Supabase Integrated)

## Setup Supabase
1. Create a table 'agents':
```sql
CREATE TABLE agents (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  api_key TEXT NOT NULL,
  telegram_token TEXT NOT NULL,
  status TEXT DEFAULT 'deploying',
  created_at TIMESTAMP DEFAULT now()
);
```

## Deployment
- Set environment variables in .env
- Install dependencies in frontend, backend, controller-service
- Start backend: pm2 start backend/server.js --name backend
- Start controller: pm2 start controller-service/index.js --name controller
- Start frontend: npm run build && npm run start
- Dashboard: login with Google and deploy agent