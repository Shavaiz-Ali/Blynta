MASTER PROMPT — Redesign Single Clip Details Page Without Losing Any Existing Features

I want you to completely redesign the Individual Generated Clip Details page in my Blynta application.

This is primarily a UX/UI redesign and information architecture improvement, but you may also modify the backend/API where required.

CRITICAL REQUIREMENT

DO NOT REMOVE, HIDE, OR DROP ANY EXISTING FUNCTIONALITY FROM THE CURRENT CLIP DETAILS FLOW.

The previous redesign attempts improved the visual hierarchy but accidentally removed or minimized important features that already existed.

Before changing anything, inspect the current implementation and all existing clip-related components/API responses and create a complete inventory of what the user can currently see and do.

The new design must preserve all existing functionality while presenting it in a much more intuitive and professional way.

Product Context

Blynta is an AI video clipping platform.

The user workflow is:

Long-form/source video
        ↓
AI analyzes video
        ↓
AI generates multiple short clips
        ↓
User opens one generated clip
        ↓
User reviews the clip
        ↓
User reviews AI analysis
        ↓
User copies generated social/SEO content
        ↓
User downloads / shares / schedules the clip
        ↓
Future: user edits/customizes the clip

The individual clip page is therefore not just a video player.

It is a content publishing workspace.

It needs to help the user:

Watch the clip.
Understand why it was selected.
Review the AI score.
Review the generated title.
Copy the description.
Copy keywords.
Copy hashtags/tags.
See the source timestamp.
Download the video.
Share the clip.
Schedule the clip/post.
Navigate to other generated clips.
Eventually customize/edit the clip.
Understand which editing features are currently unavailable.
IMPORTANT: Current Features Must Be Preserved

The existing page already contains functionality/data around:

Video
Generated short video
9:16 preview
Playback
Scrubbing
Duration
Source timestamp
Auto-framing indicator
Loop
Fullscreen
Playback speed
Volume
Clip information
Clip title
Description
Source video
Clip number
Duration
Start timestamp
End timestamp
Aspect ratio
Processing status
AI analysis
AI Viral Score
Viral score out of 100
Impact level
Hook type/style
Why this clip works
Opening retention hook
Generated content
Generated title
Generated description
SEO keywords
Trending hashtags
Tags
Copy buttons / Copy All functionality
Publishing/actions
Download MP4
Share
Schedule Post
More/actions menu
Delete where currently supported
Future editing
Aspect ratio
Caption styling
Typography
Fonts
Animations
B-roll
Branding
Watermark
Other Studio features

Some editing functionality is intentionally not implemented yet, so those controls should remain disabled / "Coming Soon".

None of the existing publishing/content-generation functionality should disappear in the redesign.

FIRST: Audit the Existing Implementation

Before writing the new UI, inspect:

features/jobs/components/

especially:

JobDetail.tsx
StudioCenterPanel.tsx
StudioLeftPanel.tsx
StudioRightPanel.tsx
StudioVideoPlayer.tsx
VideoMetadataKit.tsx
ScoreGauge.tsx
CaptionStylingCard.tsx
TranscriptDialog.tsx

features/jobs/components/player/
├── PlayerControls.tsx
├── PlayerMenuDropdown.tsx
├── PlayerOverlay.tsx
├── PlayerScrubber.tsx
├── PlayerTopBar.tsx
├── StudioVideoPlayer.tsx
└── ...

Also inspect:

queries.ts
types.ts
API functions
backend job schemas
backend source-video schema
jobs controller
jobs service
media services
storage/R2 handling
any existing scheduling/share functionality
any existing AI SEO/social content generation

Create a mental/technical inventory of:

Feature
Where it is implemented
API/data source
Current interaction
Should preserve?

Then redesign the page.

THE NEW PAGE SHOULD BE A "CLIP WORKSPACE"

Do not think of the page as:

Video + several cards.

Think of it as:

A workspace for reviewing, preparing, and publishing an AI-generated short.

The page should have a strong hierarchy.

Recommended Information Architecture

The page should roughly become:

┌──────────────────────────────────────────────────────────────┐
│ Clips / Source Video / Clip                                  │
│                                                              │
│ Mind-Blowing Magic Trick 🤯                                  │
│                                                              │
│                                  Share  Schedule  Download    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                       VIDEO WORKSPACE                         │
│                                                              │
│                    ┌─────────────┐                            │
│                    │             │                            │
│                    │   9:16     │                            │
│                    │   VIDEO     │                            │
│                    │             │                            │
│                    └─────────────┘                            │
│                                                              │
│                 49:40 → 50:38 · 58 sec                       │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ AI INSIGHTS                                                  │
│                                                              │
│ 96/100     Strong Retention Hook     Curiosity Hook           │
│                                                              │
│ Why this clip works                                          │
│ ...                                                          │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ SOCIAL CONTENT                                               │
│                                                              │
│ Title                                                        │
│ [generated title........................] [Copy]             │
│                                                              │
│ Description                                                  │
│ [generated description...................] [Copy]             │
│                                                              │
│ Keywords                                                     │
│ [magic] [mentalism] [mindblown] [Copy All]                  │
│                                                              │
│ Hashtags                                                     │
│ [#magic] [#mentalism] [#illusion] [Copy All]                │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ CUSTOMIZE                                                   │
│                                                              │
│ Aspect Ratio                                                 │
│ [9:16] [1:1] [16:9]                                          │
│                                                              │
│ Captions       Coming Soon                                  │
│ Typography     Coming Soon                                  │
│ Animations     Coming Soon                                  │
│ Branding       Coming Soon                                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘

This is only the information architecture.

Do not blindly copy this exact layout.

Use your design judgment to make it look polished.

1. Header

Create a compact, professional header.

Example:

← Clips / India's Got Latent S2 EP6

Mind-Blowing Magic Trick 🤯

                    Share
                    Schedule
                    Download MP4
                    •••

The source video should remain accessible.

The breadcrumb should not consume excessive vertical space.

2. Video Is Still the Hero

The video is the primary object.

It should be the largest visual element on the page.

Use the existing video player.

Preserve all current player functionality.

The user should be able to:

play
pause
scrub
change volume
change playback speed
loop
fullscreen
see duration

Do not remove controls just to make the UI cleaner.

"Cleaner" means better organization, not fewer capabilities.

3. Clip Navigation

The user should be able to move between generated clips without constantly returning to the source-video page.

Add:

‹ Previous       Clip 1 of 6       Next ›

or an equivalent interaction.

Optionally provide a compact thumbnail strip:

[01] [02] [03] [04] [05] [06]

Current clip should be visually selected.

This is especially important because users will likely review multiple AI-generated clips from the same source video.

4. Quick Clip Metadata

Near the video, show:

58 sec
49:40 → 50:38
9:16
AI Auto-Framed

Do not turn every item into a giant card.

Use compact metadata.

5. AI Viral Score

Keep the AI Viral Score.

The current data:

96 / 100

should remain.

But present it elegantly.

Example:

AI VIRAL SCORE

96 / 100

High Impact
Strong Retention Hook

The score can use a ring/gauge/progress visualization.

Do not let this section visually overpower the video.

6. Why This Clip Works

Preserve the AI explanation.

Show:

Why this clip works

A mind-blowing magic trick involving a drawn cross
appearing in someone's closed palm leaves everyone stunned.

Also preserve:

Opening Retention Hook

"Mind-Blowing Magic Trick 🤯"

And:

Hook Type

Curiosity Hook

These should be grouped into a coherent AI Insights section.

7. SOCIAL CONTENT — DO NOT REMOVE THIS

This is one of the most important existing features.

The AI generates content that the user can use when publishing the short.

The redesigned page MUST retain it.

Create a dedicated:

Social Content

section.

It should include:

Title
Title

Mind-Blowing Magic Trick 🤯

[ Copy ]

The generated title should be easy to copy.

Description
Description

Watch the exact moment a mentalism trick leaves
the panel completely speechless as a drawn cross
appears on Rakhi Sawant's hand.

[ Copy ]

Use a clean text area/preview.

Don't truncate useful content unnecessarily.

If the description is long, allow expansion.

SEO Keywords
SEO Keywords

magic
mentalism
mindblown
illusion
rakhi-sawant

[ Copy All ]

Each keyword can be a pill/tag.

Trending Hashtags
Trending Hashtags

#magic
#mentalism
#mindblown
#illusion
#rakhi-sawant

[ Copy All ]
Copy UX

Make copying extremely easy.

When the user clicks:

Copy

show a temporary state:

✓ Copied

Use toast feedback where appropriate.

Do not navigate away.

Do not open unnecessary dialogs.

8. Do Not Mix Keywords and Hashtags

Keep these conceptually separate:

SEO Keywords

magic
mentalism
mindblown
illusion

and:

Trending Hashtags

#magic
#mentalism
#mindblown
#illusion

If the backend already distinguishes them, preserve that distinction.

Do not rename data just for visual reasons.

9. Publishing Actions

The previous flow included publishing-related actions.

These MUST remain accessible.

Share

Keep:

Share

Use the existing share implementation if one exists.

If it currently creates/copies a share link, preserve that.

10. Schedule Post

Do not remove Schedule Post.

This is an important publishing action.

The user should be able to initiate scheduling from the clip page.

Example:

[ Schedule Post ]

Opening it should provide the existing scheduling flow if implemented.

If scheduling is currently partially implemented:

preserve existing functionality
improve its UI
do not replace it with a fake button

If the backend requires changes, update the backend appropriately.

Potential UI:

Schedule Post

Platform
[ YouTube ▼ ]

Date
[ Sep 10, 2026 ]

Time
[ 08:00 PM ]

Caption
[ generated description... ]

Hashtags
[ ... ]

             Cancel    Schedule Post

Only expose platforms/features actually supported by the existing backend.

Do not invent social integrations.

11. Download MP4

Keep:

Download MP4

This should remain one of the primary actions.

Use the existing storage/video URL implementation.

Do not break R2/storage URLs.

12. More Menu

Move less frequently used actions into:

•••

Potential existing actions:

Delete
Copy link
Other supported actions

Do not put important actions like Download behind the menu.

13. Social / Publishing Section Should Feel Like a Publishing Workspace

The user should be able to mentally understand:

VIDEO
   ↓
AI ANALYSIS
   ↓
READY-TO-PUBLISH CONTENT
   ↓
PUBLISH / SCHEDULE

This is the key UX.

The generated title, description, keywords and hashtags aren't random metadata.

They are content prepared for publishing.

Design them accordingly.

14. Consider a "Ready to Publish" Section

A strong UX option is:

READY TO PUBLISH

Your AI-generated content is ready.

Title                  [ Copy ]
Description            [ Copy ]
Keywords               [ Copy All ]
Hashtags               [ Copy All ]

[ Schedule Post ]
[ Download MP4 ]

This could be the most useful section after AI analysis.

Use this concept if it improves the page.

15. Editing / Studio

Editing functionality will be implemented later.

Therefore create a clean future-facing:

Customize

section.

Keep currently available functionality working.

For unavailable features:

Captions
Animated subtitles
                    Coming Soon

Typography
Fonts, colors and styling
                    Coming Soon

Animations
Motion effects and B-roll
                    Coming Soon

Branding
Logo / intro / outro
                    Coming Soon

These should be visually disabled.

Do not make them appear broken.

16. Aspect Ratio

If aspect ratio functionality currently works, preserve it.

Example:

Aspect Ratio

[ 9:16 ]    [ 1:1 ]    [ 16:9 ]

If only 9:16 currently works:

[ 9:16 ]

1:1       Coming Soon
16:9      Coming Soon

Do not create frontend controls for functionality the backend cannot actually perform.

17. Transcript

If the existing flow provides a Transcript action/dialog, keep it.

For example:

[ Transcript ]

It can open a dialog/drawer containing the transcript.

Do not remove the transcript just because it isn't part of the primary visual hierarchy.

It belongs under secondary/supporting actions.

18. Existing Caption Styling

If caption styling currently exists but editing is disabled, preserve the feature representation.

Do not delete:

Caption Styling
Typography
Keyword highlighting
Animation style

Instead make unavailable functionality clearly:

Coming Soon
19. Responsive UX

Desktop:

Header
    ↓
Video + primary information
    ↓
AI Insights
    ↓
Social Content
    ↓
Customize

Mobile:

Back
↓
Title
↓
Video
↓
Quick metadata
↓
Actions
↓
AI Insights
↓
Social Content
↓
Customize
↓
Publishing

The mobile layout should not simply shrink the desktop version.

20. Avoid Excessive Cards

This is still important.

The current design has too many cards.

Do NOT turn:

Score
Why clip works
SEO
Description
Keywords
Hashtags
Customize

into seven giant cards.

Instead group related information.

For example:

AI INSIGHTS
────────────────────────

Score
Hook
Why it works
Opening hook

and:

READY TO PUBLISH
────────────────────────

Title
Description
Keywords
Hashtags

Copy actions
Schedule

Use whitespace, dividers, typography and subtle backgrounds to create hierarchy.

21. Visual Hierarchy

Prioritize in this order:

Level 1 — Video

The generated short is the primary object.

Level 2 — Clip identity/actions

Title, source, download, share, schedule.

Level 3 — AI insights

Score, hook, why it works.

Level 4 — Publishing content

Title, description, keywords, hashtags.

Level 5 — Secondary information

Transcript, timestamps, technical metadata.

Level 6 — Future editing

Captions, typography, animations, branding.

22. Don't Lose Existing Data

Before finalizing the redesign, compare the new page against the old implementation.

Create a checklist:

[ ] Video playback
[ ] Player controls
[ ] Scrubbing
[ ] Duration
[ ] Source timestamp
[ ] Title
[ ] Description
[ ] Viral score
[ ] Hook type
[ ] Why clip works
[ ] Opening hook
[ ] SEO keywords
[ ] Trending hashtags
[ ] Tags
[ ] Copy title
[ ] Copy description
[ ] Copy keywords
[ ] Copy hashtags
[ ] Copy all
[ ] Share
[ ] Schedule post
[ ] Download MP4
[ ] Delete
[ ] Transcript
[ ] Aspect ratio
[ ] Caption styling
[ ] Typography
[ ] Animations
[ ] Branding
[ ] Processing state
[ ] Failed state
[ ] Loading state
[ ] Previous/next clip

Every feature that currently exists must either remain functional or be intentionally represented as "Coming Soon" if it is a future editing feature.

23. Backend/API Audit

Because we're changing the frontend information architecture, inspect whether the backend currently exposes all required information.

The individual clip response should provide the data needed for:

Video
Title
Description
AI score
Hook
Analysis
Timestamp
Keywords
Hashtags
Tags
Source video
Status
Storage URL
Thumbnail

Do not make the frontend fetch an unnecessarily huge job object.

If necessary, create/update a dedicated clip-detail response DTO.

24. Scheduling Backend

Inspect the current backend for any scheduling implementation.

Search for:

schedule
scheduled
publish
social
post
calendar

If it exists:

preserve it
connect it correctly
improve the UI

If it does not exist:

Do not build an entire social scheduling system just for this redesign.

Instead create the UI architecture only if appropriate and clearly mark unavailable functionality as:

Coming Soon
25. Backend Architecture

Do not create duplicate clip-processing logic.

The existing backend already has:

jobs
source-video
media
highlight detection
transcription
clip cutting
caption burning
storage

Reuse the existing domain.

Only modify:

schemas
DTOs
services
controller endpoints

when necessary for clean clip retrieval/publishing data.

26. API Design

The frontend should conceptually have access to:

GET /jobs/:jobId/clips

for generated clips from a source video.

And:

GET /clips/:clipId

for an individual clip.

If the existing API design is better, keep it.

Do not create endpoints just because these exact URLs look nice.

Follow the existing backend conventions.

27. Security

Every clip request must verify ownership/access.

A user must not be able to access another user's clip simply by changing:

clipId

Use the existing authorization/access-control patterns.

28. React Query

Use the existing TanStack Query architecture.

Create clean query boundaries such as:

useSourceVideoClips()
useClip()

if appropriate.

Do not duplicate requests unnecessarily.

After scheduling/deleting/updating something, invalidate only the appropriate queries.

29. Component Architecture

Do not create one enormous:

ClipDetails.tsx

Instead create logical components.

For example:

ClipDetails
├── ClipHeader
├── ClipNavigation
├── ClipVideoWorkspace
├── ClipQuickStats
├── AIInsights
│   ├── ViralScore
│   ├── HookInsight
│   └── WhyItWorks
├── PublishContent
│   ├── GeneratedTitle
│   ├── GeneratedDescription
│   ├── SEOKeywords
│   └── Hashtags
├── PublishActions
│   ├── Share
│   ├── SchedulePost
│   └── Download
├── Transcript
└── ClipCustomization

Adapt this to the existing feature architecture.

Don't create duplicate components if equivalent components already exist.

30. Copy UX

Copying generated content should be extremely obvious.

For example:

TITLE

Mind-Blowing Magic Trick 🤯

                           Copy

After clicking:

✓ Copied

For multiple tags:

KEYWORDS

[magic] [mentalism] [mindblown] [illusion]

                         Copy all

Use proper clipboard handling.

31. Empty / Missing Data

If AI content isn't available:

Description

No description generated yet.

Do not render broken UI.

If keywords are missing, don't show:

Keywords: undefined

Handle optional fields properly.

32. Processing State

If the clip is processing:

Generating your short...

We're preparing your video and AI insights.

Don't show incomplete publishing content as if it were ready.

33. Failed State

If generation fails:

We couldn't generate this clip.

[ Try again ]    [ Back to source video ]

Only show Retry if the backend supports it.

34. Design Quality

The visual language should remain consistent with Blynta:

dark premium UI
navy/black background
blue primary accent
white typography
subtle borders
restrained shadows
clear status badges
polished hover states
good spacing

But do not overdo:

cards
gradients
glow
rounded containers
huge score graphics

It should feel like a professional AI video/content publishing application.

35. Final User Journey

The final UX should feel like this:

                CLIP WORKSPACE
                       │
                       ▼
                 Watch Video
                       │
                       ▼
                Understand AI
                       │
              ┌────────┴────────┐
              ▼                 ▼
         AI Insights       Clip Details
              │                 │
              └────────┬────────┘
                       ▼
                READY TO PUBLISH
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
        Copy         Share       Schedule
          │
          ▼
       Download
                       │
                       ▼
                 Customize Later

The user should never wonder:

"Where is the description?"

or:

"Where are my hashtags?"

or:

"How do I copy the keywords?"

or:

"Where did Schedule Post go?"

All existing capabilities must remain discoverable.

36. Most Important Rule

Do not sacrifice functionality for visual simplicity.

The goal is:

OLD PAGE
Many features + poor hierarchy
        ↓
        ↓
NEW PAGE
Same features + dramatically better hierarchy

NOT:

OLD PAGE
Many features
        ↓
NEW PAGE
Pretty UI + fewer features

The redesign should make the existing functionality easier to discover and use, not remove it.

37. Final Acceptance Criteria

I will consider the redesign successful only if:

UX
Video is clearly the hero.
Page doesn't feel like a stack of dashboard cards.
Information hierarchy is immediately understandable.
User can review multiple clips easily.
Publishing content is easy to find.
Copy actions are obvious.
Schedule Post remains accessible.
Share and Download remain accessible.
AI analysis is easy to scan.
Future editing features don't clutter the experience.
Functionality
Existing player functionality works.
Existing AI data works.
Description is available.
Keywords are available.
Hashtags/tags are available.
Copy functionality works.
Schedule functionality remains available where supported.
Share works.
Download works.
Transcript works if currently supported.
Existing processing/failed states work.
Existing authorization remains intact.
Technical
No fake data.
No hardcoded AI values.
No unnecessary duplicate APIs.
No unnecessary duplicate components.
No any unless unavoidable.
No broken TypeScript.
No lint errors.
No broken existing job-processing functionality.
Final instruction

Do not start by coding.

First inspect the existing implementation and identify every existing feature/data point on the current clip details flow.

Then redesign the page around:

VIDEO → AI INSIGHTS → READY TO PUBLISH → PUBLISH ACTIONS → FUTURE CUSTOMIZATION

while preserving 100% of the currently supported functionality.

The objective is not simply to make the page prettier.

The objective is to make the user think:

"I can watch my clip, understand why it's good, copy everything I need for social media, schedule it, download it, and eventually edit it — all from this one workspace."