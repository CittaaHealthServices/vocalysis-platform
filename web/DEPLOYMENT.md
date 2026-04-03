# Deployment Guide - Vocalysis Platform 2.0

## Pre-Deployment Checklist

- [ ] All dependencies installed: `npm install`
- [ ] Environment variables configured: `.env`
- [ ] API endpoint verified: `VITE_API_URL`
- [ ] Build successful: `npm run build`
- [ ] No console errors: Check build output
- [ ] All routes tested locally: `npm run dev`

## Local Build Test

```bash
npm run build
npm run preview
# Visit http://localhost:4173
```

## Build Output Structure

```
dist/
├── index.html              # Entry point
├── assets/
│   ├── index-[hash].js     # Bundled JS (~150KB gzipped)
│   └── index-[hash].css    # Bundled CSS (~50KB gzipped)
└── favicon.svg
```

## Deployment Options

### 1. Vercel (Recommended - 1 minute)

```bash
npm i -g vercel
vercel
# Follow prompts, select "Vite" as framework
```

Configuration auto-detected from `vite.config.js`

### 2. Netlify

```bash
npm i -g netlify-cli
netlify deploy --prod --dir=dist
```

Or connect Git repository in Netlify dashboard.

### 3. GitHub Pages

```bash
# Update vite.config.js
export default {
  base: '/vocalysis/', // Your repo name
  // ... rest of config
}

npm run build
# Push dist/ to gh-pages branch
```

### 4. Docker

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
RUN npm install -g serve
WORKDIR /app
COPY --from=build /app/dist .
EXPOSE 3000
CMD ["serve", "-s", ".", "-l", "3000"]
```

```bash
docker build -t vocalysis-web .
docker run -p 3000:3000 vocalysis-web
```

### 5. AWS S3 + CloudFront

```bash
# Build
npm run build

# Deploy to S3
aws s3 sync dist/ s3://your-bucket-name/

# Invalidate CloudFront (if using CDN)
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

### 6. Self-Hosted (Nginx)

```bash
# Build
npm run build

# Copy to server
scp -r dist/* user@your-server:/var/www/html/

# Nginx config
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        root /var/www/html;
        try_files $uri /index.html;
    }
}
```

## Environment Configuration

### Production .env
```env
VITE_API_URL=https://api.your-domain.com/api
VITE_APP_NAME=Vocalysis
VITE_BRAND_COLOR=#6B21A8
VITE_ENVIRONMENT=production
```

### Staging .env
```env
VITE_API_URL=https://staging-api.your-domain.com/api
VITE_APP_NAME=Vocalysis Staging
VITE_BRAND_COLOR=#6B21A8
VITE_ENVIRONMENT=staging
```

## Performance Optimization

### Enable Gzip Compression
```nginx
gzip on;
gzip_types text/plain text/css text/javascript application/javascript;
gzip_comp_level 6;
```

### Set Cache Headers
```nginx
location ~* \.(js|css)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

location / {
    expires 1h;
    add_header Cache-Control "public";
}
```

### Use CDN
- CloudFront
- CloudFlare
- Fastly
- Akamai

## Monitoring

### Application Monitoring
- Sentry for error tracking
- LogRocket for session replay
- Datadog for performance

### Infrastructure Monitoring
- Server uptime
- Response times
- Error rates
- User analytics

## SSL/HTTPS

### Let's Encrypt (Free)
```bash
# Using Certbot
sudo certbot certonly --standalone -d your-domain.com
```

### AWS Certificate Manager
- Free for CloudFront
- Auto-renewal

## Database & Backup

Not applicable for frontend-only deployment.
Backend API handles all data.

## Rollback Procedure

### For Vercel
```bash
vercel rollback
```

### For Docker
```bash
docker run -p 3000:3000 vocalysis-web:previous-tag
```

### For S3
```bash
# Restore from previous version
aws s3 sync s3://your-bucket-name/backup/ dist/
aws s3 sync dist/ s3://your-bucket-name/
```

## Post-Deployment Checks

- [ ] Visit production URL
- [ ] Test login flow
- [ ] Verify API connectivity
- [ ] Check console for errors (DevTools)
- [ ] Test responsive design (mobile)
- [ ] Check performance (Lighthouse)
- [ ] Verify SSL certificate
- [ ] Test all dashboards
- [ ] Test user interactions
- [ ] Monitor error logs

## Performance Benchmarks

### Target Metrics
- First Contentful Paint: < 1.5s
- Largest Contentful Paint: < 2.5s
- Cumulative Layout Shift: < 0.1
- Time to Interactive: < 3.5s

### Lighthouse Score
- Performance: 90+
- Accessibility: 95+
- Best Practices: 90+
- SEO: 90+

## Security Checklist

- [ ] HTTPS enabled
- [ ] Security headers set
  - Content-Security-Policy
  - X-Frame-Options
  - X-Content-Type-Options
- [ ] CORS properly configured
- [ ] API endpoints secured
- [ ] Environment variables protected
- [ ] No secrets in code
- [ ] Dependencies up-to-date

## Troubleshooting

### Blank Page on Production
- Check browser console
- Verify API_URL in .env
- Check network requests
- Review server logs

### API 404 Errors
- Verify VITE_API_URL
- Check API server running
- Verify route paths

### Performance Issues
- Enable compression
- Check cache headers
- Use CDN
- Monitor API response times

## Scaling

### For High Traffic
- Enable auto-scaling
- Use CDN
- Database optimization (backend)
- Implement caching
- Load balancing

## Maintenance

### Regular Tasks
- Monitor error logs
- Check performance metrics
- Update dependencies
- Review security advisories
- Backup configuration

### Update Schedule
- Security patches: Immediately
- Minor updates: Monthly
- Major versions: Quarterly

## Support

For deployment issues:
1. Check documentation (README.md)
2. Review error logs
3. Test locally first
4. Verify environment variables
5. Contact infrastructure team

---

**Version**: 2.0.0
**Last Updated**: March 25, 2026
**Status**: Production Ready
