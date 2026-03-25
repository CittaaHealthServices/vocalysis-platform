# Vocalysis Platform 2.0 - Deployment Guide

## Pre-Deployment Checklist

### Prerequisites
- Node.js 16.x or higher
- MongoDB 5.0 or higher
- Redis 6.0 or higher
- npm or yarn

### Infrastructure Requirements
- Minimum 2GB RAM
- MongoDB connection string (Atlas or self-hosted)
- Redis instance (self-hosted or AWS ElastiCache)
- HTTPS support (for production)

## Installation

### 1. Dependencies Installation
```bash
cd /sessions/exciting-youthful-feynman/vocalysis-platform/api
npm install
```

### 2. Environment Configuration

Create `.env` file in project root:
```bash
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/vocalysis

# Cache
REDIS_URL=redis://:password@redis-host:6379

# JWT Secrets (generate with: openssl rand -base64 32)
JWT_ACCESS_SECRET=your-generated-access-secret-key
JWT_REFRESH_SECRET=your-generated-refresh-secret-key

# Environment
NODE_ENV=production
LOG_LEVEL=info
PORT=3000

# Optional: Google Integration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://api.yourdomain.com/auth/google/callback
```

### 3. Database Initialization

Connect to MongoDB and create indexes:
```bash
# MongoDB indexes are automatically created by Mongoose
# However, ensure indexes for audit logs TTL if needed:

db.auditlogs.createIndex(
  { "createdAt": 1 },
  { expireAfterSeconds: 7776000 }  # 90 days
)
```

### 4. Seed Initial Data (Optional)

Create `src/seeders/initialData.js`:
```javascript
const db = require('../config/db');
const { Tenant, User } = require('../models');

async function seedDatabase() {
  await db.connectDB();

  // Create initial super admin tenant
  const tenant = await Tenant.create({
    tenantId: 'cittaa-platform',
    displayName: 'Cittaa Platform',
    legalName: 'Cittaa Health Services',
    type: 'corporate',
    contactEmail: 'admin@cittaa.com',
    contractTier: 'enterprise',
    monthlyAssessmentQuota: 50000,
    status: 'active'
  });

  // Create super admin user
  const adminUser = new User({
    tenantId: tenant.tenantId,
    email: 'superadmin@cittaa.com',
    role: 'CITTAA_SUPER_ADMIN',
    firstName: 'Admin',
    lastName: 'User',
    isActive: true,
    isEmailVerified: true
  });

  await adminUser.setPassword('ChangeMe123!');
  await adminUser.save();

  console.log('Database seeded successfully');
  await db.disconnectDB();
}

seedDatabase().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
```

Run with: `node src/seeders/initialData.js`

## Development Server

### Start Development Server
```bash
npm run dev
```

Server runs on `http://localhost:3000`

### Testing
```bash
# Install test dependencies
npm install --save-dev jest supertest

# Run tests
npm test
```

## Production Deployment

### Docker Deployment

Create `Dockerfile`:
```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
```

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/vocalysis
      - REDIS_URL=redis://redis:6379
      - NODE_ENV=production
      - JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
    depends_on:
      - mongo
      - redis
    restart: unless-stopped

  mongo:
    image: mongo:5.0
    volumes:
      - mongo_data:/data/db
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

volumes:
  mongo_data:
```

Deploy with:
```bash
docker-compose up -d
```

### Kubernetes Deployment

Create `k8s/deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vocalysis-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: vocalysis-api
  template:
    metadata:
      labels:
        app: vocalysis-api
    spec:
      containers:
      - name: api
        image: your-registry/vocalysis-api:latest
        ports:
        - containerPort: 3000
        env:
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: vocalysis-secrets
              key: mongodb-uri
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: vocalysis-secrets
              key: redis-url
        - name: JWT_ACCESS_SECRET
          valueFrom:
            secretKeyRef:
              name: vocalysis-secrets
              key: jwt-access-secret
        - name: JWT_REFRESH_SECRET
          valueFrom:
            secretKeyRef:
              name: vocalysis-secrets
              key: jwt-refresh-secret
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
```

Deploy with:
```bash
kubectl apply -f k8s/deployment.yaml
```

### PM2 Deployment

Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'vocalysis-api',
    script: './src/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: 'logs/error.log',
    out_file: 'logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '500M'
  }]
};
```

Deploy with:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Health Checks

### Health Endpoint
Implement in `src/routes/health.js`:
```javascript
const express = require('express');
const redis = require('../config/redis');
const { isConnected } = require('../config/db');

const router = express.Router();

router.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date(),
    uptime: process.uptime(),
    mongodb: isConnected(),
    redis: redis.status === 'ready'
  };

  if (health.mongodb && health.redis) {
    res.status(200).json(health);
  } else {
    res.status(503).json(health);
  }
});

router.get('/ready', async (req, res) => {
  if (isConnected() && redis.status === 'ready') {
    res.status(200).json({ ready: true });
  } else {
    res.status(503).json({ ready: false });
  }
});

module.exports = router;
```

