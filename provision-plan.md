# OpenRouter API Key Provisioning Plan

## Overview
This plan outlines the implementation of automatic OpenRouter API key provisioning for new users in the z3chat application. Each user will receive their own API key with configurable limits, enabling better usage tracking and cost management.

## Current State Analysis

### Existing Infrastructure
- **Authentication**: WorkOS OAuth integration
- **Session Management**: MongoDB-backed sessions with in-memory cache
- **API Key Support**: SessionData already includes `openRouterApiKey` field
- **Key Usage**: Chat endpoint already checks for user-specific keys before using global key
- **Database**: MongoDB collections for sessions, messages, and chats

### Key Finding
The system is already architected to support user-specific API keys. The main implementation work is adding the provisioning logic and management endpoints.

## Implementation Plan

### Phase 1: Core Provisioning (Priority: High)

#### 1.1 Environment Setup
- Add `OPENROUTER_PROVISIONING_KEY` to environment variables
- Update `.env.development` and production configs
- Add provisioning API base URL constant

#### 1.2 Provisioning Service
Create `/apps/api/lib/openRouterProvisioning.ts`:
```typescript
interface ProvisioningService {
  createKey(userId: string, email: string): Promise<OpenRouterKey>
  getKey(keyHash: string): Promise<OpenRouterKeyInfo>
  updateKey(keyHash: string, updates: KeyUpdates): Promise<void>
  deleteKey(keyHash: string): Promise<void>
  listKeys(offset?: number): Promise<OpenRouterKeyList>
}
```

#### 1.3 User Registration Integration
Update `/apps/api/api/auth/callback/route.ts`:
- Check if user exists in `users` collection
- If new user:
  - Provision OpenRouter API key
  - Create user document in `users` collection
  - Store encrypted API key permanently
- For existing users:
  - Load API key from `users` collection
  - Copy to session for runtime access
- Handle provisioning failures gracefully

### Phase 2: Key Management API (Priority: Medium)

#### 2.1 Admin Endpoints
Create `/apps/api/api/admin/keys/`:
- `GET /api/admin/keys` - List all provisioned keys
- `GET /api/admin/keys/[userId]` - Get user's key info
- `PATCH /api/admin/keys/[userId]` - Update key settings
- `DELETE /api/admin/keys/[userId]` - Revoke user's key

#### 2.2 User Endpoints
Create `/apps/api/api/users/keys/`:
- `GET /api/users/keys` - Get current user's key info
- `POST /api/users/keys/rotate` - Request key rotation

### Phase 3: Error Handling & Monitoring (Priority: High)

#### 3.1 Fallback Strategy
- If provisioning fails during registration, log error but allow user to continue
- Use global API key as fallback
- Add background job to retry provisioning
- Notify admins of provisioning failures

#### 3.2 Key Monitoring
- Track key usage in database
- Implement usage alerts when approaching limits
- Auto-disable keys that exceed limits
- Log all key operations for audit trail

### Phase 4: UI Integration (Priority: Low)

#### 4.1 User Dashboard
Add to user settings/profile:
- Display current API key status
- Show usage statistics
- Display remaining credits/limit
- Key rotation button

#### 4.2 Admin Dashboard
Create admin interface for:
- Viewing all user keys
- Monitoring usage across users
- Manually provisioning/revoking keys
- Setting user-specific limits

## Technical Implementation Details

### Storage Strategy - CRITICAL UPDATE

**Current Issue**: Sessions are temporary (1-hour TTL) and get deleted automatically. Storing API keys only in sessions would require users to get new API keys every hour!

**Solution**: Create a dedicated `users` collection for persistent user data.

### Database Schema Updates

#### New `users` Collection
Create a persistent users collection:
```javascript
{
  _id: ObjectId,
  userId: string,                // WorkOS user ID (unique index)
  email: string,                 // User email (unique index)
  openRouterApiKey: string,      // Encrypted API key
  openRouterKeyHash: string,     // Key identifier from OpenRouter
  openRouterKeyLimit: number,    // Credit limit
  openRouterKeyUsage: number,    // Current usage
  openRouterKeyCreatedAt: Date,  // Provisioning timestamp
  createdAt: Date,               // User creation timestamp
  updatedAt: Date,               // Last update timestamp
}
```

#### Updated Session Flow
1. When user logs in, check if they exist in `users` collection
2. If new user, create user document with provisioned API key
3. Copy API key from `users` to `sessions` for runtime access
4. Session expiry doesn't affect stored API key

#### Database Indexes
```javascript
db.users.createIndex({ userId: 1 }, { unique: true })
db.users.createIndex({ email: 1 }, { unique: true })
db.users.createIndex({ openRouterKeyHash: 1 })
```

### Security Considerations
1. Never log or expose full API keys
2. Use key hash for all management operations
3. Implement rate limiting on key rotation
4. Audit log all key operations
5. Encrypt API keys at rest in database

### Error Scenarios
1. **Provisioning API Down**: Use global key, retry in background
2. **Rate Limit Exceeded**: Queue provisioning requests
3. **Invalid Provisioning Key**: Alert admins, use global key
4. **User Key Exhausted**: Fallback to global key, notify user

## Migration Strategy

### For Existing Users
1. Create background job to provision keys for existing users
2. Run migration in batches to avoid rate limits
3. Update sessions with new key data
4. Send notification email about new feature

### Rollback Plan
1. Feature flag for API key provisioning
2. Keep global key as permanent fallback
3. Database migrations should be reversible
4. Monitor error rates during rollout

## Success Metrics
- % of users with provisioned keys
- Provisioning success rate
- API key usage distribution
- Cost reduction from granular tracking
- User satisfaction with transparency

## Timeline Estimate
- Phase 1: 2-3 days
- Phase 2: 2-3 days
- Phase 3: 1-2 days
- Phase 4: 3-4 days
- Testing & Deployment: 2-3 days

**Total: 10-15 days**

## Next Steps
1. Get provisioning API key from OpenRouter
2. Set up development environment
3. Implement Phase 1 provisioning service
4. Test with small group of users
5. Roll out incrementally