# Teenverse Production Deployment Guide

## Prerequisites

- Docker & Docker Compose
- Node.js 20+
- PostgreSQL 15+
- Redis 7+ (optional for caching)
- Domain name with DNS configured
- SSL certificates

## Quick Start with Docker Compose

### 1. Clone and Configure

```bash
git clone https://github.com/tita-n/Teenverse.git
cd Teenverse

# Copy environment template
cp .env.example .env

# Edit .env with your production values
nano .env
```

### 2. Generate Secure Values

```bash
# Generate SECRET_KEY
openssl rand -base64 64

# Generate PostgreSQL password
openssl rand -base64 32
```

### 3. Start Services

```bash
# Development/Testing
docker-compose up -d

# Production
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose logs -f backend
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | Yes | 64+ character random string |
| `NODE_ENV` | Yes | Set to `production` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `POSTGRES_USER` | Yes | PostgreSQL username |
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password |
| `CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Yes | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Yes | Cloudinary API secret |
| `B2_KEY_ID` | No | Backblaze B2 key ID |
| `B2_APPLICATION_KEY` | No | Backblaze B2 application key |
| `ALLOWED_ORIGINS` | Yes | Comma-separated allowed CORS origins |
| `ADMIN_EMAIL` | Yes | Admin user email |

## Deployment Options

### Option 1: Docker Compose (Simple)

Best for single-server deployments or small-scale production.

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Option 2: Kubernetes

Best for production with auto-scaling requirements.

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n teenverse
kubectl get services -n teenverse
```

### Option 3: Cloud Platforms

#### Railway (Recommended for Startups)
```bash
railway login
railway init
railway up
```

#### Render
1. Connect GitHub repository
2. Create Web Service for backend
3. Create PostgreSQL database
4. Set environment variables
5. Deploy

#### AWS ECS/Fargate
```bash
# Build and push to ECR
aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REGISTRY
docker build -t teenverse-backend .
docker tag teenverse-backend:latest $ECR_REGISTRY/teenverse-backend:latest
docker push $ECR_REGISTRY/teenverse-backend:latest
```

## Health Checks

Once deployed, verify the application is healthy:

```bash
# Health check
curl https://your-domain.com/health

# Expected response
{
  "status": "ok",
  "timestamp": 1234567890,
  "uptime": 3600,
  "environment": "production",
  "version": "1.0.0",
  "services": {
    "database": "connected",
    "memory": { "usedMB": 45, "totalMB": 128 }
  }
}
```

## Monitoring Setup

### Application Monitoring (Sentry)

```bash
npm install @sentry/node @sentry/react
```

### Infrastructure Monitoring

Recommended stack:
- **Metrics**: Prometheus + Grafana
- **Logs**: ELK Stack or Datadog
- **Uptime**: UptimeRobot, Pingdom
- **Errors**: Sentry

### Example Prometheus scrape config:

```yaml
scrape_configs:
  - job_name: 'teenverse-backend'
    static_configs:
      - targets: ['backend:5000']
    metrics_path: '/metrics'
```

## Database Migration

For production, migrate from SQLite to PostgreSQL:

1. Export SQLite data
2. Import to PostgreSQL
3. Update connection string in environment

```bash
# Example migration script
pg_dump -h localhost -U postgres teenverse > backup.sql
psql -h localhost -U postgres teenverse < backup.sql
```

## SSL Setup

### Option 1: Let's Encrypt (Recommended)

```bash
# Using Certbot
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Option 2: Cloudflare

1. Enable Cloudflare proxy
2. Use Cloudflare Origin Certificates
3. Install certificate in nginx

### Option 3: AWS ACM

1. Request certificate in AWS Console
2. Add to Application Load Balancer
3. Update DNS records

## Backup Strategy

### Database Backups

```bash
# Automated daily backup
0 2 * * * pg_dump -h localhost -U postgres teenverse > /backups/teenverse-$(date +\%Y\%m\%d).sql

# Retain 30 days
0 3 * * * find /backups -name "teenverse-*.sql" -mtime +30 -delete
```

### File Backups

```bash
# Backup uploads directory
0 3 * * * tar -czf /backups/uploads-$(date +\%Y\%m\%d).tar.gz /app/uploads
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs backend

# Check environment
docker-compose exec backend env

# Verify database connection
docker-compose exec postgres pg_isready
```

### High Memory Usage

```bash
# Check container memory
docker stats

# Increase memory limit in docker-compose.yml
```

### Database Connection Issues

```bash
# Test connection
docker-compose exec backend nc -zv postgres 5432

# Check database logs
docker-compose logs postgres
```

## Security Checklist

- [ ] Change default `SECRET_KEY`
- [ ] Use strong PostgreSQL password
- [ ] Enable HTTPS (SSL/TLS)
- [ ] Set proper `ALLOWED_ORIGINS`
- [ ] Configure firewall rules
- [ ] Enable rate limiting
- [ ] Set up monitoring
- [ ] Regular security updates
- [ ] Backup strategy in place
- [ ] Admin email configured

## Scaling

### Horizontal Scaling (Docker)

```yaml
# docker-compose.prod.yml
services:
  backend:
    deploy:
      replicas: 3
```

### Vertical Scaling

Increase container resources:

```yaml
resources:
  limits:
    memory: 2G
    cpu: 2000m
```

### Database Scaling

1. Add read replicas
2. Implement connection pooling (PgBouncer)
3. Consider managed database services

## Support

For deployment issues, check:
1. Application logs: `docker-compose logs backend`
2. System logs: `docker-compose logs postgres`
3. Health endpoint: `curl localhost:5000/health`
4. Environment variables are set correctly

## CI/CD Integration

See `.github/workflows/ci.yml` for automated:
- Linting
- Testing
- Building
- Deployment

Configure secrets in GitHub Settings:
- `PRODUCTION_HOST`
- `POSTGRES_PASSWORD`
- `SECRET_KEY`
