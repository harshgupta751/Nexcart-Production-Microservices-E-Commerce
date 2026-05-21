# ShopFlow AWS Production Deployment Guide

## Architecture Overview

```
Internet
    │
    ▼
Route 53 (DNS)
    │
    ▼
ACM Certificate (HTTPS)
    │
    ▼
Application Load Balancer (ALB)
    │
    ├──/api/* ──► EC2 Auto Scaling Group
    │              └── Docker: API Gateway (port 3000)
    │                         │
    │              ┌──────────┼──────────────────┐
    │              ▼          ▼                  ▼
    │         Auth-Service  Product-Service  Order-Service
    │         (EC2/Docker)  (EC2/Docker)    (EC2/Docker)
    │              │              │              │
    │         RDS PostgreSQL  DocumentDB    RDS PostgreSQL
    │              │
    │         ElastiCache Redis ◄──── Rate Limiting / Cache / Cart
    │              │
    │         Amazon MQ ◄──────────── RabbitMQ Events
    │
    └──/* ──► S3 + CloudFront (Next.js static export)
```

---

## Prerequisites

```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install

# Configure
aws configure
# AWS Access Key ID: <your-key>
# AWS Secret Access Key: <your-secret>
# Default region: us-east-1
# Default output format: json

# Install Docker
sudo apt-get update && sudo apt-get install -y docker.io docker-compose
```

---

## Step 1 — VPC & Networking

```bash
# Create VPC
VPC_ID=$(aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --query 'Vpc.VpcId' --output text)

aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-hostnames

# Create public subnets (for ALB)
SUBNET_PUB_1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.1.0/24 \
  --availability-zone us-east-1a \
  --query 'Subnet.SubnetId' --output text)

SUBNET_PUB_2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.2.0/24 \
  --availability-zone us-east-1b \
  --query 'Subnet.SubnetId' --output text)

# Create private subnets (for EC2 services)
SUBNET_PRIV_1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.10.0/24 \
  --availability-zone us-east-1a \
  --query 'Subnet.SubnetId' --output text)

SUBNET_PRIV_2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.11.0/24 \
  --availability-zone us-east-1b \
  --query 'Subnet.SubnetId' --output text)

# Internet Gateway
IGW_ID=$(aws ec2 create-internet-gateway --query 'InternetGateway.InternetGatewayId' --output text)
aws ec2 attach-internet-gateway --vpc-id $VPC_ID --internet-gateway-id $IGW_ID

# NAT Gateway (for private subnet outbound)
EIP=$(aws ec2 allocate-address --query 'AllocationId' --output text)
NAT_GW=$(aws ec2 create-nat-gateway \
  --subnet-id $SUBNET_PUB_1 \
  --allocation-id $EIP \
  --query 'NatGateway.NatGatewayId' --output text)

echo "VPC: $VPC_ID"
echo "Public Subnets: $SUBNET_PUB_1, $SUBNET_PUB_2"
echo "Private Subnets: $SUBNET_PRIV_1, $SUBNET_PRIV_2"
```

---

## Step 2 — Security Groups

```bash
# ALB Security Group
SG_ALB=$(aws ec2 create-security-group \
  --group-name shopflow-alb-sg \
  --description "ShopFlow ALB" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)

aws ec2 authorize-security-group-ingress --group-id $SG_ALB --protocol tcp --port 80  --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SG_ALB --protocol tcp --port 443 --cidr 0.0.0.0/0

# EC2 Services Security Group (only from ALB)
SG_EC2=$(aws ec2 create-security-group \
  --group-name shopflow-ec2-sg \
  --description "ShopFlow EC2 Services" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)

aws ec2 authorize-security-group-ingress --group-id $SG_EC2 --protocol tcp --port 3000 --source-group $SG_ALB
aws ec2 authorize-security-group-ingress --group-id $SG_EC2 --protocol tcp --port 22   --cidr 0.0.0.0/0  # Restrict in prod

# RDS Security Group (only from EC2)
SG_RDS=$(aws ec2 create-security-group \
  --group-name shopflow-rds-sg \
  --description "ShopFlow RDS" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)

aws ec2 authorize-security-group-ingress --group-id $SG_RDS --protocol tcp --port 5432 --source-group $SG_EC2

# Redis Security Group
SG_REDIS=$(aws ec2 create-security-group \
  --group-name shopflow-redis-sg \
  --description "ShopFlow ElastiCache" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)

aws ec2 authorize-security-group-ingress --group-id $SG_REDIS --protocol tcp --port 6379 --source-group $SG_EC2
```

