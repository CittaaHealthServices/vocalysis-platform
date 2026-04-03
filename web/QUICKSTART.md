# Quick Start Guide - Vocalysis Platform 2.0 Frontend

## 5-Minute Setup

### 1. Install & Run
```bash
cd /sessions/exciting-youthful-feynman/vocalysis-platform/web

npm install
npm run dev
```

Open `http://localhost:5173`

### 2. Login
```
Email: demo@vocalysis.com
Password: password123
MFA Code: (if enabled, check email)
```

### 3. Navigate by Role
- **Clinical**: `/clinical` → Dashboard → New Assessment
- **HR**: `/hr` → Overview → Employees
- **Company**: `/company` → Overview
- **Employee**: `/my` → Home → Check-in
- **Super Admin**: `/cittaa-admin` → Tenants

## Project Structure at a Glance

```
Components          → src/components/
Pages              → src/pages/
API Calls          → src/services/api.js
Authentication     → src/context/AuthContext.jsx
Routing            → src/router/index.jsx
Styling            → src/index.css (Tailwind)
```

## Key URLs by Dashboard

### Clinical Dashboard
- `/clinical` - Home
- `/clinical/assessment/new` - Create assessment
- `/clinical/patients` - Patient list
- `/clinical/patients/[id]` - Patient profile
- `/clinical/session/[id]` - Assessment results

### HR Dashboard
- `/hr` - Overview
- `/hr/employees` - Employee list
- `/hr/employees/import` - Bulk import
- `/hr/alerts` - Alert management

### Employee Portal
- `/my` - Home
- `/my/check-in` - Wellness check-in
- `/my/history` - Assessment history
- `/my/consultations` - Consultation list

## Common Tasks

### Add a New Component
```javascript
// src/components/myComponent/MyComponent.jsx
export const MyComponent = ({ prop }) => {
  return <div className="...">Content</div>
}

export default MyComponent
```

### Create a New Page
```javascript
// src/pages/mypage/MyPage.jsx
import { useApi } from '../../hooks/useApi'
import { Card, LoadingScreen } from '../../components/ui'
import api from '../../services/api'

export const MyPage = () => {
  const { data, isLoading } = useApi(['key'], () => api.get('/endpoint'))

  if (isLoading) return <LoadingScreen />

  return (
    <Card className="p-6">
      <h1 className="text-3xl font-bold">My Page</h1>
    </Card>
  )
}

export default MyPage
```

### Add an API Call
```javascript
// Use in component
const { data } = useApi(['key'], () => api.get('/endpoint'))

// Or mutation
const mutation = useApiMutation(
  (formData) => api.post('/endpoint', formData),
  { successMessage: 'Success!' }
)

// Trigger
mutation.mutate(data)
```

### Add Form Validation
```javascript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email('Invalid email'),
  name: z.string().min(2, 'Too short'),
})

export const Form = () => {
  const { register, formState: { errors }, handleSubmit } = useForm({
    resolver: zodResolver(schema),
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input {...register('email')} error={errors.email?.message} />
      <Input {...register('name')} error={errors.name?.message} />
    </form>
  )
}
```

## Key Files to Understand

### src/router/index.jsx
- Route definitions
- Protected routes
- Role-based redirects

### src/context/AuthContext.jsx
- Login/logout
- Token management
- Automatic refresh

### src/components/layout/AppLayout.jsx
- Main container
- Sidebar navigation
- Top header

### src/components/charts/ScoreGauge.jsx
- Most complex chart
- SVG-based rendering
- Animation patterns

## Environment Setup

Create `.env` file:
```env
VITE_API_URL=http://localhost:3001/api
VITE_APP_NAME=Vocalysis
VITE_BRAND_COLOR=#6B21A8
VITE_ENVIRONMENT=development
```

## Debugging Tips

### Check API Errors
```javascript
// In browser console
localStorage.debug = '*'

// Check Network tab in DevTools
// Look for 401 (auth), 403 (permission), 500 (server)
```

### Test Different Roles
- Logout and login as different user
- Check role-based UI rendering
- Verify route access control

### View Component Tree
```
React DevTools extension
→ Components tab
→ Click elements to inspect
```

## Build for Production

```bash
npm run build
npm run preview

# Output in dist/
```

## Common Issues

### "Cannot find module"
- Check file path spelling
- Ensure import statement matches export
- Clear `node_modules` and reinstall

### API 401 (Unauthorized)
- Check login credentials
- Verify token in cookies
- Check API server running

### Component not rendering
- Check route definition
- Verify component export
- Check props being passed

### Styling issues
- Check Tailwind class names
- Verify tailwind.config.js includes path
- Restart dev server

## Performance Tips

- Use React Query for caching
- Lazy load routes with React.lazy (future)
- Memoize expensive components
- Profile with Lighthouse

## Next Steps

1. ✅ Understand component structure
2. ✅ Review authentication flow
3. ✅ Explore clinical dashboard
4. ✅ Test different user roles
5. ✅ Review API integration patterns
6. ✅ Build a new feature
7. ✅ Deploy to production

## Resources

- [React Docs](https://react.dev)
- [Vite Guide](https://vitejs.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [React Router](https://reactrouter.com)
- [React Hook Form](https://react-hook-form.com)

## Support

- Check README.md for detailed documentation
- Review STRUCTURE.md for file organization
- Check src/pages/ for example implementations
- Review src/components/ for reusable patterns

---

**Version**: 2.0.0
**Last Updated**: March 25, 2026
**Ready to Code**: Yes! 🚀
