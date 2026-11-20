# Security Specification — Resolved by #ArYan

## 1. Data Invariants
1. Every document in `/users/{userId}` contains PII (`email`) and MUST only be readable and writable by the authenticated, email-verified user whose `request.auth.uid == userId`.
2. Every document in `/users/{userId}/analyses/{analysisId}` cannot exist without its parent `/users/{userId}` document (`exists(...)` check on create).
3. `ownerId`, `id`, and `createdAt` are immutable after creation; `createdAt` and `updatedAt` MUST match `request.time`.
4. All strings and bounded lists have explicit `.size()` limits to prevent resource poisoning.
5. Updates on `/users/{userId}/analyses/{analysisId}` are restricted strictly to `followUps` and `updatedAt` via `affectedKeys().hasOnly(...)`.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Read**: Read `/users/userA` with `request.auth == null`.
2. **Cross-Tenant Profile Read (PII Leak)**: Read `/users/userA` while signed in as `userB`.
3. **Cross-Tenant List Scraping**: List `/users/userA/analyses` while signed in as `userB`.
4. **Unverified Email Write**: Create `/users/userA` with `request.auth.token.email_verified == false`.
5. **Identity Spoofing on Create**: Create `/users/userA/analyses/doc1` as `userA` with `ownerId: "userB"`.
6. **Shadow / Ghost Field Injection**: Create `/users/userA` with an unexpected `isAdmin: true` field.
7. **ID Poisoning**: Create `/users/userA/analyses/invalid$id!with*bad#chars` or ID > 128 chars.
8. **Orphaned Subcollection Write**: Create `/users/userA/analyses/doc1` when `/users/userA` does not exist.
9. **Client Timestamp Forgery**: Create `/users/userA/analyses/doc1` with `createdAt` not equal to `request.time`.
10. **Immutable Field Mutation**: Update `/users/userA/analyses/doc1` changing `ownerId` or `createdAt`.
11. **Disallowed Update Field**: Update `/users/userA/analyses/doc1` modifying `verdict` or `resolvedOutput` instead of `['followUps', 'updatedAt']`.
12. **Array Size / String Size Exhaustion**: Create `/users/userA/analyses/doc1` with `followUps.size() > 50` or `title.size() > 200`.