---

## Step 3 — RDS PostgreSQL (Multi-AZ)

```bash
# Create DB Subnet Group
aws rds create-db-subnet-group \
  --db-subnet-group-name shopflow-db-subnet \
  --db-subnet-group-description "ShopFlow RDS Subnets" \
  --subnet-ids $SUBNET_PRIV_1 $SUBNET_PRIV_2

# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier shopflow-postgres \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 15.4 \
  --master-username shopflow \
  --master-user-password "$(openssl rand -base64 24)" \
  --allocated-storage 20 \
  --max-allocated-storage 100 \
  --storage-type gp3 \
  --storage-encrypted \
  --multi-az \
  --vpc-security-group-ids $SG_RDS \
  --db-subnet-group-name shopflow-db-subnet \
  --backup-retention-period 7 \
  --deletion-protection \
  --no-publicly-accessible

# Wait for RDS to be available
aws rds wait db-instance-available --db-instance-identifier shopflow-postgres

# Get endpoint
RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier shopflow-postgres \
  --query 'DBInstances[0].Endpoint.Address' --output text)

echo "RDS Endpoint: $RDS_ENDPOINT"
```

---

## Step 4 — MongoDB Atlas (External)

Create a free/paid cluster at https://cloud.mongodb.com:
1. Create a new project: "shopflow"
2. Create a cluster (M10+ for production)
3. Add database user: `shopflow` with a strong password
4. Add your EC2 IP/VPC CIDR to Network Access
5. Get connection string: `mongodb+srv://shopflow:<password>@cluster.mongodb.net/product_db`

---

## Step 5 — ElastiCache Redis

```bash
# Create subnet group
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name shopflow-redis-subnet \
  --cache-subnet-group-description "ShopFlow Redis Subnets" \
  --subnet-ids $SUBNET_PRIV_1 $SUBNET_PRIV_2

# Create Redis cluster (with Multi-AZ failover)
aws elasticache create-replication-group \
  --replication-group-id shopflow-redis \
  --replication-group-description "ShopFlow Redis" \
  --num-cache-clusters 2 \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --engine-version 7.0 \
  --security-group-ids $SG_REDIS \
  --cache-subnet-group-name shopflow-redis-subnet \
  --auth-token "$(openssl rand -base64 32)" \
  --transit-encryption-enabled \
  --automatic-failover-enabled

# Get Redis endpoint
REDIS_ENDPOINT=$(aws elasticache describe-replication-groups \
  --replication-group-id shopflow-redis \
  --query 'ReplicationGroups[0].NodeGroups[0].PrimaryEndpoint.Address' --output text)

echo "Redis: $REDIS_ENDPOINT"
```

---

## Step 6 — Amazon MQ (RabbitMQ)

```bash
aws mq create-broker \
  --broker-name shopflow-rabbitmq \
  --engine-type RABBITMQ \
  --engine-version 3.12.13 \
  --deployment-mode SINGLE_INSTANCE \
  --host-instance-type mq.m5.large \
  --user Username=shopflow,Password="$(openssl rand -base64 24)" \
  --publicly-accessible false \
  --subnet-ids $SUBNET_PRIV_1 \
  --security-groups $SG_EC2

# Get AMQP endpoint
MQ_ENDPOINT=$(aws mq describe-broker \
  --broker-id shopflow-rabbitmq \
  --query 'BrokerInstances[0].Endpoints[0]' --output text)

echo "Amazon MQ: $MQ_ENDPOINT"
```

---

## Step 7 — S3 Buckets

```bash
# Product images bucket
aws s3 mb s3://shopflow-product-images-$(date +%s)
aws s3api put-bucket-cors \
  --bucket shopflow-product-images \
  --cors-configuration '{
    "CORSRules": [{
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST"],
      "AllowedOrigins": ["https://your-domain.com"],
      "MaxAgeSeconds": 3000
    }]
  }'

# Static assets (Next.js) — if deploying static export
aws s3 mb s3://shopflow-frontend-$(date +%s)
aws s3api put-bucket-website \
  --bucket shopflow-frontend \
  --website-configuration '{"IndexDocument":{"Suffix":"index.html"},"ErrorDocument":{"Key":"404.html"}}'
```

---

## Step 8 — ECR (Container Registry)

