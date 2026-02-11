# OpenClaw SaaS - Launch Checklist
## Get to Production in 2 Hours

### ☑️ Phase 1: Accounts & Keys (20 min)

**Supabase Setup**
- [ ] Sign up at https://supabase.com
- [ ] Create new project: `openclaw-saas`
- [ ] Go to Project Settings → API
- [ ] Copy Project URL: `_______________________`
- [ ] Copy Anon Key: `_______________________`
- [ ] Copy Service Key: `_______________________`

**Google OAuth**
- [ ] Go to https://console.cloud.google.com
- [ ] Create OAuth Client ID
- [ ] Copy Client ID: `_______________________`
- [ ] Copy Client Secret: `_______________________`
- [ ] Add to Supabase Auth → Providers → Google
- [ ] Redirect URI: `https://[PROJECT].supabase.co/auth/v1/callback`

**AWS Account**
- [ ] Have AWS account ready
- [ ] Install AWS CLI: `aws --version`
- [ ] Run: `aws configure`
- [ ] Access Key: `_______________________`
- [ ] Secret Key: `_______________________`
- [ ] Region: `us-east-1`

---

### ☑️ Phase 2: Database Setup (10 min)

- [ ] Open Supabase SQL Editor
- [ ] Copy contents of `scripts/database-schema.sql`
- [ ] Paste and run
- [ ] Verify tables created (servers, subscriptions, etc.)
- [ ] Check Authentication → Users (should be empty)

---

### ☑️ Phase 3: AWS Resources (15 min)

- [ ] Navigate to `scripts` folder
- [ ] Run: `chmod +x setup-aws.sh`
- [ ] Run: `./setup-aws.sh`
- [ ] Copy Security Group ID: `_______________________`
- [ ] Copy Key Pair Name: `_______________________`
- [ ] Copy AMI ID: `_______________________`
- [ ] Save the `.pem` file safely!

---

### ☑️ Phase 4: Backend Config (10 min)

- [ ] Navigate to `backend` folder
- [ ] Copy: `cp .env.example .env`
- [ ] Edit `.env` file:

```env
SUPABASE_URL=https://_____.supabase.co
SUPABASE_ANON_KEY=_____
SUPABASE_SERVICE_KEY=_____
AWS_ACCESS_KEY_ID=_____
AWS_SECRET_ACCESS_KEY=_____
AWS_REGION=us-east-1
AWS_SECURITY_GROUP_ID=sg-_____
AWS_KEY_PAIR_NAME=openclaw-saas-key
DEFAULT_AMI=ami-_____
PORT=3000
NODE_ENV=production
FRONTEND_URL=http://your-ip-or-domain
```

- [ ] Save and close

---

### ☑️ Phase 5: Frontend Config (5 min)

- [ ] Navigate to `frontend` folder
- [ ] Open `app.js`
- [ ] Update lines 2-3:

```javascript
const SUPABASE_URL = 'https://_____.supabase.co';
const SUPABASE_ANON_KEY = '_____';
```

- [ ] Save and close

---

### ☑️ Phase 6: Local Test (10 min)

- [ ] Terminal 1: `cd backend && npm install && npm start`
- [ ] Should see: "OpenClaw SaaS Backend running on port 3000"
- [ ] Terminal 2: `cd frontend && npx http-server -p 8080`
- [ ] Open: http://localhost:8080
- [ ] Try signing in with Google
- [ ] If works, Ctrl+C both terminals

---

### ☑️ Phase 7: Deploy to AWS (30 min)

**Launch EC2**
- [ ] Go to AWS Console → EC2 → Launch Instance
- [ ] Name: `openclaw-saas-control`
- [ ] AMI: Ubuntu 24.04 LTS
- [ ] Instance type: `t3.small`
- [ ] Key pair: `openclaw-saas-key`
- [ ] Security group: (select the one you created)
- [ ] Launch instance
- [ ] Wait for status: Running
- [ ] Copy Public IP: `_______________________`

**SSH and Setup**
```bash
ssh -i openclaw-saas-key.pem ubuntu@YOUR-IP

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

# Install PM2
sudo npm install -g pm2

# Clone your code (or use scp)
# If using scp from local machine:
# tar -czf openclaw-saas.tar.gz backend frontend
# scp -i openclaw-saas-key.pem openclaw-saas.tar.gz ubuntu@YOUR-IP:~/

# Extract and setup
tar -xzf openclaw-saas.tar.gz
cd backend
npm install --production

# Create .env (paste your config)
nano .env

# Start app
pm2 start server.js --name openclaw-saas
pm2 startup
pm2 save
```

