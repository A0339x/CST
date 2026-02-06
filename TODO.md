# Client Success Tracker — TODO

## Phase 1: Infrastructure
- [x] Review existing frontend codebase
- [x] Create implementation plan
- [x] Set up state tracking files
- [ ] Create server directory structure
- [ ] Set up Express server
- [ ] Configure Prisma with SQLite
- [ ] Create database schema

## Phase 2: Authentication & Users
- [ ] JWT authentication middleware
- [ ] Login/logout endpoints
- [ ] User CRUD endpoints (Admin only)
- [ ] Password hashing with bcrypt
- [ ] Rate limiting on auth endpoints

## Phase 3: Core API
- [ ] Client CRUD endpoints
- [ ] Notes CRUD endpoints
- [ ] Curriculum progress endpoints
- [ ] Outcomes endpoints
- [ ] Custom fields endpoints
- [ ] RBAC enforcement (coach sees own clients)

## Phase 4: Security
- [ ] Helmet security headers
- [ ] CORS configuration
- [ ] Zod validation on all inputs
- [ ] Rate limiting on write endpoints
- [ ] Audit logging

## Phase 5: Exports
- [ ] CSV export for clients
- [ ] CSV export for notes
- [ ] JSON export options
- [ ] CSV injection protection

## Phase 6: Slack Integration
- [ ] Slack app setup guide
- [ ] Signature verification
- [ ] Daily heartbeat message
- [ ] Client select dropdown
- [ ] Client detail modal
- [ ] Interactive actions

## Phase 7: Go High Level
- [ ] GHL API client
- [ ] Contact sync logic
- [ ] Last appointment date sync
- [ ] Admin sync trigger endpoint

## Phase 8: Frontend Integration
- [ ] API client utility
- [ ] Auth context provider
- [ ] Update Login page
- [ ] Update Dashboard page
- [ ] Update ClientProfile page
- [ ] Add Admin Users page
- [ ] Vite proxy configuration

## Phase 9: Testing & Docs
- [ ] Unit tests for services
- [ ] Integration tests for routes
- [ ] README with setup instructions
- [ ] Slack setup guide
- [ ] GHL setup guide
