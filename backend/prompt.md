# Blynta — Production-Grade Notification System

You are working inside the existing **Blynta** application.

Your task is to design, implement, and integrate the **complete notification system from backend to frontend**.

The most important rule is:

> **DO NOT rewrite, replace, or unnecessarily refactor existing working functionality.**
>
> Inspect the existing codebase first and integrate the notification system into the architecture that already exists.

The goal is to build a clean, production-grade notification system that fits the current Blynta architecture without overengineering it.

---

# 1. Existing Blynta Architecture

## Backend

The backend is:

* NestJS
* MongoDB
* Mongoose
* Redis
* BullMQ
* JWT authentication
* Resend for email
* Cloudflare R2 for storage

Relevant existing backend structure:

```text
backend/
├── src/
│   ├── auth/
│   │   ├── dto/
│   │   ├── schemas/
│   │   ├── auth-provider-config.service.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts
│   │   └── jwt.strategy.ts
│   │
│   ├── billing/
│   │   ├── dto/
│   │   ├── billing.controller.ts
│   │   ├── billing.module.ts
│   │   └── billing.service.ts
│   │
│   ├── jobs/
│   │   ├── dto/
│   │   ├── schemas/
│   │   │   ├── job.schema.ts
│   │   │   └── source-video.schema.ts
│   │   ├── jobs-reconciliation.service.ts
│   │   ├── jobs.constants.ts
│   │   ├── jobs.controller.ts
│   │   ├── jobs.module.ts
│   │   ├── jobs.processor.ts
│   │   └── jobs.service.ts
│   │
│   ├── mail/
│   │   ├── templates/
│   │   │   └── mail.templates.ts
│   │   ├── mail.constants.ts
│   │   ├── mail.module.ts
│   │   ├── mail.processor.ts
│   │   └── mail.service.ts
│   │
│   ├── media/
│   │   ├── services/
│   │   ├── prompts/
│   │   ├── media.module.ts
│   │   └── ...
│   │
│   ├── redis/
│   ├── storage/
│   ├── stripe/
│   ├── users/
│   │   ├── dto/
│   │   ├── schemas/
│   │   │   ├── referral-reward.schema.ts
│   │   │   └── user.schema.ts
│   │   ├── users.controller.ts
│   │   ├── users.module.ts
│   │   └── users.service.ts
│   │
│   ├── app.module.ts
│   └── worker.ts
```

The existing application already has:

* Authentication
* Users
* Jobs
* Billing
* Referral system
* Email system using Resend
* Background processing with BullMQ
* Redis
* MongoDB

Do not create duplicate implementations of any of these.

---

# 2. Notification Schema Already Designed

A notification schema has already been designed.

Use the existing schema if it is already present. If it needs minor adjustments for the implementation, preserve its overall design and explain any necessary changes before making large changes.

Expected schema:

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

export enum NotificationCategory {
  SYSTEM = 'system',
  JOB = 'job',
  BILLING = 'billing',
  CREDIT = 'credit',
  REFERRAL = 'referral',
  ACCOUNT = 'account',
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
}

export enum NotificationStatus {
  UNREAD = 'unread',
  READ = 'read',
}

@Schema({
  timestamps: true,
  collection: 'notifications',
})
export class Notification {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(NotificationType),
    required: true,
  })
  type: NotificationType;

  @Prop({
    type: String,
    enum: Object.values(NotificationCategory),
    required: true,
    index: true,
  })
  category: NotificationCategory;

  @Prop({
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  })
  title: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
    maxlength: 1000,
  })
  message: string;

  @Prop({
    type: String,
    enum: Object.values(NotificationChannel),
    required: true,
    default: NotificationChannel.IN_APP,
  })
  channel: NotificationChannel;

  @Prop({
    type: String,
    enum: Object.values(NotificationStatus),
    default: NotificationStatus.UNREAD,
    required: true,
    index: true,
  })
  status: NotificationStatus;

  @Prop({
    type: String,
    required: false,
    trim: true,
    maxlength: 500,
  })
  actionUrl?: string;

  @Prop({
    type: String,
    required: false,
    trim: true,
    maxlength: 100,
  })
  actionLabel?: string;

  @Prop({
    type: String,
    required: false,
    trim: true,
    maxlength: 100,
  })
  entityType?: string;

  @Prop({
    type: Types.ObjectId,
    required: false,
  })
  entityId?: Types.ObjectId;

  @Prop({
    type: Object,
    required: false,
    default: undefined,
  })
  metadata?: Record<string, unknown>;

  @Prop({
    type: Date,
    required: false,
    index: true,
  })
  readAt?: Date;

  @Prop({
    type: Date,
    required: false,
    index: true,
  })
  expiresAt?: Date;
}