```bash
# Create repositories
for svc in gateway auth-service user-service product-service cart-service order-service payment-service notification-service; do
  aws ecr create-repository --repository-name shopflow-$svc --region us-east-1
done

# Login to ECR
ECR_REGISTRY=$(aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  $(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-east-1.amazonaws.com && \
  echo "$(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-east-1.amazonaws.com")

# Build and push all images
export IMAGE_TAG=$(git rev-parse --short HEAD)
export ECR_REGISTRY

for svc in gateway auth-service user-service product-service cart-service order-service payment-service notification-service; do
  echo "Building $svc..."
  docker build -t $ECR_REGISTRY/shopflow-$svc:$IMAGE_TAG \
    -f services/$svc/Dockerfile . 2>/dev/null || \
  docker build -t $ECR_REGISTRY/shopflow-$svc:$IMAGE_TAG \
    -f gateway/Dockerfile .
  docker push $ECR_REGISTRY/shopflow-$svc:$IMAGE_TAG
done
```

---

## Step 9 — EC2 Setup (Launch Template)

```bash
# Create IAM role for EC2
aws iam create-role \
  --role-name shopflow-ec2-role \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

aws iam attach-role-policy \
  --role-name shopflow-ec2-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly

aws iam attach-role-policy \
  --role-name shopflow-ec2-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

aws iam create-instance-profile --instance-profile-name shopflow-ec2-profile
aws iam add-role-to-instance-profile \
  --instance-profile-name shopflow-ec2-profile \
  --role-name shopflow-ec2-role

# User data script for EC2 instances
cat > /tmp/user-data.sh << 'EOF'
#!/bin/bash
yum update -y
yum install -y docker
systemctl start docker
systemctl enable docker
usermod -aG docker ec2-user

# Install docker-compose
curl -L "https://github.com/docker/compose/releases/download/v2.23.3/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin ${ECR_REGISTRY}

# Pull and run
docker-compose -f /app/docker-compose.prod.yml up -d
EOF

# Create launch template
aws ec2 create-launch-template \
  --launch-template-name shopflow-template \
  --launch-template-data '{
    "ImageId": "ami-0c02fb55956c7d316",
    "InstanceType": "t3.medium",
    "IamInstanceProfile": {"Name": "shopflow-ec2-profile"},
    "SecurityGroupIds": ["'$SG_EC2'"],
    "UserData": "'$(base64 -w0 /tmp/user-data.sh)'"
  }'
```

---

## Step 10 — Application Load Balancer

```bash
# Create ALB
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name shopflow-alb \
  --subnets $SUBNET_PUB_1 $SUBNET_PUB_2 \
  --security-groups $SG_ALB \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text)

# Create target group for API Gateway
TG_ARN=$(aws elbv2 create-target-group \
  --name shopflow-gateway-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id $VPC_ID \
  --target-type instance \
  --health-check-path /health \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --query 'TargetGroups[0].TargetGroupArn' --output text)

# Create HTTPS listener (requires ACM cert)
CERT_ARN="arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID"

aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=$CERT_ARN \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN

# HTTP → HTTPS redirect
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions 'Type=redirect,RedirectConfig={Protocol=HTTPS,Port=443,StatusCode=HTTP_301}'

ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns $ALB_ARN \
  --query 'LoadBalancers[0].DNSName' --output text)

echo "ALB DNS: $ALB_DNS"
```

---

## Step 11 — Auto Scaling Group

```bash
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name shopflow-asg \
  --launch-template LaunchTemplateName=shopflow-template,Version='$Latest' \
  --min-size 2 \
  --max-size 6 \
  --desired-capacity 2 \
  --vpc-zone-identifier "$SUBNET_PRIV_1,$SUBNET_PRIV_2" \
  --target-group-arns $TG_ARN \
  --health-check-type ELB \
  --health-check-grace-period 120

# CPU-based scaling policy
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name shopflow-asg \
  --policy-name shopflow-cpu-scaling \
  --policy-type TargetTrackingScaling \
  --target-tracking-configuration '{
    "PredefinedMetricSpecification": {"PredefinedMetricType": "ASGAverageCPUUtilization"},
    "TargetValue": 70.0
  }'
```

---

## Step 12 — Route 53 (DNS)

```bash
# Create hosted zone (if you own a domain)
HOSTED_ZONE_ID=$(aws route53 create-hosted-zone \
  --name your-domain.com \
  --caller-reference $(date +%s) \
  --query 'HostedZone.Id' --output text)

# Create A record pointing to ALB
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.your-domain.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "'$(aws elbv2 describe-load-balancers --load-balancer-arns $ALB_ARN --query "LoadBalancers[0].CanonicalHostedZoneId" --output text)'",
          "DNSName": "'$ALB_DNS'",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'
```

