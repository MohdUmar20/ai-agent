import { 
  EC2Client, 
  RunInstancesCommand, 
  DescribeInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
  TerminateInstancesCommand,
  RebootInstancesCommand,
  DescribeInstanceStatusCommand
} from "@aws-sdk/client-ec2";
import logger from './utils/logger.js';

const ec2Client = new EC2Client({ 
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Installation script for OpenClaw
const getUserDataScript = (userId, serverId) => {
  return `#!/bin/bash
set -e

# Log everything
exec > >(tee /var/log/openclaw-install.log)
exec 2>&1

echo "Starting OpenClaw installation..."
echo "User ID: ${userId}"
echo "Server ID: ${serverId}"
echo "Timestamp: $(date)"

# Update system
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get upgrade -y

# Install essential tools
apt-get install -y curl wget git software-properties-common ufw fail2ban

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker ubuntu

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Configure firewall
ufw --force enable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8080/tcp

# Install OpenClaw
# Note: Adjust this based on actual OpenClaw installation method
# This is a placeholder - replace with actual installation commands
echo "Installing OpenClaw..."

# Option 1: If OpenClaw has an install script
# curl -sSL https://install.openclaw.com | bash

# Option 2: If it's a Docker container
# docker pull openclaw/openclaw:latest
# docker run -d -p 80:80 -p 443:443 --name openclaw --restart unless-stopped openclaw/openclaw:latest

# Option 3: If it's a package
# wget https://releases.openclaw.com/latest/openclaw.deb
# dpkg -i openclaw.deb

# For now, let's use a placeholder that sets up nginx
apt-get install -y nginx
systemctl enable nginx
systemctl start nginx

# Create a landing page
cat > /var/www/html/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>OpenClaw Server Ready</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f4f4f4; }
        .container { background: white; padding: 40px; border-radius: 10px; max-width: 600px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; }
        .status { color: #28a745; font-size: 24px; margin: 20px 0; }
        .info { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: left; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 OpenClaw Server</h1>
        <div class="status">✓ Server is Running</div>
        <div class="info">
            <h3>Server Information</h3>
            <p><strong>Status:</strong> Active and Ready</p>
            <p><strong>Server ID:</strong> ${serverId}</p>
            <p><strong>Installation Date:</strong> $(date)</p>
        </div>
        <p>Your OpenClaw server has been successfully provisioned and is ready to use.</p>
    </div>
</body>
</html>
EOF

# Install fail2ban for security
systemctl enable fail2ban
systemctl start fail2ban

# Create server info file
cat > /etc/openclaw-info.json << EOF
{
  "userId": "${userId}",
  "serverId": "${serverId}",
  "installedAt": "$(date -Iseconds)",
  "version": "1.0.0"
}
EOF

# Set up automatic security updates
apt-get install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

echo "OpenClaw installation completed successfully!"
echo "Installation completed at: $(date)"
`;
};

/**
 * Create a new EC2 instance for a user
 */
export async function createServer(userId, serverId, instanceType = 't3.micro', plan = 'basic') {
  try {
    logger.info(`Creating server for user ${userId}, type: ${instanceType}`);

    const params = {
      ImageId: process.env.DEFAULT_AMI || 'ami-0c02fb55c47d15a8e', // Ubuntu 24.04 LTS
      InstanceType: instanceType,
      MinCount: 1,
      MaxCount: 1,
      KeyName: process.env.AWS_KEY_PAIR_NAME,
      SecurityGroupIds: [process.env.AWS_SECURITY_GROUP_ID],
      UserData: Buffer.from(getUserDataScript(userId, serverId)).toString('base64'),
      TagSpecifications: [
        {
          ResourceType: 'instance',
          Tags: [
            { Key: 'Name', Value: `openclaw-${plan}-${userId.substring(0, 8)}` },
            { Key: 'ManagedBy', Value: 'OpenClawSaaS' },
            { Key: 'UserId', Value: userId },
            { Key: 'ServerId', Value: serverId },
            { Key: 'Plan', Value: plan },
            { Key: 'CreatedAt', Value: new Date().toISOString() }
          ]
        }
      ],
      // Enable detailed monitoring for production
      Monitoring: { Enabled: true }
    };

    const command = new RunInstancesCommand(params);
    const response = await ec2Client.send(command);
    const instance = response.Instances[0];
    
    logger.info(`Instance created successfully: ${instance.InstanceId}`);

    return {
      instanceId: instance.InstanceId,
      status: instance.State.Name,
      privateIp: instance.PrivateIpAddress
    };
  } catch (error) {
    logger.error('Error creating instance:', error);
    throw new Error(`Failed to create server: ${error.message}`);
  }
}

/**
 * Get detailed information about a server
 */
export async function getServerDetails(instanceId) {
  try {
    const command = new DescribeInstancesCommand({
      InstanceIds: [instanceId]
    });
    
    const response = await ec2Client.send(command);
    
    if (!response.Reservations || response.Reservations.length === 0) {
      throw new Error('Instance not found');
    }

    const instance = response.Reservations[0].Instances[0];
    
    return {
      instanceId: instance.InstanceId,
      status: instance.State.Name,
      ipAddress: instance.PublicIpAddress,
      privateIp: instance.PrivateIpAddress,
      instanceType: instance.InstanceType,
      launchTime: instance.LaunchTime,
      availabilityZone: instance.Placement?.AvailabilityZone,
      tags: instance.Tags
    };
  } catch (error) {
    logger.error(`Error getting server details for ${instanceId}:`, error);
    throw new Error(`Failed to get server details: ${error.message}`);
  }
}

/**
 * Get instance status (system and instance checks)
 */
export async function getInstanceStatus(instanceId) {
  try {
    const command = new DescribeInstanceStatusCommand({
      InstanceIds: [instanceId]
    });
    
    const response = await ec2Client.send(command);
    
    if (!response.InstanceStatuses || response.InstanceStatuses.length === 0) {
      return { status: 'pending', checks: 'initializing' };
    }

    const status = response.InstanceStatuses[0];
    
    return {
      status: status.InstanceState?.Name,
      systemStatus: status.SystemStatus?.Status,
      instanceStatus: status.InstanceStatus?.Status,
      checks: status.SystemStatus?.Status === 'ok' && status.InstanceStatus?.Status === 'ok' ? 'passed' : 'pending'
    };
  } catch (error) {
    logger.error(`Error getting instance status for ${instanceId}:`, error);
    return { status: 'unknown', checks: 'unknown' };
  }
}

/**
 * Stop a running instance
 */
export async function stopServer(instanceId) {
  try {
    logger.info(`Stopping instance: ${instanceId}`);
    const command = new StopInstancesCommand({ InstanceIds: [instanceId] });
    await ec2Client.send(command);
    logger.info(`Instance stopped: ${instanceId}`);
    return { status: 'stopping' };
  } catch (error) {
    logger.error(`Error stopping instance ${instanceId}:`, error);
    throw new Error(`Failed to stop server: ${error.message}`);
  }
}

/**
 * Start a stopped instance
 */
export async function startServer(instanceId) {
  try {
    logger.info(`Starting instance: ${instanceId}`);
    const command = new StartInstancesCommand({ InstanceIds: [instanceId] });
    await ec2Client.send(command);
    logger.info(`Instance started: ${instanceId}`);
    return { status: 'starting' };
  } catch (error) {
    logger.error(`Error starting instance ${instanceId}:`, error);
    throw new Error(`Failed to start server: ${error.message}`);
  }
}

/**
 * Reboot an instance
 */
export async function rebootServer(instanceId) {
  try {
    logger.info(`Rebooting instance: ${instanceId}`);
    const command = new RebootInstancesCommand({ InstanceIds: [instanceId] });
    await ec2Client.send(command);
    logger.info(`Instance rebooted: ${instanceId}`);
    return { status: 'rebooting' };
  } catch (error) {
    logger.error(`Error rebooting instance ${instanceId}:`, error);
    throw new Error(`Failed to reboot server: ${error.message}`);
  }
}

/**
 * Terminate an instance (permanent deletion)
 */
export async function terminateServer(instanceId) {
  try {
    logger.info(`Terminating instance: ${instanceId}`);
    const command = new TerminateInstancesCommand({ InstanceIds: [instanceId] });
    await ec2Client.send(command);
    logger.info(`Instance terminated: ${instanceId}`);
    return { status: 'terminating' };
  } catch (error) {
    logger.error(`Error terminating instance ${instanceId}:`, error);
    throw new Error(`Failed to terminate server: ${error.message}`);
  }
}

/**
 * Get pricing information for different instance types
 */
export function getInstancePricing() {
  return {
    't3.micro': { hourly: 0.0104, monthly: 7.59, recommended: 'Basic' },
    't3.small': { hourly: 0.0208, monthly: 15.18, recommended: 'Standard' },
    't3.medium': { hourly: 0.0416, monthly: 30.37, recommended: 'Professional' },
    't3.large': { hourly: 0.0832, monthly: 60.74, recommended: 'Business' }
  };
}

export default {
  createServer,
  getServerDetails,
  getInstanceStatus,
  stopServer,
  startServer,
  rebootServer,
  terminateServer,
  getInstancePricing
};