export const NotificationSchema =
  SchemaFactory.createForClass(Notification);

NotificationSchema.index({
  userId: 1,
  status: 1,
  createdAt: -1,
});

NotificationSchema.index({
  userId: 1,
  createdAt: -1,
});

NotificationSchema.index({
  expiresAt: 1,
});
```

The indexes are intentional.

For example:

```ts
NotificationSchema.index({
  userId: 1,
  status: 1,
  createdAt: -1,
});
```

supports queries such as:

```ts
Notification.find({
  userId,
  status: NotificationStatus.UNREAD,
}).sort({
  createdAt: -1,
});
```

Do not remove these indexes without a concrete reason.

---

# 3. Important Notification Architecture

Understand this distinction before implementing anything:

```text
Notification
     ↓
User-facing notification state
     ↓
MongoDB
```

is different from:

```text
Email
     ↓
Delivery mechanism
     ↓
Resend
```

A notification should not depend on Resend.

For example:

```text
Job completed
      │
      ├── Create in-app notification
      │
      └── Send email through existing MailService
```

If Resend fails, the in-app notification should still exist.

Do NOT turn the notification collection into an email delivery log.

The existing `mail` module remains responsible for email delivery.

---

# 4. Create Notifications Module

Create:

```text
src/notifications/
├── dto/
│   ├── list-notifications.dto.ts
│   └── ...
├── schemas/
│   └── notification.schema.ts
├── notifications.controller.ts
├── notifications.service.ts
└── notifications.module.ts
```

Do not create unnecessary files.

---

# 5. Notifications Module

Register the Mongoose model using the existing project conventions.

Conceptually:

```ts
@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Notification.name,
        schema: NotificationSchema,
      },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
```

The service MUST be exported because other modules will need to create notifications.

For example:

```text
JobsService
    ↓
NotificationsService
    ↓
create(...)
```

and:

```text
BillingService
    ↓
NotificationsService
    ↓
create(...)
```

Register `NotificationsModule` in `AppModule` following the project's existing module-import style.

---

# 6. Notifications Service

Build a clean `NotificationsService`.

It should be responsible for notification business logic.

At minimum implement:

```text
create()
findForUser()
getUnreadCount()
markAsRead()
markAllAsRead()
delete()
```

The exact method signatures should follow the existing project's NestJS/Mongoose conventions.

---

# 7. Creating a Notification

The service should allow internal application services to create notifications.

Example:

```ts
await this.notificationsService.create({
  userId,
  type: NotificationType.SUCCESS,
  category: NotificationCategory.JOB,
  title: 'Your clips are ready',
  message: '7 clips were successfully generated.',
  actionUrl: `/dashboard/jobs/${jobId}`,
  actionLabel: 'View clips',
  entityType: 'job',
  entityId: jobId,
});
```

Another example:

```ts
await this.notificationsService.create({
  userId,
  type: NotificationType.SUCCESS,
  category: NotificationCategory.CREDIT,
  title: 'Credits added',
  message: 'You received 1 bonus credit.',
  actionUrl: '/dashboard',
  actionLabel: 'Go to dashboard',
  entityType: 'credit',
});
```

Another example:

```ts
await this.notificationsService.create({
  userId,
  type: NotificationType.INFO,
  category: NotificationCategory.BILLING,
  title: 'Subscription updated',
  message: 'Your Pro subscription is now active.',
  actionUrl: '/dashboard/billing',
  actionLabel: 'View billing',
});
```

---

# 8. User Isolation Is Critical

Never allow the frontend to provide an arbitrary `userId` when retrieving or modifying notifications.

Bad:

```http
GET /notifications?userId=123
```

Good:

```text
JWT
 ↓
authenticated user
 ↓
request.user.userId
 ↓
NotificationsService
 ↓
