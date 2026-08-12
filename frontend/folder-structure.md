THE FOLDER STRUCTURE IS JUST EXAMPLE HOW TO STRUCTURE THE PROJECT, NOT THE CONTENT TO FOLLOW.

src/
├── app/                                    # Routing only — no logic
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/
│   │   │   ├── freelancer/page.tsx
│   │   │   └── client/page.tsx
│   │   └── layout.tsx
│   │
│   ├── (main)/
│   │   ├── dashboard/
│   │   │   ├── page.tsx
│   │   │   └── error.tsx                   # scoped error boundary
│   │   ├── jobs/
│   │   │   ├── page.tsx                    # browse/search jobs
│   │   │   ├── [jobId]/
│   │   │   │   ├── page.tsx
│   │   │   │   └── proposal/page.tsx       # submit proposal
│   │   │   └── post/page.tsx               # client posts a job
│   │   ├── freelancers/
│   │   │   ├── page.tsx                    # browse/search freelancers
│   │   │   └── [username]/page.tsx         # public profile
│   │   ├── contracts/
│   │   │   ├── page.tsx
│   │   │   └── [contractId]/
│   │   │       ├── page.tsx
│   │   │       └── milestones/page.tsx
│   │   ├── messages/
│   │   │   ├── page.tsx
│   │   │   └── [conversationId]/page.tsx
│   │   ├── proposals/
│   │   │   └── page.tsx                    # freelancer's sent proposals
│   │   ├── payments/
│   │   │   ├── page.tsx
│   │   │   ├── withdraw/page.tsx
│   │   │   └── history/page.tsx
│   │   ├── reviews/
│   │   │   └── [userId]/page.tsx
│   │   ├── settings/
│   │   │   ├── profile/page.tsx
│   │   │   ├── billing/page.tsx
│   │   │   └── notifications/page.tsx
│   │   ├── layout.tsx                      # sidebar/nav shell
│   │   └── error.tsx
│   │
│   ├── layout.tsx                          # root layout, AppProviders
│   └── globals.css
│
├── features/
│   ├── jobs/
│   │   ├── components/
│   │   │   ├── JobCard.tsx
│   │   │   ├── JobFilters.tsx
│   │   │   ├── JobPostForm.tsx
│   │   │   └── JobMapView.tsx              # composes features/map (remote/onsite jobs)
│   │   ├── hooks/
│   │   │   ├── useJobsQuery.ts
│   │   │   ├── useJobQuery.ts
│   │   │   ├── useCreateJobMutation.ts
│   │   │   └── useJobFiltersStore.ts       # RTK — active filter state
│   │   ├── api/
│   │   │   └── jobs.api.ts
│   │   ├── queryKeys.ts                    # jobKeys — feature-owned
│   │   ├── store/
│   │   │   └── jobFiltersSlice.ts
│   │   └── types.ts
│   │
│   ├── proposals/
│   │   ├── components/
│   │   │   ├── ProposalForm.tsx
│   │   │   └── ProposalList.tsx
│   │   ├── hooks/
│   │   │   ├── useProposalsQuery.ts
│   │   │   └── useSubmitProposalMutation.ts
│   │   ├── api/
│   │   ├── queryKeys.ts
│   │   └── types.ts
│   │
│   ├── freelancers/
│   │   ├── components/
│   │   │   ├── FreelancerCard.tsx
│   │   │   ├── FreelancerProfileHeader.tsx
│   │   │   ├── SkillsBadgeList.tsx
│   │   │   └── PortfolioGrid.tsx
│   │   ├── hooks/
│   │   │   ├── useFreelancersQuery.ts
│   │   │   └── useFreelancerProfileQuery.ts
│   │   ├── api/
│   │   ├── queryKeys.ts
│   │   └── types.ts
│   │
│   ├── contracts/
│   │   ├── components/
│   │   │   ├── ContractCard.tsx
│   │   │   ├── MilestoneTracker.tsx
│   │   │   └── ContractStatusBadge.tsx
│   │   ├── hooks/
│   │   │   ├── useContractsQuery.ts
│   │   │   ├── useContractQuery.ts
│   │   │   └── useUpdateMilestoneMutation.ts
│   │   ├── api/
│   │   ├── queryKeys.ts
│   │   └── types.ts
│   │
│   ├── messaging/
│   │   ├── components/
│   │   │   ├── ConversationList.tsx
│   │   │   ├── MessageThread.tsx
│   │   │   └── MessageComposer.tsx
│   │   ├── hooks/
│   │   │   ├── useConversationsQuery.ts
│   │   │   ├── useMessagesQuery.ts
│   │   │   ├── useSendMessageMutation.ts    # optimistic update pattern
│   │   │   └── useMessageSocket.ts          # real-time layer
│   │   ├── api/
│   │   ├── queryKeys.ts
│   │   └── types.ts
│   │
│   ├── payments/
│   │   ├── components/
│   │   │   ├── WalletSummaryCard.tsx
│   │   │   ├── WithdrawForm.tsx
│   │   │   └── TransactionHistoryTable.tsx
│   │   ├── hooks/
│   │   │   ├── useWalletQuery.ts
│   │   │   ├── useTransactionsQuery.ts      # likely useInfiniteQuery
│   │   │   └── useWithdrawMutation.ts
│   │   ├── api/
│   │   ├── queryKeys.ts
│   │   └── types.ts
│   │
│   ├── reviews/
│   │   ├── components/
│   │   │   ├── ReviewCard.tsx
│   │   │   └── ReviewForm.tsx
│   │   ├── hooks/
│   │   │   ├── useReviewsQuery.ts
│   │   │   └── useSubmitReviewMutation.ts
│   │   ├── api/
│   │   ├── queryKeys.ts
│   │   └── types.ts
│   │
│   ├── notifications/
│   │   ├── components/
│   │   │   └── NotificationBell.tsx
│   │   ├── hooks/
│   │   │   ├── useNotificationsQuery.ts
│   │   │   └── useNotificationSocket.ts
│   │   ├── api/
│   │   ├── queryKeys.ts
│   │   └── types.ts
│   │
│   ├── map/                                 # shared service — consumed by jobs/freelancers
│   │   ├── components/
│   │   │   ├── MapContainer.tsx
│   │   │   ├── InteractiveMapView.tsx       # bounds-driven search (browse freelancers by location)
│   │   │   ├── StaticLocationPin.tsx        # single pin (freelancer profile location)
│   │   │   └── MapSearchBox.tsx
│   │   ├── hooks/
│   │   │   ├── useMapInstance.ts
│   │   │   ├── useGeocoding.ts
│   │   │   └── usePlacesAutocomplete.ts
│   │   ├── services/
│   │   │   └── googleMapsLoader.ts
│   │   ├── store/
│   │   │   └── mapSlice.ts
│   │   └── types.ts
│   │
│   └── auth/
│       ├── components/
│       │   ├── LoginForm.tsx
│       │   └── RoleSelector.tsx             # freelancer vs client at signup
│       ├── hooks/
│       │   └── useAuthMutation.ts
│       ├── api/
│       ├── store/
│       │   └── authSlice.ts                 # current user, role, token — RTK
│       └── types.ts
│
├── components/
│   ├── ui/                                  # shadcn primitives
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── Sidebar.tsx
│   │   └── AppShell.tsx
│   └── common/
│       ├── InfiniteScroll.tsx
│       ├── DataTable.tsx                    # reused: transactions, contracts, proposals lists
│       ├── LoadingSkeleton.tsx
│       ├── EmptyState.tsx
│       └── RatingStars.tsx                  # generic, used by reviews + freelancer cards
│
├── lib/
│   ├── api/
│   │   ├── httpClient.ts                    # axios/fetch wrapper, auth interceptor
│   │   └── endpoints.ts
│   ├── query/
│   │   ├── createQueryKeys.ts               # shared factory
│   │   ├── queryKeys.ts                     # thin re-export registry
│   │   └── queryClient.ts                   # QUERY_DEFAULTS + client instance
│   ├── maps/
│   │   └── mapConfig.ts
│   ├── validators/                          # zod schemas
│   │   ├── job.schema.ts
│   │   ├── proposal.schema.ts
│   │   └── profile.schema.ts
│   └── utils.ts
│
├── store/
│   ├── store.ts                             # RTK configureStore
│   ├── rootReducer.ts                       # combines authSlice, jobFiltersSlice, mapSlice
│   └── hooks.ts                             # typed useAppDispatch/useAppSelector
│
├── providers/
│   ├── QueryProvider.tsx
│   ├── ReduxProvider.tsx
│   ├── MapsProvider.tsx                     # Google Maps APIProvider, loaded once
│   └── AppProviders.tsx                     # composes all
│
├── types/
│   └── index.ts                             # cross-feature shared types (User, Money, etc.)
│
├── middleware.ts                            # route protection (freelancer vs client routes)
└── config/
    └── env.ts                               # validated env vars, public/server split