## Monitoring & Logging

### Log Files Location
- Error logs: `logs/error.log`
- Combined logs: `logs/combined.log`
- Maximum file size: 5MB
- Retention: 5-10 files (auto-rotation)

### Monitoring Services
- Application metrics via Winston
- Health checks via `/health` endpoint
- Audit logs in MongoDB
- Performance monitoring recommended: DataDog, New Relic, or CloudWatch

## Backup & Disaster Recovery

### Database Backup
```bash
# MongoDB backup
mongodump --uri="mongodb+srv://user:pass@host/vocalysis" \
  --out ./backups/mongodb_backup_$(date +%Y%m%d_%H%M%S)

# Restore
mongorestore --uri="mongodb+srv://user:pass@host" \
  ./backups/mongodb_backup_DATE
```

### Redis Backup
```bash
# RDB backup
redis-cli BGSAVE
cp /var/lib/redis/dump.rdb ./backups/redis_$(date +%Y%m%d_%H%M%S).rdb

# AOF backup (if enabled)
redis-cli BGREWRITEAOF
```

## Security Hardening

### HTTPS/TLS
Use nginx or HAProxy as reverse proxy:
```nginx
server {
  listen 443 ssl http2;
  server_name api.vocalysis.com;

  ssl_certificate /etc/letsencrypt/live/api.vocalysis.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.vocalysis.com/privkey.pem;

  location / {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

### Rate Limiting in Reverse Proxy
Add nginx rate limiting:
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

server {
  location / {
    limit_req zone=api burst=20 nodelay;
    proxy_pass http://localhost:3000;
  }
}
```

### Firewall Rules
```bash
# Allow only necessary ports
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 80/tcp   # HTTP (redirect)
sudo ufw allow 22/tcp   # SSH (from admin IPs only)
sudo ufw enable
```

## Performance Optimization

### Enable Gzip Compression
```javascript
const compression = require('compression');
app.use(compression());
```

### Set Appropriate Cache Headers
```javascript
const oneDay = 24 * 60 * 60 * 1000;
app.use(express.static('public', { maxAge: oneDay }));
```

### Connection Pool Optimization
- MongoDB: maxPoolSize: 100, minPoolSize: 10
- Redis: Already configured with reconnect strategy

### Database Indexes
All indexes are automatically created by Mongoose.
Verify in MongoDB:
```bash
db.users.getIndexes()
db.sessions.getIndexes()
```

## Rollback Procedure

### Application Rollback
```bash
# If using PM2
pm2 revert

# If using Docker
docker rollback <service_name>
```

### Database Rollback
```bash
# From backup
mongorestore --uri="mongodb+srv://user:pass@host" \
  ./backups/mongodb_backup_PREVIOUS_DATE
```

## Maintenance

### Regular Tasks
- [ ] Monitor disk space (logs, database)
- [ ] Review audit logs weekly
- [ ] Update dependencies monthly
- [ ] Run database optimization: `db.repairDatabase()`
- [ ] Verify backup integrity
- [ ] Review security patches

### Database Maintenance
```javascript
// In a scheduled job (Bull queue)
async function maintenanceJob() {
  // Remove old audit logs (older than 90 days)
  await AuditLog.deleteMany({
    createdAt: { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
  });

  // Remove old webhook delivery logs
  await WebhookDeliveryLog.deleteMany({
    createdAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
  });

  // Rebuild indexes
  await User.collection.reIndex();
  await Session.collection.reIndex();
}
```

## Troubleshooting

### Connection Issues

**MongoDB Connection Timeout**
```bash
# Check MongoDB connectivity
nc -zv mongodb-host 27017

# Verify connection string
echo $MONGODB_URI
```

**Redis Connection Timeout**
```bash
# Check Redis connectivity
redis-cli -h redis-host ping

# Verify Redis is running
ps aux | grep redis
```

### Performance Issues

**Check Active Connections**
```javascript
const connectedCount = mongoose.connection._connectionStates.length;
const redisInfo = await redis.info('clients');
```

**Monitor Memory Usage**
```bash
# Node process memory
top -p $(pgrep -f "node src/server.js")

# MongoDB memory
db.serverStatus().mem
```

**Check Log Files**
```bash
tail -f logs/error.log
tail -f logs/combined.log
```

## Support & Escalation

For production issues:
1. Check health endpoint: `GET /health`
2. Review error logs: `logs/error.log`
3. Check audit logs: MongoDB AuditLog collection
4. Verify database connectivity and performance
5. Contact infrastructure team for server/network issues

---

**Last Updated**: 2026-03-25
**Version**: 2.0.0
