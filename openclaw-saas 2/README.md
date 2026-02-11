# OpenClaw SaaS Platform

A production-ready SaaS platform for providing managed OpenClaw servers on AWS. Users can deploy, manage, and scale OpenClaw instances with just a few clicks.

## 🌟 Features

- **One-Click Deployment**: Deploy OpenClaw servers in under 3 minutes
- **Google OAuth**: Secure authentication with Google accounts
- **AWS Integration**: Automated EC2 provisioning and management
- **Server Controls**: Start, stop, reboot, and delete servers
- **Multiple Plans**: Basic, Standard, Professional, and Business tiers
- **Real-time Status**: Live server status updates
- **Responsive Design**: Works on desktop and mobile
- **Production Ready**: Built with security and scalability in mind

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│         Frontend (HTML/JS/CSS)          │
│    - Landing Page                       │
│    - Dashboard                          │
│    - Google OAuth Login                 │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│      Backend (Node.js/Express)          │
│    - REST API                           │
│    - Authentication Middleware          │
│    - EC2 Provisioning Logic             │
└──────────┬───────────────┬──────────────┘
           │               │
┌──────────▼─────┐   ┌────▼──────────────┐
│   Supabase     │   │   AWS EC2         │
│  - Auth        │   │  - Server VMs     │
│  - PostgreSQL  │   │  - Auto-provision │
└────────────────┘   └───────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- AWS Account
- Supabase Account
- Node.js 18+
- AWS CLI

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/openclaw-saas.git
cd openclaw-saas
```

### 2. Setup Supabase

1. Create new project at https://supabase.com
2. Enable Google OAuth
3. Run `scripts/database-schema.sql` in SQL Editor
4. Get your API keys

### 3. Setup AWS

```bash
cd scripts
./setup-aws.sh
```

### 4. Configure Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your credentials
npm install
```

### 5. Configure Frontend

```bash
cd frontend
# Edit app.js - Update SUPABASE_URL and SUPABASE_ANON_KEY
```

### 6. Deploy

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for complete deployment instructions.

## 📁 Project Structure

```
openclaw-saas/
├── backend/
│   ├── server.js              # Main Express server
│   ├── provisioner.js         # AWS EC2 provisioning logic
│   ├── utils/
│   │   └── logger.js          # Winston logger
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── index.html             # Main HTML file
│   └── app.js                 # Frontend JavaScript
├── scripts/
│   ├── database-schema.sql    # Supabase database schema
│   └── setup-aws.sh           # AWS setup script
├── docs/
│   └── DEPLOYMENT.md          # Deployment guide
└── README.md
```

## 🔧 Configuration

### Environment Variables

**Backend (.env)**
```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_SECURITY_GROUP_ID=
AWS_KEY_PAIR_NAME=
DEFAULT_AMI=
PORT=3000
NODE_ENV=production
FRONTEND_URL=
```

**Frontend (app.js)**
```javascript
const SUPABASE_URL = 'your-url';
const SUPABASE_ANON_KEY = 'your-key';
```

## 📊 Pricing Plans

| Plan | Price | Instance Type | RAM | Storage |
|------|-------|---------------|-----|---------|
| Basic | $14.99/mo | t3.micro | 1 GB | 20 GB |
| Standard | $29.99/mo | t3.small | 2 GB | 40 GB |
| Professional | $59.99/mo | t3.medium | 4 GB | 80 GB |
| Business | $99.99/mo | t3.large | 8 GB | 160 GB |

## 🔐 Security

- Google OAuth for authentication
- Row Level Security (RLS) in Supabase
- AWS Security Groups for network isolation
- HTTPS/SSL encryption (when using domain)
- Environment variable protection
- Rate limiting on API endpoints

## 🛠️ API Endpoints

### Authentication Required

- `GET /api/user/profile` - Get user profile
- `GET /api/servers` - List user's servers
- `POST /api/servers` - Create new server
- `GET /api/servers/:id` - Get server details
- `POST /api/servers/:id/:action` - Control server (start/stop/reboot)
- `DELETE /api/servers/:id` - Delete server
- `GET /api/stats` - Get usage statistics

### Public

- `GET /api/health` - Health check
- `GET /api/plans` - Get pricing plans

## 📝 Development

### Local Development

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
# Open index.html in browser or use a local server
npx http-server
```

### Testing

```bash
# Test backend
cd backend
npm start

# Access at http://localhost:3000
```

## 🚀 Deployment Options

### Option 1: Single EC2 Instance (Recommended for MVP)
- Deploy everything on one EC2 instance
- Use Nginx to serve frontend and proxy API
- Cost: ~$15/month

### Option 2: AWS Amplify + EC2
- Frontend on Amplify
- Backend on EC2
- Better separation of concerns

### Option 3: Elastic Beanstalk
- Automated scaling
- Load balancing
- Higher cost but more robust

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed instructions.

## 💰 Cost Structure

**Your Costs:**
- Control server (t3.small): $15/month
- Customer servers: $7-60/month each (AWS cost)
- Data transfer: ~$1-5/month

**Revenue (per customer):**
- Basic: $14.99 - $7.59 = **$7.40 profit**
- Standard: $29.99 - $15.18 = **$14.81 profit**
- Professional: $59.99 - $30.37 = **$29.62 profit**
- Business: $99.99 - $60.74 = **$39.25 profit**

## 🐛 Troubleshooting

### Server Creation Fails
- Check AWS credentials
- Verify security group exists
- Check CloudWatch logs

### Can't Sign In
- Verify Google OAuth config
- Check redirect URI
- Clear browser cache

### 502 Bad Gateway
- Restart backend: `pm2 restart openclaw-saas`
- Check logs: `pm2 logs`

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for more troubleshooting.

## 📈 Roadmap

- [x] Core platform
- [x] Google OAuth
- [x] Server provisioning
- [x] Server controls
- [ ] Payment integration (DodoPay)
- [ ] Email notifications
- [ ] Server backups
- [ ] Custom domains
- [ ] Multi-region support
- [ ] Usage analytics

## 📄 License

MIT License - feel free to use for your SaaS business

## 🤝 Contributing

This is a starter template. Feel free to customize for your needs!

## 📞 Support

For deployment help, see [DEPLOYMENT.md](docs/DEPLOYMENT.md)

## ⚡ Quick Deploy Checklist

- [ ] Supabase project created
- [ ] Google OAuth enabled
- [ ] Database schema run
- [ ] AWS CLI configured
- [ ] AWS resources created
- [ ] Backend .env configured
- [ ] Frontend app.js configured
- [ ] EC2 instance launched
- [ ] Code deployed
- [ ] Nginx configured
- [ ] PM2 running app
- [ ] Tested sign-in
- [ ] Tested server creation
- [ ] Ready for users! 🎉