**Install Nginx**
```bash
sudo apt-get update
sudo apt-get install -y nginx

# Create config
sudo nano /etc/nginx/sites-available/openclaw-saas
```

Paste this:
```nginx
server {
    listen 80;
    server_name _;
    root /home/ubuntu/frontend;
    index index.html;
    
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
# Enable and start
sudo ln -s /etc/nginx/sites-available/openclaw-saas /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# Configure firewall
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

---

### ☑️ Phase 8: Testing (15 min)

- [ ] Open browser: `http://YOUR-EC2-IP`
- [ ] See landing page ✓
- [ ] Click "Sign In with Google"
- [ ] Authenticate successfully ✓
- [ ] See dashboard ✓
- [ ] Click "Create New Server"
- [ ] Select Basic plan
- [ ] Wait 2-3 minutes
- [ ] Server appears in list ✓
- [ ] Check AWS Console → EC2 → Instances
- [ ] See new customer instance ✓
- [ ] Click server URL when ready
- [ ] See OpenClaw running ✓
- [ ] Try Stop button → works ✓
- [ ] Try Start button → works ✓

---

### ☑️ Phase 9: Optional - Domain & SSL (15 min)

**Elastic IP**
```bash
aws ec2 allocate-address --domain vpc
# Note Allocation ID: _______________________

aws ec2 associate-address \
  --instance-id i-_____ \
  --allocation-id eipalloc-_____
```

**DNS Setup**
- [ ] Go to your domain registrar
- [ ] Add A Record:
  - Name: `@` or `openclaw`
  - Type: `A`
  - Value: `YOUR-ELASTIC-IP`
  - TTL: `300`
- [ ] Wait 5-10 minutes for propagation

**SSL Certificate**
```bash
sudo nano /etc/nginx/sites-available/openclaw-saas
# Change server_name to your domain
sudo systemctl restart nginx

sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com

# Update backend .env
cd ~/backend
nano .env
# Change FRONTEND_URL to https://your-domain.com
pm2 restart openclaw-saas
```

---

### ✅ Final Verification

- [ ] Landing page loads
- [ ] Google sign-in works
- [ ] Dashboard shows stats
- [ ] Can create server
- [ ] Can see server status
- [ ] Can access server URL
- [ ] Can stop/start server
- [ ] Can delete server
- [ ] Mobile responsive
- [ ] HTTPS works (if domain setup)

---

### 🎉 You're Live!

**Your Platform URLs:**
- Application: `http://YOUR-IP` or `https://your-domain.com`
- AWS Console: https://console.aws.amazon.com/ec2
- Supabase Dashboard: https://supabase.com/dashboard

**Next Steps:**
1. Invite 5-10 beta users
2. Monitor server creation success rate
3. Watch AWS costs in billing dashboard
4. Integrate DodoPay when approved
5. Collect user feedback

**Important Commands:**
```bash
# Check status
pm2 status
pm2 logs openclaw-saas

# Restart
pm2 restart openclaw-saas

# Update code
cd ~/openclaw-saas
git pull
cd backend
npm install
pm2 restart openclaw-saas
```

---

### 📊 Expected Timeline

| Phase | Time | Status |
|-------|------|--------|
| Accounts & Keys | 20 min | ☐ |
| Database Setup | 10 min | ☐ |
| AWS Resources | 15 min | ☐ |
| Backend Config | 10 min | ☐ |
| Frontend Config | 5 min | ☐ |
| Local Test | 10 min | ☐ |
| Deploy to AWS | 30 min | ☐ |
| Testing | 15 min | ☐ |
| Domain & SSL | 15 min | ☐ |
| **TOTAL** | **2 hours** | ☐ |

---

### 🚨 Troubleshooting

**Can't sign in:** Check Google OAuth redirect URI matches exactly
**Server creation fails:** Verify AWS credentials in .env
**502 Error:** Run `pm2 restart openclaw-saas`
**Nginx errors:** Run `sudo nginx -t` to check config

See `docs/QUICK-REFERENCE.md` for more help.
