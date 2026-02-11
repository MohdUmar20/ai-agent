import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './utils/logger.js';
import {
  createServer as createEC2Server,
  getServerDetails,
  getInstanceStatus,
  stopServer,
  startServer,
  rebootServer,
  terminateServer,
  getInstancePricing
} from './provisioner.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // We'll serve static files
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, '../frontend')));

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Middleware to verify authenticated user
async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      logger.warn('Authentication failed:', error?.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Get user profile
app.get('/api/user/profile', authenticateUser, async (req, res) => {
  try {
    res.json({
      id: req.user.id,
      email: req.user.email,
      name: req.user.user_metadata?.full_name,
      avatar: req.user.user_metadata?.avatar_url,
      created_at: req.user.created_at
    });
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Get pricing plans
app.get('/api/plans', (req, res) => {
  const pricing = getInstancePricing();
  const plans = [
    {
      id: 'basic',
      name: 'Basic',
      instanceType: 't3.micro',
      price: 14.99,
      awsCost: pricing['t3.micro'].monthly,
      specs: {
        cpu: '2 vCPUs',
        ram: '1 GB',
        storage: '20 GB SSD',
        bandwidth: '1 TB'
      },
      features: [
        'OpenClaw Pre-installed',
        'Daily Backups',
        'SSL Certificate',
        'Email Support'
      ]
    },
    {
      id: 'standard',
      name: 'Standard',
      instanceType: 't3.small',
      price: 29.99,
      awsCost: pricing['t3.small'].monthly,
      specs: {
        cpu: '2 vCPUs',
        ram: '2 GB',
        storage: '40 GB SSD',
        bandwidth: '2 TB'
      },
      features: [
        'Everything in Basic',
        'Auto-scaling',
        'Priority Support',
        'Custom Domain'
      ],
      popular: true
    },
    {
      id: 'professional',
      name: 'Professional',
      instanceType: 't3.medium',
      price: 59.99,
      awsCost: pricing['t3.medium'].monthly,
      specs: {
        cpu: '2 vCPUs',
        ram: '4 GB',
        storage: '80 GB SSD',
        bandwidth: '4 TB'
      },
      features: [
        'Everything in Standard',
        'Dedicated Resources',
        '24/7 Support',
        'Advanced Monitoring'
      ]
    },
    {
      id: 'business',
      name: 'Business',
      instanceType: 't3.large',
      price: 99.99,
      awsCost: pricing['t3.large'].monthly,
      specs: {
        cpu: '2 vCPUs',
        ram: '8 GB',
        storage: '160 GB SSD',
        bandwidth: '8 TB'
      },
      features: [
        'Everything in Professional',
        'Custom Configuration',
        'Managed Service',
        'SLA Guarantee'
      ]
    }
  ];

  res.json(plans);
});

// Create new server
app.post('/api/servers', authenticateUser, async (req, res) => {
  try {
    const { planId, instanceType = 't3.micro' } = req.body;
    
    logger.info(`Creating server for user ${req.user.id}, plan: ${planId}`);

    // First, create a record in database
    const { data: serverRecord, error: dbError } = await supabase
      .from('servers')
      .insert({
        user_id: req.user.id,
        instance_type: instanceType,
        status: 'provisioning',
        plan_type: planId || 'basic'
      })
      .select()
      .single();

    if (dbError) {
      logger.error('Database error creating server record:', dbError);
      throw new Error('Failed to create server record');
    }

    // Create EC2 instance asynchronously
    createEC2Server(req.user.id, serverRecord.id, instanceType, planId || 'basic')
      .then(async (instanceData) => {
        // Update database with instance details
        await supabase
          .from('servers')
          .update({
            instance_id: instanceData.instanceId,
            status: instanceData.status,
            private_ip: instanceData.privateIp
          })
          .eq('id', serverRecord.id);
        
        logger.info(`Server provisioned successfully: ${instanceData.instanceId}`);
      })
      .catch(async (error) => {
        logger.error('Error provisioning server:', error);
        // Update status to failed
        await supabase
          .from('servers')
          .update({ status: 'failed' })
          .eq('id', serverRecord.id);
      });

    res.json({ 
      success: true, 
      server: serverRecord,
      message: 'Server provisioning started. This may take 2-3 minutes.'
    });
  } catch (error) {
    logger.error('Error creating server:', error);
    res.status(500).json({ error: error.message || 'Failed to create server' });
  }
});

// Get all servers for authenticated user
app.get('/api/servers', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('servers')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      logger.error('Database error fetching servers:', error);
      throw error;
    }
    
    // Get latest AWS status for each server
    const serversWithStatus = await Promise.all(
      data.map(async (server) => {
        if (server.instance_id && server.status !== 'terminated' && server.status !== 'failed') {
          try {
            const details = await getServerDetails(server.instance_id);
            const status = await getInstanceStatus(server.instance_id);
            
            // Update DB if status changed
            if (details.status !== server.status || details.ipAddress !== server.ip_address) {
              await supabase
                .from('servers')
                .update({ 
                  status: details.status,
                  ip_address: details.ipAddress
                })
                .eq('id', server.id);
            }
            
            return { 
              ...server, 
              status: details.status,
              ip_address: details.ipAddress,
              instance_status: status
            };
          } catch (error) {
            logger.warn(`Could not fetch AWS details for ${server.instance_id}:`, error.message);
            return server;
          }
        }
        return server;
      })
    );
    
    res.json(serversWithStatus);
  } catch (error) {
    logger.error('Error fetching servers:', error);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

// Get single server details
app.get('/api/servers/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: server, error } = await supabase
      .from('servers')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();
    
    if (error || !server) {
      return res.status(404).json({ error: 'Server not found' });
    }
    
    // Get AWS details if instance exists
    if (server.instance_id) {
      try {
        const details = await getServerDetails(server.instance_id);
        const status = await getInstanceStatus(server.instance_id);
        return res.json({ ...server, ...details, instance_status: status });
      } catch (error) {
        logger.warn(`Could not fetch AWS details: ${error.message}`);
      }
    }
    
    res.json(server);
  } catch (error) {
    logger.error('Error fetching server details:', error);
    res.status(500).json({ error: 'Failed to fetch server details' });
  }
});

// Control server (start/stop/reboot)
app.post('/api/servers/:id/:action', authenticateUser, async (req, res) => {
  try {
    const { id, action } = req.params;
    
    // Validate action
    const validActions = ['start', 'stop', 'reboot'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    // Get server from DB
    const { data: server, error: dbError } = await supabase
      .from('servers')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();
    
    if (dbError || !server) {
      return res.status(404).json({ error: 'Server not found' });
    }
    
    if (!server.instance_id) {
      return res.status(400).json({ error: 'Server not yet provisioned' });
    }
    
    logger.info(`${action} server ${server.instance_id} for user ${req.user.id}`);
    
    let result;
    switch (action) {
      case 'start':
        result = await startServer(server.instance_id);
        break;
      case 'stop':
        result = await stopServer(server.instance_id);
        break;
      case 'reboot':
        result = await rebootServer(server.instance_id);
        break;
    }
    
    // Update database
    await supabase
      .from('servers')
      .update({ status: result.status })
      .eq('id', id);
    
    res.json({ success: true, status: result.status, message: `Server ${action} initiated` });
  } catch (error) {
    logger.error(`Error ${req.params.action} server:`, error);
    res.status(500).json({ error: error.message || `Failed to ${req.params.action} server` });
  }
});

// Delete server
app.delete('/api/servers/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get server from DB
    const { data: server, error: dbError } = await supabase
      .from('servers')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();
    
    if (dbError || !server) {
      return res.status(404).json({ error: 'Server not found' });
    }
    
    logger.info(`Deleting server ${server.instance_id} for user ${req.user.id}`);
    
    // Terminate EC2 instance if it exists
    if (server.instance_id) {
      try {
        await terminateServer(server.instance_id);
      } catch (error) {
        logger.warn(`Could not terminate instance: ${error.message}`);
      }
    }
    
    // Delete from database
    await supabase
      .from('servers')
      .delete()
      .eq('id', id);
    
    res.json({ success: true, message: 'Server deleted successfully' });
  } catch (error) {
    logger.error('Error deleting server:', error);
    res.status(500).json({ error: 'Failed to delete server' });
  }
});

// Get usage statistics
app.get('/api/stats', authenticateUser, async (req, res) => {
  try {
    const { data: servers } = await supabase
      .from('servers')
      .select('*')
      .eq('user_id', req.user.id);
    
    const stats = {
      totalServers: servers?.length || 0,
      activeServers: servers?.filter(s => s.status === 'running').length || 0,
      stoppedServers: servers?.filter(s => s.status === 'stopped').length || 0,
      provisioning: servers?.filter(s => s.status === 'provisioning' || s.status === 'pending').length || 0
    };
    
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Cron job to sync server statuses every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    logger.info('Running scheduled server status sync...');
    
    const { data: servers } = await supabase
      .from('servers')
      .select('*')
      .not('instance_id', 'is', null)
      .not('status', 'in', '("terminated","failed")');
    
    if (servers) {
      for (const server of servers) {
        try {
          const details = await getServerDetails(server.instance_id);
          if (details.status !== server.status || details.ipAddress !== server.ip_address) {
            await supabase
              .from('servers')
              .update({
                status: details.status,
                ip_address: details.ipAddress
              })
              .eq('id', server.id);
            logger.info(`Updated status for server ${server.id}: ${details.status}`);
          }
        } catch (error) {
          logger.warn(`Could not sync server ${server.id}: ${error.message}`);
        }
      }
    }
  } catch (error) {
    logger.error('Error in scheduled sync:', error);
  }
});

// Serve frontend for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handler
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`🚀 OpenClaw SaaS Backend running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Frontend URL: ${process.env.FRONTEND_URL || 'Not set'}`);
});

export default app;
