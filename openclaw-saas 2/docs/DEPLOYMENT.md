# OpenClaw SaaS - Complete Deployment Guide

## 🎯 Goal
Deploy a production-ready OpenClaw SaaS platform within this week for your first set of users.

## 📋 Prerequisites

Before starting, ensure you have:

- [ ] AWS Account (with billing enabled)
- [ ] Supabase Account (free tier is fine)
- [ ] Domain name (optional but recommended)
- [ ] Git installed
- [ ] Node.js 18+ installed
- [ ] AWS CLI installed

## 🚀 Step-by-Step Deployment

### Step 1: Supabase Setup (15 minutes)

1. **Create Supabase Project**
   - Go to https://supabase.com
   - Click "New Project"
   - Choose a project name: `openclaw-saas`
   - Choose a region (closest to your users)
   - Set a strong database password
   - Click "Create new project"

2. **Enable Google OAuth**
   - Go to Authentication → Providers
   - Enable Google provider
   - Go to Google Cloud Console (https://console.cloud.google.com)
   - Create a new project or select existing
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - Application type: Web application
   - Add authorized redirect URIs:
     ```
     https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback
     ```
   - Copy Client ID and Client Secret
   - Paste them in Supabase Google provider settings
   - Save

3. **Create Database Schema**
   - Go to SQL Editor in Supabase
   - Copy contents from `scripts/database-schema.sql`
   - Paste and run
   - Verify tables created in Table Editor

4. **Get API Keys**
   - Go to Project Settings → API
   - Copy:
     - Project URL
     - Anon/Public key
     - Service Role key (keep secret!)

### Step 2: AWS Setup (20 minutes)

1. **Install AWS CLI** (if not installed)
   ```bash
   # macOS
   brew install awscli
   
   # Linux
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   
   # Windows
   # Download from: https://awscli.amazonaws.com/AWSCLIV2.msi
   ```

2. **Configure AWS Credentials**
   ```bash
   aws configure
   ```
   Enter:
   - AWS Access Key ID
   - AWS Secret Access Key
   - Default region: `us-east-1` (or your preferred region)
   - Default output format: `json`

3. **Run AWS Setup Script**
   ```bash
   cd scripts
   chmod +x setup-aws.sh
   ./setup-aws.sh
   ```
   
   This will:
   - Create security group
   - Create SSH key pair
   - Find latest Ubuntu AMI
   - Create IAM user (optional)
   - Display configuration values

4. **Save the Output**
   - Copy all the AWS configuration values
   - You'll need these in the next step

### Step 3: Backend Configuration (10 minutes)

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Create .env file**
   ```bash
   cp .env.example .env
   ```

3. **Edit .env file** with your values:
   ```env
   # Supabase Configuration
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_KEY=your-service-key

   # AWS Configuration (from AWS setup script)
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key
   AWS_REGION=us-east-1
   AWS_SECURITY_GROUP_ID=sg-xxxxx
   AWS_KEY_PAIR_NAME=openclaw-saas-key
   DEFAULT_AMI=ami-xxxxx

   # Server Configuration
   PORT=3000
   NODE_ENV=production
   FRONTEND_URL=http://your-domain.com
   ```

4. **Install dependencies**
   ```bash
   npm install
   ```

5. **Test locally** (optional)
   ```bash
   npm start
   ```
   Server should start on http://localhost:3000

### Step 4: Frontend Configuration (5 minutes)

1. **Navigate to frontend directory**
   ```bash
   cd ../frontend
   ```

2. **Edit app.js**
   - Open `app.js`
   - Update lines 2-3:
   ```javascript
   const SUPABASE_URL = 'https://xxxxx.supabase.co';
   const SUPABASE_ANON_KEY = 'your-anon-key';
   ```

### Step 5: Deploy to AWS EC2 (30 minutes)

**Option A: Single EC2 Instance (Recommended for MVP)**

1. **Launch EC2 Instance**
   ```bash
   # From project root
   aws ec2 run-instances \
     --image-id ami-0c02fb55c47d15a8e \
     --instance-type t3.small \
     --key-name openclaw-saas-key \
     --security-group-ids sg-xxxxx \
     --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=openclaw-saas-control}]' \
     --region us-east-1
   ```

2. **Get Instance IP**
   ```bash
   aws ec2 describe-instances \
     --filters "Name=tag:Name,Values=openclaw-saas-control" \
     --query 'Reservations[0].Instances[0].PublicIpAddress' \
     --output text
   ```

3. **SSH into Instance**
   ```bash
   ssh -i openclaw-saas-key.pem ubuntu@YOUR-INSTANCE-IP
   ```

4. **Install Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   sudo apt-get install -y git
   ```

5. **Install PM2** (Process Manager)
   ```bash
   sudo npm install -g pm2
   ```

6. **Clone/Upload Your Code**
   
   **Option 1: Using Git**
   ```bash
   git clone https://github.com/your-username/openclaw-saas.git
   cd openclaw-saas
   ```
   
   **Option 2: Using SCP** (from your local machine)
   ```bash
   # From your local project directory
   tar -czf openclaw-saas.tar.gz backend frontend
   scp -i openclaw-saas-key.pem openclaw-saas.tar.gz ubuntu@YOUR-IP:~/
   
   # Then on EC2:
   tar -xzf openclaw-saas.tar.gz
   ```

7. **Install Backend Dependencies**
   ```bash
   cd backend
   npm install --production
   ```

8. **Create .env file on server**
   ```bash
   nano .env
   # Paste your environment variables
   # Press Ctrl+X, then Y, then Enter to save
   ```

9. **Start Application with PM2**
   ```bash
   pm2 start server.js --name openclaw-saas
   pm2 startup
   pm2 save
   ```

10. **Install and Configure Nginx**
    ```bash
    sudo apt-get update
    sudo apt-get install -y nginx
    
    sudo nano /etc/nginx/sites-available/openclaw-saas
    ```
    
    Paste this configuration:
    ```nginx
    server {
        listen 80;
        server_name your-domain.com;  # or your-ec2-ip

        # Frontend
        root /home/ubuntu/openclaw-saas/frontend;
        index index.html;

        # API Proxy
        location /api {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        # Frontend SPA
        location / {
            try_files $uri $uri/ /index.html;
        }
    }
    ```
    
    Enable the site:
    ```bash
    sudo ln -s /etc/nginx/sites-available/openclaw-saas /etc/nginx/sites-enabled/
    sudo nginx -t
    sudo systemctl restart nginx
    ```

11. **Configure Firewall**
    ```bash
    sudo ufw allow 22
    sudo ufw allow 80
    sudo ufw allow 443
    sudo ufw enable
    ```

12. **Test Your Application**
    - Open browser: `http://YOUR-EC2-IP`
    - You should see the landing page
    - Try signing in with Google

### Step 6: Domain Setup (Optional - 15 minutes)

1. **Get Elastic IP** (so IP doesn't change on restart)
   ```bash
   aws ec2 allocate-address --domain vpc
   aws ec2 associate-address \
     --instance-id i-xxxxx \
     --allocation-id eipalloc-xxxxx
   ```

2. **Configure DNS**
   - Go to your domain registrar
   - Add an A record:
     - Name: `@` or `www`
     - Type: `A`
     - Value: `YOUR-ELASTIC-IP`
     - TTL: `300`

3. **Update Nginx for Domain**
   ```bash
   sudo nano /etc/nginx/sites-available/openclaw-saas
   # Change server_name to your actual domain
   sudo systemctl restart nginx
   ```

4. **Install SSL Certificate** (Free with Let's Encrypt)
   ```bash
   sudo apt-get install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

5. **Update Frontend URL in .env**
   ```bash
   cd backend
   nano .env
   # Change FRONTEND_URL to https://your-domain.com
   pm2 restart openclaw-saas
   ```

### Step 7: Testing (15 minutes)

1. **Test Authentication**
   - Sign in with Google
   - Verify you're redirected to dashboard

2. **Test Server Creation**
   - Click "Create New Server"
   - Select a plan (start with Basic)
   - Wait 2-3 minutes
   - Verify server shows up
   - Check AWS console for EC2 instance

3. **Test Server Controls**
   - Try stopping the server
   - Try starting it again
   - Try accessing the server URL

4. **Test on Mobile**
   - Open on your phone
   - Verify responsive design works

### Step 8: Monitoring Setup (10 minutes)

1. **Enable CloudWatch Monitoring**
   ```bash
   # In AWS Console:
   # - Go to EC2 → Instances
   # - Select your instance
   # - Actions → Monitor and troubleshoot → Manage detailed monitoring
   # - Enable
   ```

2. **Check Application Logs**
   ```bash
   pm2 logs openclaw-saas
   ```

3. **Check Nginx Logs**
   ```bash
   sudo tail -f /var/log/nginx/error.log
   sudo tail -f /var/log/nginx/access.log
   ```

## ✅ Production Checklist

Before launching to users:

- [ ] Supabase Google OAuth working
- [ ] Database tables created
- [ ] AWS security group configured
- [ ] Backend environment variables set
- [ ] Frontend Supabase config updated
- [ ] Application deployed to EC2
- [ ] Nginx configured and running
- [ ] PM2 keeping app alive
- [ ] Can sign in with Google
- [ ] Can create server
- [ ] Can control server (start/stop)
- [ ] Can delete server
- [ ] Domain configured (if using)
- [ ] SSL certificate installed (if using domain)
- [ ] Tested on mobile

## 🔧 Troubleshooting

### Issue: Can't sign in with Google
- Verify OAuth credentials in Supabase
- Check redirect URI matches exactly
- Clear browser cache

### Issue: Server creation fails
- Check AWS credentials in .env
- Verify security group exists
- Check CloudWatch logs in AWS
- Check PM2 logs: `pm2 logs`

### Issue: Can't access server URL
- Verify security group allows ports 80, 443
- Check if EC2 instance is running in AWS console
- Wait 3-5 minutes for server to fully provision

### Issue: 502 Bad Gateway
- Check if backend is running: `pm2 status`
- Restart backend: `pm2 restart openclaw-saas`
- Check logs: `pm2 logs`

## 📊 Cost Estimate

**Monthly Costs:**
- Control EC2 (t3.small): ~$15
- Customer EC2s: Variable (you charge more than cost)
- Data transfer: ~$1-5
- **Total: ~$20-25/month** before customers

**Revenue per customer (Basic plan):**
- Your price: $14.99
- AWS cost: $7.59
- **Profit: $7.40/customer/month**

## 🚀 Going Live

1. **Soft Launch**
   - Invite 5-10 beta users
   - Give them free trial for 1 month
   - Collect feedback

2. **Monitor Usage**
   - Watch AWS costs
   - Check server creation success rate
   - Monitor user activity

3. **Add Payment Later**
   - Integrate DodoPay when approved
   - Add subscription management
   - Enable billing

## 📞 Support

If you encounter issues:
1. Check the Troubleshooting section above
2. Review PM2 logs: `pm2 logs openclaw-saas`
3. Check AWS CloudWatch logs
4. Verify all environment variables

## 🎉 You're Done!

Your OpenClaw SaaS platform is now live and ready for users!

Next steps:
- Share with beta users
- Collect feedback
- Integrate payment when DodoPay is ready
- Scale as needed