---

## Step 13 — GitHub Actions CI/CD

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy ShopFlow

on:
  push:
    branches: [main]

env:
  AWS_REGION: us-east-1
  ECR_REGISTRY: ${{ secrets.ECR_REGISTRY }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push images
        run: |
          export IMAGE_TAG=${{ github.sha }}
          for svc in gateway auth-service user-service product-service cart-service order-service payment-service notification-service; do
            docker build -t $ECR_REGISTRY/shopflow-$svc:$IMAGE_TAG \
              -f services/$svc/Dockerfile . || \
            docker build -t $ECR_REGISTRY/shopflow-$svc:$IMAGE_TAG \
              -f gateway/Dockerfile .
            docker push $ECR_REGISTRY/shopflow-$svc:$IMAGE_TAG
          done

      - name: Deploy to EC2 via SSM
        run: |
          aws ssm send-command \
            --targets "Key=tag:Name,Values=shopflow-ec2" \
            --document-name "AWS-RunShellScript" \
            --parameters 'commands=[
              "cd /app",
              "export IMAGE_TAG=${{ github.sha }}",
              "docker-compose -f docker-compose.prod.yml pull",
              "docker-compose -f docker-compose.prod.yml up -d --no-build",
              "docker image prune -f"
            ]'
```

---

## Production Environment Variables

Create AWS Secrets Manager entries:

```bash
aws secretsmanager create-secret \
  --name shopflow/production \
  --secret-string '{
    "JWT_SECRET": "your-256-bit-secret",
    "DATABASE_URL_AUTH": "postgresql://shopflow:pass@'$RDS_ENDPOINT':5432/auth_db",
    "DATABASE_URL_USER": "postgresql://shopflow:pass@'$RDS_ENDPOINT':5432/user_db",
    "DATABASE_URL_ORDER": "postgresql://shopflow:pass@'$RDS_ENDPOINT':5432/order_db",
    "DATABASE_URL_PAYMENT": "postgresql://shopflow:pass@'$RDS_ENDPOINT':5432/payment_db",
    "MONGODB_URL": "mongodb+srv://shopflow:pass@cluster.mongodb.net/product_db",
    "REDIS_URL": "rediss://:authtoken@'$REDIS_ENDPOINT':6379",
    "RABBITMQ_URL": "amqps://shopflow:pass@'$MQ_ENDPOINT':5671",
    "STRIPE_SECRET_KEY": "sk_live_...",
    "STRIPE_WEBHOOK_SECRET": "whsec_..."
  }'
```

---

## Monitoring & Observability

```bash
# CloudWatch Log Groups (auto-created by containers)
aws logs create-log-group --log-group-name /shopflow/gateway
aws logs create-log-group --log-group-name /shopflow/auth-service
aws logs create-log-group --log-group-name /shopflow/order-service

# CloudWatch Alarm — high 5xx errors
aws cloudwatch put-metric-alarm \
  --alarm-name shopflow-5xx-errors \
  --metric-name HTTPCode_Target_5XX_Count \
  --namespace AWS/ApplicationELB \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 50 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT:shopflow-alerts
```

---

## Cost Estimate (Monthly)

| Service | Spec | Estimated Cost |
|---|---|---|
| EC2 (2× t3.medium) | 2 instances | ~$60 |
| RDS PostgreSQL (t3.medium, Multi-AZ) | 20GB | ~$70 |
| ElastiCache Redis (t3.micro × 2) | — | ~$25 |
| Amazon MQ (mq.m5.large) | — | ~$50 |
| ALB | — | ~$25 |
| NAT Gateway | — | ~$35 |
| S3 + CloudFront | 10GB | ~$5 |
| **Total** | | **~$270/month** |

> For portfolio/demo: Use t3.micro everywhere, single-AZ, no Multi-AZ → ~$80/month

---

## Quick Dev Start

```bash
# 1. Clone repo
git clone https://github.com/yourname/shopflow

# 2. Copy env files
cp gateway/.env.example gateway/.env
cp services/auth-service/.env.example services/auth-service/.env
# ... repeat for each service

# 3. Start everything
docker-compose up --build

# 4. Services available at:
# API Gateway:  http://localhost:3000
# RabbitMQ UI:  http://localhost:15672 (shopflow/shopflow_secret)
# Postgres:     localhost:5432
# Redis:        localhost:6379
# MongoDB:      localhost:27017
```