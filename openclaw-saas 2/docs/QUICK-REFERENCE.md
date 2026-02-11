# Quick Reference Guide

## 🚨 Common Commands

### Check Application Status
```bash
pm2 status
pm2 logs openclaw-saas
```

### Restart Application
```bash
pm2 restart openclaw-saas
```

### View Logs
```bash
# Application logs
pm2 logs openclaw-saas

# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Update Code
```bash
cd ~/openclaw-saas
git pull origin main
cd backend
npm install
pm2 restart openclaw-saas
```

### Check AWS Resources
```bash
# List all customer servers
aws ec2 describe-instances \
  --filters "Name=tag:ManagedBy,Values=OpenClawSaaS" \
  --query 'Reservations[*].Instances[*].[InstanceId,State.Name,PublicIpAddress,Tags[?Key==`Name`].Value|[0]]' \
  --output table

# Check costs
aws ce get-cost-and-usage \
  --time-period Start=2024-02-01,End=2024-02-28 \
  --granularity MONTHLY \
  --metrics BlendedCost
```

### Database Management
```bash
# Connect to Supabase
# Go to: https://supabase.com/dashboard/project/[PROJECT-ID]/editor

# Check server count
SELECT user_id, COUNT(*) as server_count 
FROM servers 
GROUP BY user_id;

# Check active servers
SELECT * FROM servers WHERE status = 'running';
```

## 🔧 Troubleshooting Commands

### Application Won't Start
```bash
# Check if port is in use
sudo lsof -i :3000

# Kill process on port
sudo kill -9 $(sudo lsof -t -i:3000)

# Restart
pm2 restart openclaw-saas
```

### Nginx Issues
```bash
# Test config
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx

# Check status
sudo systemctl status nginx
```

### AWS Credential Issues
```bash
# Verify credentials
aws sts get-caller-identity

# Re-configure
aws configure
```

### Server Creation Stuck
```bash
# Check EC2 instances
aws ec2 describe-instances \
  --filters "Name=instance-state-name,Values=pending" \
  --query 'Reservations[*].Instances[*].[InstanceId,LaunchTime]'

# Check recent errors in CloudWatch
aws logs tail /aws/ec2/instances --follow
```

## 📊 Monitoring

### Check Server Health
```bash
# CPU and Memory
top
htop

# Disk space
df -h

# Network
netstat -tuln
```

### Check Database
```bash
# In Supabase dashboard:
# Go to Database → Query Performance
# Check slow queries and optimize
```

## 🔐 Security

### Update System
```bash
sudo apt-get update
sudo apt-get upgrade -y
sudo reboot
```

### Check Firewall
```bash
sudo ufw status
```

### SSL Certificate Renewal
```bash
# Auto-renews, but to test:
sudo certbot renew --dry-run
```

## 💾 Backup

### Backup Database
```bash
# In Supabase:
# Go to Database → Backups
# Create manual backup before major changes
```

### Backup Code
```bash
cd ~/openclaw-saas
git add .
git commit -m "Backup before changes"
git push origin main
```

## 📈 Scaling

### Increase Server Resources
```bash
# Stop instance
aws ec2 stop-instances --instance-ids i-xxxxx

# Change instance type
aws ec2 modify-instance-attribute \
  --instance-id i-xxxxx \
  --instance-type "{\"Value\": \"t3.medium\"}"

# Start instance
aws ec2 start-instances --instance-ids i-xxxxx
```

### Add More Control Servers
```bash
# Launch new instance
aws ec2 run-instances \
  --image-id ami-0c02fb55c47d15a8e \
  --instance-type t3.small \
  --key-name openclaw-saas-key \
  --security-group-ids sg-xxxxx

# Set up load balancer (optional)
```

## 🎯 Performance

### Optimize Node.js
```bash
# Increase Node.js memory
pm2 delete openclaw-saas
pm2 start server.js --name openclaw-saas --node-args="--max-old-space-size=2048"
pm2 save
```

### Optimize Nginx
```bash
sudo nano /etc/nginx/nginx.conf

# Add these in http block:
# gzip on;
# gzip_vary on;
# gzip_proxied any;
# gzip_comp_level 6;
# gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;

sudo systemctl restart nginx
```

## 🚀 Deployment

### Zero-Downtime Deploy
```bash
cd ~/openclaw-saas
git pull origin main
cd backend
npm install
pm2 reload openclaw-saas
```

### Rollback
```bash
cd ~/openclaw-saas
git log --oneline  # Find commit to rollback to
git reset --hard abc123
cd backend
npm install
pm2 restart openclaw-saas
```

## 📱 User Management

### Check User Count
```sql
-- In Supabase SQL Editor
SELECT COUNT(*) FROM auth.users;
```

### Check Active Servers per User
```sql
SELECT 
  u.email,
  COUNT(s.id) as server_count,
  COUNT(CASE WHEN s.status = 'running' THEN 1 END) as running_count
FROM auth.users u
LEFT JOIN servers s ON u.id = s.user_id
GROUP BY u.email
ORDER BY server_count DESC;
```

## 💰 Cost Tracking

### Daily Costs
```bash
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '30 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE
```

### Server Costs
```bash
# Get all running instances
aws ec2 describe-instances \
  --filters "Name=instance-state-name,Values=running" \
  --query 'Reservations[*].Instances[*].[InstanceId,InstanceType]' \
  --output table
```

## 🔔 Alerts

### Set Up CloudWatch Alarms
```bash
# High CPU alert
aws cloudwatch put-metric-alarm \
  --alarm-name openclaw-high-cpu \
  --alarm-description "Alert when CPU exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

## 📞 Emergency Procedures

### Server Down
1. Check PM2: `pm2 status`
2. Check logs: `pm2 logs`
3. Restart: `pm2 restart openclaw-saas`
4. If still down, check Nginx: `sudo systemctl status nginx`
5. Reboot server: `sudo reboot`

### Database Issues
1. Check Supabase status page
2. Verify credentials in .env
3. Check RLS policies
4. Contact Supabase support

### AWS Limit Reached
1. Check AWS quotas in console
2. Request increase via Service Quotas
3. Clean up unused instances
4. Consider multi-region deployment

## 📝 Maintenance Checklist

### Daily
- [ ] Check PM2 status
- [ ] Review error logs
- [ ] Monitor AWS costs

### Weekly
- [ ] Update system packages
- [ ] Review user feedback
- [ ] Check disk space
- [ ] Backup database

### Monthly
- [ ] Review pricing strategy
- [ ] Analyze usage patterns
- [ ] Optimize costs
- [ ] Security audit
- [ ] Update dependencies

## 🎓 Learning Resources

- AWS EC2 Documentation: https://docs.aws.amazon.com/ec2/
- Supabase Docs: https://supabase.com/docs
- PM2 Docs: https://pm2.keymetrics.io/docs/
- Nginx Docs: https://nginx.org/en/docs/
