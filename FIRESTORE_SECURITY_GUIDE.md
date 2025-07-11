# Firestore Security Rules Guide

## Overview
Your Firestore database has been secured with proper security rules that replace the temporary open access rules. These rules implement role-based access control and data ownership principles.

## Security Principles Implemented

### 1. Authentication Required
- All operations require user authentication (`request.auth != null`)
- No anonymous access is allowed

### 2. Role-Based Access Control
- **Regular Users**: Can access their own data
- **Admin Users**: Have elevated permissions for management operations
- Admin role is determined by checking `users/{userId}.role == 'admin'`

### 3. Data Ownership
- Users can only access data they own (based on `userId` field)
- Orders, carts, and notifications are tied to specific users

## Collection-Specific Rules

### Users Collection (`/users/{userId}`)
- **Read/Write**: Only the user themselves
- Users cannot access other users' profiles

### Products Collection (`/products/{productId}`)
- **Read**: All authenticated users
- **Write**: Admin users only
- Allows browsing products but prevents unauthorized modifications

### Categories Collection (`/categories/{categoryId}`)
- **Read**: All authenticated users
- **Write**: Admin users only
- Similar to products - browsable but admin-controlled

### Orders Collection (`/orders/{orderId}`)
- **Read**: Order owner or admin
- **Create**: Authenticated users (must set themselves as userId)
- **Update**: Order owner or admin
- **Delete**: Admin only
- Ensures order privacy and proper ownership

### Carts Collection (`/carts/{cartId}`)
- **Read/Write**: Cart owner only
- **Create**: Must set correct userId
- Private shopping cart access

### Notifications Collection (`/notifications/{notificationId}`)
- **Read**: Target user or admin
- **Create**: Any authenticated user (for system notifications)
- **Update**: Target user or admin
- **Delete**: Admin only

### Reviews Collection (`/reviews/{reviewId}`)
- **Read**: All authenticated users
- **Create**: Authenticated users (must set themselves as userId)
- **Update**: Review author only
- **Delete**: Review author or admin
- Public reviews with author control

### Admin-Only Collections
- **Analytics**: Admin read/write only
- Sensitive business data protection

### Coupons Collection (`/coupons/{couponId}`)
- **Read**: All authenticated users
- **Write**: Admin only
- Users can view available coupons but can't create/modify them

## Important Security Considerations

### 1. Admin Role Management
- Ensure admin users are properly set in the users collection
- Admin role should be set server-side, never client-side
- Regularly audit admin user list

### 2. Data Structure Requirements
For these rules to work properly, ensure:
- All user-owned documents have a `userId` field
- User documents have a `role` field (set to 'admin' for administrators)
- Orders have proper `userId` references

### 3. Testing Security Rules
Before deploying, test with:
```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Test the rules
firebase emulators:start --only firestore
```

### 4. Deployment
To deploy these rules:
```bash
# Deploy to Firebase
firebase deploy --only firestore:rules
```

## Environment Security

### API Keys in .env
⚠️ **SECURITY ALERT**: Your `.env` file contains a live Paystack public key:
```
PAYSTACK_PUBLIC_KEY=pk_live_6cd469ace79ae3461d53ea33f2de17e2944f3025
```

**Recommendations**:
1. **Never commit `.env` files to version control**
2. **Add `.env` to your `.gitignore` file**
3. **Use environment-specific keys**:
   - Development: `pk_test_...`
   - Production: `pk_live_...`
4. **Rotate keys regularly**
5. **Use secret management services for production**

## Monitoring and Maintenance

### 1. Regular Security Audits
- Review access logs in Firebase Console
- Monitor for unusual access patterns
- Update rules as your application evolves

### 2. Error Handling
- Implement proper error handling for permission denied errors
- Provide user-friendly messages for access restrictions

### 3. Performance Considerations
- Admin role checks require additional database reads
- Consider caching user roles in your application
- Monitor query performance in Firebase Console

## Common Issues and Solutions

### Issue: "Permission denied" errors
**Solution**: Verify that:
- User is properly authenticated
- Document has correct `userId` field
- Admin users have `role: 'admin'` in their user document

### Issue: Admin operations failing
**Solution**: Ensure admin users are properly configured:
```javascript
// Set admin role server-side only
await admin.firestore().collection('users').doc(userId).update({
  role: 'admin'
});
```

### Issue: New collections not accessible
**Solution**: Add specific rules for new collections or they'll be denied by the catch-all rule

## Next Steps

1. **Deploy the rules**: `firebase deploy --only firestore:rules`
2. **Test thoroughly** with different user roles
3. **Update your `.gitignore`** to exclude `.env` files
4. **Set up proper admin users** in your user collection
5. **Monitor access logs** for any issues

These security rules provide a solid foundation for your e-commerce application while maintaining proper data privacy and access control.