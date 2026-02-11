#!/bin/bash

# AWS Setup Script for OpenClaw SaaS
# This script sets up the necessary AWS resources

set -e

echo "🚀 OpenClaw SaaS - AWS Setup Script"
echo "===================================="
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install it first:"
    echo "   https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

# Check AWS credentials
echo "✓ Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured. Run: aws configure"
    exit 1
fi

AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
echo "✓ Using AWS Account: $AWS_ACCOUNT"
echo ""

# Set default region
AWS_REGION=${AWS_REGION:-us-east-1}
echo "Using AWS Region: $AWS_REGION"
echo ""

# Create Security Group
echo "📋 Creating Security Group..."
SG_NAME="openclaw-saas-sg"
SG_DESC="Security group for OpenClaw SaaS servers"

# Check if security group already exists
SG_ID=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=$SG_NAME" \
    --query 'SecurityGroups[0].GroupId' \
    --output text \
    --region $AWS_REGION 2>/dev/null || echo "None")

if [ "$SG_ID" = "None" ] || [ -z "$SG_ID" ]; then
    SG_ID=$(aws ec2 create-security-group \
        --group-name $SG_NAME \
        --description "$SG_DESC" \
        --query 'GroupId' \
        --output text \
        --region $AWS_REGION)
    echo "✓ Created Security Group: $SG_ID"
    
    # Add rules
    echo "  Adding ingress rules..."
    
    # SSH
    aws ec2 authorize-security-group-ingress \
        --group-id $SG_ID \
        --protocol tcp \
        --port 22 \
        --cidr 0.0.0.0/0 \
        --region $AWS_REGION
    echo "  ✓ SSH (22)"
    
    # HTTP
    aws ec2 authorize-security-group-ingress \
        --group-id $SG_ID \
        --protocol tcp \
        --port 80 \
        --cidr 0.0.0.0/0 \
        --region $AWS_REGION
    echo "  ✓ HTTP (80)"
    
    # HTTPS
    aws ec2 authorize-security-group-ingress \
        --group-id $SG_ID \
        --protocol tcp \
        --port 443 \
        --cidr 0.0.0.0/0 \
        --region $AWS_REGION
    echo "  ✓ HTTPS (443)"
    
    # OpenClaw port (if different)
    aws ec2 authorize-security-group-ingress \
        --group-id $SG_ID \
        --protocol tcp \
        --port 8080 \
        --cidr 0.0.0.0/0 \
        --region $AWS_REGION
    echo "  ✓ Custom (8080)"
else
    echo "✓ Security Group already exists: $SG_ID"
fi

echo ""

# Create Key Pair
echo "🔑 Creating SSH Key Pair..."
KEY_NAME="openclaw-saas-key"
KEY_FILE="${KEY_NAME}.pem"

# Check if key pair already exists
KEY_EXISTS=$(aws ec2 describe-key-pairs \
    --filters "Name=key-name,Values=$KEY_NAME" \
    --query 'KeyPairs[0].KeyName' \
    --output text \
    --region $AWS_REGION 2>/dev/null || echo "None")

if [ "$KEY_EXISTS" = "None" ] || [ -z "$KEY_EXISTS" ]; then
    aws ec2 create-key-pair \
        --key-name $KEY_NAME \
        --query 'KeyMaterial' \
        --output text \
        --region $AWS_REGION > $KEY_FILE
    
    chmod 400 $KEY_FILE
    echo "✓ Created Key Pair: $KEY_NAME"
    echo "  Private key saved to: $KEY_FILE"
    echo "  ⚠️  IMPORTANT: Keep this file safe! You'll need it to SSH into servers."
else
    echo "✓ Key Pair already exists: $KEY_NAME"
    echo "  ⚠️  If you don't have the .pem file, you'll need to create a new key pair with a different name"
fi

echo ""

# Get latest Ubuntu AMI
echo "🖼️  Finding latest Ubuntu 24.04 LTS AMI..."
AMI_ID=$(aws ec2 describe-images \
    --owners 099720109477 \
    --filters "Name=name,Values=ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*" \
    --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
    --output text \
    --region $AWS_REGION)

echo "✓ Latest Ubuntu AMI: $AMI_ID"
echo ""

# Create IAM User (optional - for API access)
echo "👤 IAM User Setup..."
IAM_USER="openclaw-saas-api"

# Check if user exists
USER_EXISTS=$(aws iam get-user --user-name $IAM_USER --query 'User.UserName' --output text 2>/dev/null || echo "None")

if [ "$USER_EXISTS" = "None" ]; then
    echo "Creating IAM user: $IAM_USER"
    aws iam create-user --user-name $IAM_USER
    
    # Attach EC2 Full Access policy
    aws iam attach-user-policy \
        --user-name $IAM_USER \
        --policy-arn arn:aws:iam::aws:policy/AmazonEC2FullAccess
    
    echo "✓ Created IAM User: $IAM_USER"
    echo "  Creating access keys..."
    
    CREDENTIALS=$(aws iam create-access-key --user-name $IAM_USER --output json)
    ACCESS_KEY=$(echo $CREDENTIALS | grep -o '"AccessKeyId": "[^"]*' | cut -d'"' -f4)
    SECRET_KEY=$(echo $CREDENTIALS | grep -o '"SecretAccessKey": "[^"]*' | cut -d'"' -f4)
    
    echo "  ✓ Access Key ID: $ACCESS_KEY"
    echo "  ⚠️  Secret Access Key: $SECRET_KEY"
    echo "  ⚠️  SAVE THESE CREDENTIALS! They won't be shown again."
else
    echo "✓ IAM User already exists: $IAM_USER"
    echo "  ℹ️  To create new access keys, run:"
    echo "     aws iam create-access-key --user-name $IAM_USER"
fi

echo ""
echo "✅ AWS Setup Complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Configuration Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Add these to your backend/.env file:"
echo ""
echo "AWS_REGION=$AWS_REGION"
echo "AWS_SECURITY_GROUP_ID=$SG_ID"
echo "AWS_KEY_PAIR_NAME=$KEY_NAME"
echo "DEFAULT_AMI=$AMI_ID"
if [ ! -z "$ACCESS_KEY" ]; then
    echo "AWS_ACCESS_KEY_ID=$ACCESS_KEY"
    echo "AWS_SECRET_ACCESS_KEY=$SECRET_KEY"
fi
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. Copy the above configuration to your backend/.env file"
echo "2. Keep the $KEY_FILE file safe"
if [ ! -z "$SECRET_KEY" ]; then
    echo "3. Save your AWS credentials in a secure location"
fi
echo ""