Notification.find({ userId })
```

A user must only be able to:

* retrieve their own notifications
* read their own notifications
* delete their own notifications
* mark their own notifications as read

A request such as:

```http
PATCH /notifications/:notificationId/read
```

must verify that the notification belongs to the authenticated user.

Do not rely only on:

```ts
findById(notificationId)
```

Instead use a user-scoped query, for example conceptually:

```ts
findOne({
  _id: notificationId,
  userId,
});
```

This prevents IDOR/security issues.

Use the existing authentication guard/decorator pattern already present in the project rather than inventing another authentication mechanism.

---

# 9. Controller API

Implement a clean REST API.

Recommended endpoints:

```text
GET    /notifications
GET    /notifications/unread-count
PATCH  /notifications/:id/read
PATCH  /notifications/read-all
DELETE /notifications/:id
```

Do not create a public endpoint that lets the frontend arbitrarily create notifications.

There should NOT be:

```text
POST /notifications
```

for normal users.

Notifications should be generated by backend business logic.

---

# 10. List Notifications

Support pagination.

Example:

```http
GET /notifications?page=1&limit=20
```

Response should contain enough information for the frontend to build pagination/infinite loading.

For example:

```json
{
  "data": [
    {
      "_id": "...",
      "type": "success",
      "category": "job",
      "title": "Your clips are ready",
      "message": "7 clips were successfully generated.",
      "status": "unread",
      "actionUrl": "/dashboard/jobs/123",
      "actionLabel": "View clips",
      "createdAt": "2026-09-09T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

Follow the existing backend response interceptor/response format if the project already standardizes responses.

Do NOT blindly introduce a new response format if one already exists.

---

# 11. Unread Count

Implement:

```http
GET /notifications/unread-count
```

Example response:

```json
{
  "count": 5
}
```

This endpoint will be used by the frontend notification bell.

Use MongoDB's efficient counting mechanism.

Do not retrieve all notifications just to count unread notifications.

---

# 12. Mark One Notification as Read

Implement:

```http
PATCH /notifications/:id/read
```

When successful:

```text
status = READ
readAt = current date
```

For example:

```ts
{
  status: NotificationStatus.READ,
  readAt: new Date(),
}
```

The operation should be safe to call multiple times.

If the notification is already read, it should not cause an error unnecessarily.

---

# 13. Mark All as Read

Implement:

```http
PATCH /notifications/read-all
```

Only update the authenticated user's unread notifications.

Conceptually:

```ts
updateMany(
  {
    userId,
    status: NotificationStatus.UNREAD,
  },
  {
    $set: {
      status: NotificationStatus.READ,
      readAt: new Date(),
    },
  },
);
```

Do not update notifications belonging to another user.

---

# 14. Delete Notification

Implement:

```http
DELETE /notifications/:id
```

Again, make the query user-scoped:

```ts
{
  _id: notificationId,
  userId,
}
```

Do not allow deletion of another user's notification.

---

# 15. Action URLs

Notifications are clickable.

Example:

```ts
actionUrl: `/dashboard/jobs/${jobId}`,
actionLabel: 'View clips',
```

Use relative internal URLs whenever possible.

Examples:

```text
/dashboard/jobs/123
/dashboard/billing
/dashboard/referrals
/settings
```

Do not hardcode production domains such as:

```text
https://blynta.com/dashboard/jobs/123
```

because the application should work correctly in:

* local development
* staging
* production

The frontend should render the action using the existing Next.js routing approach.

---

# 16. Frontend Integration

First inspect the existing frontend structure and conventions.

Do not create a second API client if one already exists.

The existing frontend uses:

* Next.js App Router
* TanStack Query
* shared Axios/authenticated Axios patterns
* NextAuth as the frontend session layer

Use the existing API abstraction.

Create notification API/query functionality following the same style as existing features.

Conceptually:

```text
frontend
├── notifications API
├── notification query hooks
└── notification UI
```

Use TanStack Query if that is how the existing application fetches server state.

---

# 17. Notification Bell / UI

Find the existing dashboard/header/navigation area where a notification bell belongs.

If a notification UI already exists, improve/integrate it instead of creating a duplicate.

The notification UI should support:

```text
Notification Bell
      ↓
Unread badge
      ↓
Notification dropdown/popover
      ↓
List notifications
      ↓
Click notification
      ↓
Mark as read
      ↓
Navigate using actionUrl
```

Example notification:

```text
┌─────────────────────────────────────┐
│ ✓  Your clips are ready             │
│    7 clips were successfully        │
│    generated.                       │
│                                     │
│    View clips →                     │
│    5 minutes ago                    │
└─────────────────────────────────────┘
```

Unread notifications should have a visually clear but subtle distinction.

Do not redesign the entire dashboard.

---

# 18. Frontend Behavior

When opening the notification dropdown:

```text
GET /notifications
```

When displaying the badge:

```text
GET /notifications/unread-count
```

When clicking an unread notification:

```text
PATCH /notifications/:id/read
```

then:

```text
router.push(notification.actionUrl)
```

If `actionUrl` is missing:

```text
do not attempt navigation
```

If `actionLabel` is missing, the notification can still be clickable if the notification itself has an action URL.

---

# 19. Query Caching

Use TanStack Query according to the existing project's patterns.

After:

```text
mark notification as read
```

the frontend should update/invalidate the relevant:

```text
notifications query
unread count query
```

After:

```text
mark all as read
```

invalidate/update:

```text
notifications
unread count
```

Avoid unnecessary full-page reloads.

---

# 20. Backend Integration — Jobs

This is one of the most important integrations.

Inspect the existing job processing lifecycle.

The current lifecycle is approximately:

```text
pending
  ↓
transcribing
  ↓
detecting_highlights
  ↓
cutting_clips
  ↓
completed / failed
```

Do NOT automatically create a notification for every processing stage.

That would create notification spam.

At minimum create notifications for:

### Successful job

When a job successfully completes:

```ts
await this.notificationsService.create({
  userId: job.userId,
  type: NotificationType.SUCCESS,
  category: NotificationCategory.JOB,
  title: 'Your clips are ready',
  message: `${clipCount} clips were successfully generated.`,
  actionUrl: `/dashboard/jobs/${job._id}`,
  actionLabel: 'View clips',
  entityType: 'job',
  entityId: job._id,
});
```

Use the actual available job/clip information instead of assuming field names.

### Failed job

When a job permanently fails:

```ts
await this.notificationsService.create({
  userId: job.userId,
  type: NotificationType.ERROR,
  category: NotificationCategory.JOB,
  title: 'Clip generation failed',
  message: 'We were unable to generate clips from your video. Please try again.',
  actionUrl: `/dashboard/jobs/${job._id}`,
  actionLabel: 'View job',
  entityType: 'job',
  entityId: job._id,
});
```

Do not expose internal stack traces, ffmpeg errors, API keys, or technical failure details to users.

---

# 21. Idempotency / Duplicate Notifications

This is important because jobs use BullMQ and can be retried.

A job may execute more than once.

Do not blindly create duplicate "Your clips are ready" notifications on every retry.

Inspect the existing job state and processing logic.

Implement the simplest safe solution compatible with the existing schema.

For example, before creating a completion notification, check whether an equivalent notification already exists for that job.

Conceptually:

```ts
findOne({
  userId,
  category: NotificationCategory.JOB,
  entityType: 'job',
  entityId: job._id,
  // appropriate notification identity/type
});
```

If one already exists, don't create another.

Do NOT add a complicated event-sourcing or distributed-idempotency system unless the existing architecture genuinely requires it.

---

# 22. Referral Notifications

Inspect the existing referral implementation.

When a referral reward is successfully granted, create appropriate notifications.

Example for the referrer:

```ts
await this.notificationsService.create({
  userId: referrerId,
  type: NotificationType.SUCCESS,
  category: NotificationCategory.REFERRAL,
  title: 'Referral reward received',
  message: 'You received 1 bonus credit from your referral.',
  actionUrl: '/dashboard/referrals',
  actionLabel: 'View referrals',
  entityType: 'referral',
});
```

Example for the referred user if appropriate:

```ts
await this.notificationsService.create({
  userId: referredUserId,
  type: NotificationType.SUCCESS,
  category: NotificationCategory.REFERRAL,
  title: 'Referral bonus added',
  message: 'You received 1 bonus credit from your referral.',
  actionUrl: '/dashboard',
  actionLabel: 'View dashboard',
});
```

Use the actual existing referral business rules.

Do not change referral eligibility/reward logic.

---

# 23. Billing Notifications

Inspect the current billing implementation.

When subscription/payment state changes, notifications may be created for important events such as:

```text
subscription activated
subscription upgraded
subscription cancelled
payment failed
```

Example:

```ts
await this.notificationsService.create({
  userId,
  type: NotificationType.SUCCESS,
  category: NotificationCategory.BILLING,
  title: 'Pro plan activated',
  message: 'Your Pro subscription is now active.',
  actionUrl: '/dashboard/billing',
  actionLabel: 'View billing',
});
```

For payment failure:

```ts
await this.notificationsService.create({
  userId,
  type: NotificationType.ERROR,
  category: NotificationCategory.BILLING,
  title: 'Payment failed',
  message: 'We could not process your latest payment. Please update your billing information.',
  actionUrl: '/dashboard/billing',
  actionLabel: 'Update billing',
});
```

Do not modify existing billing provider logic.

Also remember that the billing provider may change from Stripe to a Merchant of Record provider, so keep notification logic **provider-agnostic**.

Do not create notification types such as:

```text
STRIPE_PAYMENT_FAILED
```

Use:

```text
BILLING
```

instead.

---

# 24. Email Integration

There is already a:

```text
src/mail/
```

module using Resend.

Inspect:

```text
mail.service.ts
mail.processor.ts
mail.templates.ts
mail.constants.ts
```

before modifying anything.

Do not create another Resend service.

The notification system should coexist with the existing mail system.

For an important event:

```text
Job completed
      │
      ├── NotificationService.create()
      │        ↓
      │     MongoDB
      │
      └── MailService / existing email flow
               ↓
             Resend
```

Keep these responsibilities separate.

If the existing mail system already supports queued email through BullMQ, use that system.

Do not bypass the existing queue architecture just to send notification emails.

---

# 25. Email vs In-App

Do not assume every notification must send an email.

For example:

```text
Job processing started
→ no email

Job completed
→ in-app notification
→ potentially email

Job failed
→ in-app notification
→ potentially email

Subscription activated
→ in-app notification
→ email

Referral reward
→ in-app notification
→ potentially email
```

Follow existing product behavior and avoid email spam.

Do not introduce a large notification-preferences system unless one already exists.

---

# 26. Notification Channel Consideration

The schema currently contains:

```ts
channel: NotificationChannel;
```

with:

```ts
IN_APP = 'in_app'
EMAIL = 'email'
```

Do not incorrectly treat this as an email delivery record.

If the existing architecture reveals that a single notification event needs to support both:

```text
in-app + email
```

without duplicating the notification itself, keep the notification as the user-facing event and let the existing mail system handle email delivery separately.

If you believe the current `channel` field creates a real architectural problem, do not silently redesign it.

Explain the issue and make the smallest production-safe adjustment.

---

# 27. Expiration

The schema has:

```ts
expiresAt?: Date;
```

Do not implement complicated expiration behavior unless it is actually needed.

If MongoDB TTL behavior is desired, inspect the current requirements first.

Do not automatically add a TTL index that could unexpectedly delete user-visible notifications.

A notification should not disappear merely because an arbitrary expiration date was added unless that behavior is explicitly intended.

---

# 28. Notification Categories

Use the existing enum:

```ts
SYSTEM
JOB
BILLING
CREDIT
REFERRAL
ACCOUNT
```

Do not create dozens of categories.

Examples:

```text
JOB
  Your clips are ready
  Clip generation failed

BILLING
  Pro plan activated
  Payment failed

CREDIT
  Credits added
  Credits depleted

REFERRAL
  Referral reward received

ACCOUNT
  Email verified
  Password changed

SYSTEM
  Maintenance
  Important system announcement
```

---

# 29. Notification Type

Use:

```ts
INFO
SUCCESS
WARNING
ERROR
```

Do not create:

```text
JOB_COMPLETED
PAYMENT_FAILED
REFERRAL_SUCCESS
```

as notification types.

The event meaning belongs to the category/title/message/entity.

---

# 30. API Validation

Use the existing DTO and validation conventions.

For example:

```ts
class ListNotificationsDto {
  page?: number;
  limit?: number;
  status?: NotificationStatus;
  category?: NotificationCategory;
}
```

Apply sensible limits.

For example, don't allow:

```text
limit=100000
```

A reasonable maximum such as:

```text
50
```

or whatever convention the existing API uses is sufficient.

Follow the project's existing `ValidationPipe` and DTO style.

---

# 31. Error Handling

Follow the existing exception/filter architecture.

Do not introduce a new error-handling framework.

For example:

```text
notification not found
```

should be handled consistently with the rest of the API.

Do not reveal database errors to users.

---

# 32. Performance

The notification system must remain efficient.

Use the existing indexes:

```ts
NotificationSchema.index({
  userId: 1,
  status: 1,
  createdAt: -1,
});

NotificationSchema.index({
  userId: 1,
  createdAt: -1,
});

NotificationSchema.index({
  expiresAt: 1,
});
```

Notification list queries should:

```text
filter by userId
sort by createdAt
paginate
```

Unread count should use a database count operation.

Mark-all-read should use:

```text
updateMany
```

rather than fetching every notification first.

---

# 33. Security Checklist

Verify:

* Users can only read their own notifications.
* Users can only mark their own notifications as read.
* Users can only delete their own notifications.
* No arbitrary `userId` from client input is trusted.
* Notification creation is internal/backend-controlled.
* Internal errors are not exposed to users.
* Notification metadata does not leak secrets.
* Action URLs do not expose credentials/tokens.
* No sensitive provider/API information is placed into notification messages.

---

# 34. Do Not Overengineer

Do NOT introduce:

```text
Kafka
RabbitMQ
Event sourcing
ClickHouse
microservices
separate notification database
complex preference engine
generic workflow engine
```

unless the existing application already uses them.

Blynta is currently a NestJS + MongoDB + Redis/BullMQ application.

Keep the notification system appropriate for that architecture.

---

# 35. Implementation Process

Before changing code:

### Step 1 — Inspect

Inspect:

```text
auth
users
jobs
billing
mail
frontend authentication
frontend API client
frontend TanStack Query usage
dashboard/header/navigation
```

Understand the existing conventions.

### Step 2 — Compare

Determine:

* How authenticated user IDs are accessed.
* How controllers are protected.
* How DTOs are written.
* How MongoDB models are registered.
* How services are structured.
* How API responses are formatted.
* How errors are handled.
* How frontend API requests are implemented.
* How TanStack Query hooks are organized.
* Where the notification bell should live.

### Step 3 — Implement

Implement the notification system using those conventions.

### Step 4 — Integrate

Integrate with:

```text
Jobs
Billing
Referrals
Mail
Frontend dashboard
```

only where appropriate.

### Step 5 — Test

Run:

```text
TypeScript/build checks
ESLint
existing backend tests
existing frontend checks
```

and add focused tests for the notification functionality.

---

# 36. Important — Preserve Existing Behavior

Do NOT:

* rewrite authentication
* rewrite the mail system
* rewrite billing
* rewrite jobs
* rewrite the referral system
* change existing API response formats unnecessarily
* change existing frontend design unnecessarily
* replace TanStack Query
* replace Axios
* introduce another state-management system
* change database models unrelated to notifications

If an existing implementation already solves something correctly, reuse it.

---

# 37. Expected Final Architecture

The desired architecture should look approximately like:

```text
                    ┌─────────────────────┐
                    │   JobsService       │
                    └──────────┬──────────┘
                               │
                               │ create()
                               ▼
                    ┌─────────────────────┐
                    │ NotificationsService│
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ MongoDB             │
                    │ notifications       │
                    └──────────┬──────────┘
                               │
                               │ API
                               ▼
                    ┌─────────────────────┐
                    │ Next.js Frontend    │
                    │ TanStack Query      │
                    └──────────┬──────────┘
                               │
                               ▼
                       Notification Bell


                    Important email event
                               │
                               ▼
                       Existing MailService
                               │
                               ▼
                            Resend
```

The key separation is:

```text
NotificationService
        ≠
MailService
```

---

# 38. Deliverables

After implementation, provide a concise summary containing:

### Backend

```text
Files created
Files modified
New API endpoints
Notification service methods
```

### Frontend

```text
Files created
Files modified
Notification UI location
Query/hooks added
```

### Integrations

Clearly state which events now generate notifications:

```text
Jobs:
- completed
- failed

Billing:
- ...

Referrals:
- ...

Account:
- ...
```

### Testing

Report:

```text
Build: PASS/FAIL
Lint: PASS/FAIL
Tests: PASS/FAIL
```

If something fails, explain the exact reason instead of hiding it.

---

# Final instruction

**First inspect the entire relevant existing implementation. Then implement the notification system.**

Do not blindly follow this prompt if the existing codebase already has a better-established convention.

The goal is not to make the largest possible notification system.

The goal is:

> **A secure, production-grade, maintainable notification system that naturally fits into the existing Blynta application and does not break existing functionality.**

Make the smallest set of changes required to achieve this correctly.
