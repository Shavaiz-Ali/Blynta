BLYNTA — COMPLETE UI/UX REDESIGN + FRONTEND ARCHITECTURE REFACTOR
# BLYNTA — COMPLETE PRODUCT UI/UX REDESIGN

You are acting as a:

- Senior Product Designer
- Senior UI/UX Designer
- Senior React / Next.js Engineer
- Senior Frontend Architect
- Design Systems Engineer

You are working on an existing SaaS application called **Blynta**.

Blynta is an AI-powered video clipping platform that converts long-form content such as:

- YouTube videos
- Podcasts
- Interviews
- Streams
- Lectures
- Other long-form videos

into short-form clips.

The application already has working functionality.

Your task is to perform a **complete end-to-end UI/UX redesign and frontend architecture cleanup** while preserving existing functionality.

---

# 🚨 CRITICAL RULES — READ BEFORE TOUCHING THE CODE

## 1. THIS IS A REDESIGN, NOT A REWRITE OF BUSINESS LOGIC

The goal is to redesign the application.

DO NOT unnecessarily rewrite:

- API logic
- authentication logic
- React Query logic
- NextAuth
- backend integration
- data models
- business logic
- video processing logic
- job processing
- billing logic
- existing working functionality

If existing functionality works, preserve it.

Change the presentation, structure, component organization, and UX where necessary.

---

# 2. `global.css` AND `layout.tsx` ARE THE SOURCE OF TRUTH

Before making ANY UI changes, inspect:

- `app/globals.css`
- `app/layout.tsx`

Also inspect any providers/theme files used by `layout.tsx`.

These files define the existing application's:

- theme
- CSS variables
- colors
- fonts
- global styles
- dark/light mode
- providers
- typography foundations
- global application behavior

### DO NOT create a second theme system.

Do NOT introduce another unrelated:

- color palette
- font system
- theme provider
- CSS variable system
- global background system
- typography system

unless there is a genuine architectural reason.

The redesigned application MUST use the existing theme infrastructure from:

`global.css`

and

`layout.tsx`.

---

# 3. DO NOT BREAK THE EXISTING THEME

If `global.css` already defines variables such as:

```css
--background
--foreground
--primary
--secondary
--muted
--border
--card

or similar variables:

USE THEM.

Do not hardcode completely different colors throughout components.

Prefer:

bg-background
text-foreground
border-border
bg-card
text-muted-foreground
bg-primary
text-primary-foreground

where appropriate.

If the existing design tokens need refinement, update the centralized theme variables rather than scattering hardcoded values across the application.

The goal is a coherent design system.

4. SHADCN/UI IS THE DEFAULT UI COMPONENT SYSTEM

The project already uses shadcn/ui.

You MUST use shadcn/ui components whenever an appropriate component exists.

Examples:

Button
Input
Textarea
Select
DropdownMenu
Dialog
Sheet
Tabs
Tooltip
Popover
Command
Badge
Card
Separator
Skeleton
Avatar
Alert
Toast / Sonner
Progress
ScrollArea
Checkbox
RadioGroup
Switch
Slider
Table
Breadcrumb
Pagination
etc.
5. IF A REQUIRED SHADCN COMPONENT IS MISSING

DO NOT immediately build a custom component.

First check whether the required shadcn/ui component can be added.

If it is missing:

Install/add the appropriate shadcn component.
Use that component.
Customize it through className/variants where appropriate.
Keep the styling consistent with the existing theme.

For example:

If you need a Sheet but it doesn't exist:

ADD the shadcn Sheet component.

Do NOT create:

CustomMobileSidebar.tsx

with manually implemented dialog/drawer behavior unless there is a genuine reason.

The same applies to:

dialogs
dropdowns
tooltips
tabs
inputs
selects
popovers
command menus
etc.
6. DO NOT CREATE A SECOND COMPONENT LIBRARY

Do not introduce another UI library unless the existing application genuinely requires it.

Do not replace shadcn with:

Material UI
Chakra
Ant Design
Mantine
Bootstrap
random component libraries

Blynta should have ONE coherent UI system.

Primary UI foundation:

shadcn/ui + Tailwind + existing global.css theme

7. THE FOLDER STRUCTURE PROVIDED IS AN ARCHITECTURAL EXAMPLE

The folder structure shown to you is NOT the business-domain structure to copy.

It is only an example of how the project should be organized.

DO NOT create unrelated features just because they exist in the example.

For example, if an example contains:

jobs
freelancers
contracts
payments
reviews

do NOT assume Blynta needs those.

Instead:

Apply the same architectural principles to Blynta's ACTUAL features.

FIRST TASK — AUDIT THE EXISTING PROJECT

Before editing anything, inspect the existing frontend.

Understand:

current routes
current layouts
global.css
layout.tsx
providers
theme
components
features
API layer
React Query
authentication
existing dashboard
jobs
clips
billing
video player
editor
processing states
existing responsive behavior

Do not start changing files before understanding the current architecture.

CURRENT BLYNTA FUNCTIONALITY

The application currently contains functionality around:

Authentication
Login
Signup
Forgot password
OTP verification
Dashboard
Video/job processing
My Clips
Billing
Credits
Subscription
Video player
Video controls
Captions
Caption styling
Transcript
AI highlight detection
Clip generation
Processing pipeline
Video metadata
User/account
Theme
API/query infrastructure

Preserve these capabilities.

DESIGN GOAL

Transform Blynta into a:

Premium AI video creation workspace.

It should feel like a serious professional SaaS product.

The experience should be inspired by the quality and usability of products such as:

Linear
Vercel
Descript
Riverside
OpusClip
Framer

DO NOT COPY THEIR DESIGNS.

Use them only as quality references.

Blynta must have its own visual identity.

DESIGN PERSONALITY

Blynta should feel:

Premium
Modern
Intelligent
Creative
Fast
Focused
Professional
Technical but approachable
Powerful but simple

Avoid making it look like:

an admin dashboard
a generic AI wrapper
a template dashboard
a crypto application
a gaming interface
an overly futuristic neon product
CURRENT UI PROBLEM

The current interface has several UX problems.

The dashboard feels:

too empty
overly dark/flat
overly dependent on bordered cards
weak in visual hierarchy
too much like a marketing landing page
not focused enough on the creation workflow
visually repetitive
inconsistent in spacing/density
not distinctive enough as a video creation product

DO NOT solve this by simply:

changing colors
increasing border radius
adding gradients
adding shadows
adding more cards
making everything bigger

Instead rethink the information architecture.

CORE UX PRINCIPLE

Every page should have ONE obvious primary action.

Examples:

Dashboard:
→ Create Clips

My Clips:
→ Open / Edit Clip

Job:
→ Review / Edit Generated Clips

Billing:
→ Manage Plan / Upgrade

Settings:
→ Save Changes

Do not make 5–10 buttons compete for attention.

GLOBAL DESIGN SYSTEM

Create a consistent visual system using the existing global.css tokens.

Use:

existing fonts
existing CSS variables
existing theme
existing dark/light infrastructure

If improvements are needed, make them centrally.

COLOR SYSTEM

Do NOT invent a completely new palette without inspecting global.css.

The existing theme is the foundation.

Use:

background
foreground
card
muted
muted-foreground
primary
primary-foreground
secondary
border
destructive

and any other existing semantic tokens.

The accent color should be used intentionally.

Do not turn every active element bright blue.

Use hierarchy:

Primary action → strongest emphasis

Secondary action → subtle

Tertiary action → minimal

DARK MODE

Blynta is a dark-first product.

However:

DO NOT use pure black for everything.

Use layered surfaces from the existing theme.

For example conceptually:

Background
↓
Surface
↓
Elevated Surface
↓
Interactive Surface

Use subtle borders and contrast.

Avoid excessive glow.

Avoid excessive gradients.

TYPOGRAPHY

Use the font system already configured by the project.

DO NOT import another font just because it looks good.

Typography should have clear hierarchy.

Example:

Page heading:
32–40px

Section heading:
20–24px

Card heading:
15–18px

Body:
14–15px

Metadata:
12–13px

Do not make everything oversized.

Professional creative applications need information density.

SPACING

Use a consistent spacing scale.

Prefer:

4
8
12
16
20
24
32
40
48
64

Avoid arbitrary spacing values everywhere.

BORDER RADIUS

Use restrained rounding.

Do NOT make every element a giant pill.

Use:

small radius for controls
medium radius for cards
larger radius only for major surfaces
SHADOWS

Use shadows sparingly.

Prioritize:

spacing
contrast
borders
surface elevation

rather than large shadows.

ICONS

Use one icon system.

Prefer the existing Lucide/shadcn icon approach if already installed.

Do not mix:

random SVG icons
emoji
multiple icon libraries
inconsistent icon styles

Icons should have consistent:

stroke width
size
alignment
APPLICATION SHELL

Redesign the entire application shell.

The shell should include:

Sidebar
Top navigation
Main content
responsive mobile navigation

But determine the exact layout based on UX.

Do not blindly preserve the current layout.

SIDEBAR

Redesign the sidebar from scratch.

It should feel like a professional creative workspace.

Potential organization:

WORKSPACE

Home
My Clips
Projects / Jobs
Assets

PUBLISH

Calendar
Social Accounts

ACCOUNT

Billing
Settings

IMPORTANT:

Only include routes/features that actually exist.

Do not create fake functionality.

Use grouped navigation.

The active route should be obvious without looking like a huge bright blue rectangle.

Prefer:

subtle active surface
accent indicator
appropriate icon
strong text
SIDEBAR RESPONSIVENESS

Desktop:

approximately 220–260px
clean navigation
workspace identity
user/account area

Collapsed:

icon navigation
tooltips
no broken labels

Mobile:

use shadcn Sheet
sidebar becomes a drawer
accessible menu trigger
no horizontal overflow
TOP BAR

Redesign the top bar.

It should contain useful information only.

Possible items:

current page
breadcrumb
credits
notifications
theme toggle
user menu

Do not overload the header.

CREDITS

Credits are a core product concept.

Make the credit indicator feel intentional.

Example:

⚡ 35 Credits

Clicking it could reveal:

Current credits
Usage
Plan
Upgrade

Use a shadcn Popover/DropdownMenu if appropriate.

Do not make credits look like a random badge.

USER MENU

Use shadcn DropdownMenu.

Show:

Avatar
Name
Plan

Menu:

Account
Settings
Billing
Theme
Logout

Only include real actions.

HOME / DASHBOARD

This is one of the most important redesigns.

The current dashboard behaves too much like a marketing landing page.

This is an APPLICATION.

The primary goal is:

Help the user create clips immediately.

NEW DASHBOARD UX

The first screen should communicate:

What can I do?

→ Create clips.

A possible structure:

Greeting / Context

Good afternoon, Shavaiz

Turn your long-form content into short-form clips.

CREATE WORKSPACE

Paste a video URL

[ 🔗 Paste YouTube, Vimeo, podcast URL... ]

                   [ Generate Clips ]

OR

[ Upload Video ]

OPTIONS

Highlight style

[ Simple ] [ Funny ] [ Emotional ] [ Motivational ]

RECENT PROJECTS

Recent videos

[ Project ] [ Project ] [ Project ]

This is only a UX direction.

Use your own professional judgment to create the best layout.

CREATE AREA

The creation input should become the hero of the actual application.

It should feel like:

"Start creating"

not:

"Marketing headline."

Design it as a polished workspace.

Possible states:

EMPTY

Paste URL
Upload Video

READY

Video thumbnail
Title
Duration
Source
Generate Clips

PROCESSING

Analyzing
Transcribing
Finding highlights
Generating clips

COMPLETED

6 clips generated
View Clips

ERROR

Processing failed
Retry

Use real application states.

Do not invent backend data.

RECENT PROJECTS

Redesign project cards.

Each card should clearly communicate:

thumbnail
title
source
duration
status
created date
number of clips
available actions

The thumbnail should be the primary visual anchor.

Support:

Grid
List

Use shadcn controls where appropriate.

MY CLIPS

Redesign My Clips into a professional content library.

Header:

My Clips

[ Search ] [ Filter ] [ Sort ]

Content:

Video/clip cards.

Each item should show:

preview
title
duration
status
source
date
actions

Use shadcn:

Input
DropdownMenu
Select
Tabs
Badge
Dialog
etc.

where appropriate.

JOB / VIDEO DETAIL

The existing project already has video/editor-related components.

Inspect and preserve functionality such as:

StudioVideoPlayer
PlayerControls
PlayerOverlay
PlayerScrubber
PlayerTopBar
PipelineStepper
CaptionStylingCard
TranscriptDialog
ScoreGauge
VideoMetadataKit
StudioLeftPanel
StudioCenterPanel
StudioRightPanel

Do NOT throw away working functionality simply because the UI is being redesigned.

Reorganize the UX around a professional video workspace.

VIDEO STUDIO

The video editor should feel like a creative production environment.

Conceptually:

┌─────────────────────────────────────────────┐
│ Project Name Status │
├──────────────┬──────────────────────────────┤
│ Clips / │ │
│ Highlights │ VIDEO PLAYER │
│ │ │
│ │ │
├──────────────┴──────────────────────────────┤
│ Timeline / Transcript / Captions │
├─────────────────────────────────────────────┤
│ Contextual settings │
└─────────────────────────────────────────────┘

Do not copy this literally.

Use it as UX guidance.

The video should be the visual focus.

VIDEO PLAYER

Redesign the player using the existing functionality.

Controls should include only what actually exists.

Potential:

play/pause
timeline
duration
volume
fullscreen
settings

Use a professional control hierarchy.

Do not make controls visually heavier than the video.

PROCESSING UI

Do NOT use a generic loading spinner as the primary processing experience.

Blynta's AI processing is a core product experience.

Show meaningful stages.

Example:

Analyzing video

✓ Downloading
✓ Transcribing
● Finding highlights
○ Generating clips
○ Applying captions

Use actual backend state whenever available.

DO NOT invent fake progress percentages.

GENERATED CLIPS

Generated clips should feel like the reward of the workflow.

Each clip should communicate:

preview
title
duration
score if available
status
relevant metadata
actions

If AI metadata exists, make it visually meaningful.

Do not fabricate:

scores
labels
analytics
AI insights
BILLING

Redesign billing using the same design system.

Show clearly:

Current plan
Credits
Usage
Renewal
Upgrade

Use shadcn components.

Do not make the page look like a generic pricing website.

The user should immediately understand:

"What do I have?"

"What am I using?"

"What happens if I upgrade?"

AUTHENTICATION

Redesign:

Login
Signup
Forgot password
OTP verification

Keep authentication logic unchanged.

Improve:

visual hierarchy
form spacing
validation states
error messages
loading states
responsiveness

Use shadcn:

Input
Button
Label
Dialog
Separator
etc.

where appropriate.

Do not overdesign authentication.

RESPONSIVE DESIGN

This is a real responsive redesign.

Do not simply hide things at breakpoints.

Design for:

375px
390px
768px
1024px
1280px
1440px
1920px

Mobile should have its own UX decisions.

Pay particular attention to:

video player
clip cards
dashboard create flow
sidebar
dialogs
dropdowns
forms
tables
navigation

No:

horizontal overflow
clipped controls
tiny buttons
broken layouts
unusable editor
ACCESSIBILITY

All redesigned components should support:

keyboard navigation
focus states
accessible labels
semantic HTML
aria attributes where required
sufficient contrast
disabled/loading states
accessible dialogs
accessible dropdowns

Do not use color alone to communicate state.

Use icons/text when appropriate.

LOADING STATES

Every data-driven page needs proper loading states.

Use shadcn Skeleton where appropriate.

Examples:

Dashboard skeleton
Project card skeleton
Clip skeleton
Billing skeleton
Job detail skeleton

Do not display large spinners for entire pages unless necessary.

ERROR STATES

Every important page/action needs a useful error state.

Example:

Unable to load projects.

[ Try again ]

Do not expose raw backend errors directly to users.

EMPTY STATES

Create polished empty states.

Examples:

No projects yet

No clips yet

No assets

No scheduled posts

No results

Each should contain:

icon
short explanation
primary action

Keep them compact.

TOASTS / FEEDBACK

Use the existing shadcn-compatible toast system / Sonner if already configured.

Use it for:

successful actions
failed actions
copy actions
saves
deletes
upgrades
etc.

Do not create custom toast systems.

DIALOGS / DRAWERS

Use shadcn:

Dialog
Sheet
AlertDialog
Popover

instead of creating custom implementations.

Dialogs should:

have proper titles
have clear actions
support keyboard escape
have correct focus management
BUTTON SYSTEM

Use shadcn Button.

Do not create multiple unrelated button components.

Use variants:

default
secondary
outline
ghost
destructive
etc.

Create custom variants only when genuinely necessary.

Avoid:

giant buttons
excessive pills
multiple primary buttons in one section
CARDS

Do not put everything inside cards.

This is extremely important.

The current UI relies too heavily on bordered containers.

Use cards only when they improve grouping.

Use:

whitespace
section hierarchy
dividers
surface changes

where a card is unnecessary.

TABLES

If a page needs structured tabular information:

Use shadcn Table.

Do not create a custom table unless required.

FORMS

Use shadcn form primitives where appropriate.

Maintain:

consistent labels
error messages
helper text
loading states
disabled states
keyboard behavior
COMPONENT ARCHITECTURE

The existing project contains many components under:

features/dashboard
features/jobs
features/auth
features/billing

Inspect them carefully.

Refactor them toward feature ownership.

The general architecture should be:

app/
routing
layouts
page composition

features/
business functionality

components/
shared UI/layout

lib/
infrastructure/utilities

providers/
application providers

types/
shared types

TARGET ARCHITECTURE

Use the following PRINCIPLE:

src/
├── app/
│ ├── (auth)/
│ ├── (main)/
│ ├── api/
│ ├── layout.tsx
│ └── globals.css
│
├── features/
│ ├── auth/
│ ├── dashboard/
│ ├── jobs/
│ ├── clips/
│ ├── editor/
│ ├── billing/
│ └── other-real-blynta-features/
│
├── components/
│ ├── ui/
│ ├── layout/
│ └── common/
│
├── lib/
├── providers/
├── types/
└── config/

IMPORTANT:

This is a pattern.

Do NOT force every existing component into these exact folders if it doesn't make sense.

The actual application domain determines the final structure.

ROUTING RULE

app/ should primarily contain:

routes
layouts
loading states
error states
page composition

Business functionality should live in features/.

Avoid putting complex business logic directly inside:

app/**/page.tsx

FEATURE RULE

A feature should own its:

components
hooks
API calls
query keys
types
feature-specific utilities

For example:

features/jobs/

components/
hooks/
api/
queryKeys.ts
types.ts

Do the same for actual Blynta domains.

SHARED COMPONENT RULE

Only put something inside:

components/

if it is genuinely shared across multiple features.

Examples:

components/ui/
→ shadcn primitives

components/layout/
→ Sidebar
→ TopBar
→ AppShell

components/common/
→ shared reusable business-agnostic components

Do not put feature-specific components here.

DO NOT OVER-ENGINEER

This is extremely important.

Do not create:

unnecessary abstractions
excessive hooks
excessive wrapper components
meaningless index.ts files
generic components used only once
complicated state architecture
unnecessary design-system abstractions

Use senior-level engineering judgment.

The architecture should be:

Clean
Predictable
Maintainable
Simple

PRESERVE EXISTING LOGIC

Before moving a component:

Understand:

imports
API calls
hooks
query keys
props
state
server/client boundaries

Do not break functionality during refactoring.

If a component is moved, update imports correctly.

SERVER / CLIENT COMPONENTS

Respect Next.js App Router architecture.

Do not turn everything into:

"use client"

just to make implementation easier.

Keep components server-side when possible.

Only use client components where interaction/state/browser APIs require them.

DATA FETCHING

Preserve the current React Query architecture if already working.

Do not replace it with another data fetching library.

Keep:

query keys
mutations
caching
invalidation

organized by feature.

AUTHENTICATION

Do not rewrite authentication just for the redesign.

Inspect:

NextAuth
auth providers
middleware/proxy
session handling
authenticated API requests

Preserve all behavior.

PERFORMANCE

The redesign must not unnecessarily hurt performance.

Avoid:

giant client components
unnecessary re-renders
excessive JavaScript
unnecessary dependencies
loading entire pages as client components

Images should use the existing Next.js image strategy where appropriate.

VISUAL CONSISTENCY

Every page must feel like the same product.

The following must be consistent:

typography
colors
spacing
borders
radius
buttons
inputs
dropdowns
dialogs
tabs
badges
icons
empty states
loading states
error states

Do not redesign each page independently.

Create one coherent product.

IMPORTANT: DO NOT MAKE RANDOM DESIGN CHANGES

Do not:

randomly change colors
randomly add gradients
randomly change fonts
randomly add animations
randomly add cards
randomly add shadows
randomly add illustrations
randomly change copy

Every design decision should have a UX reason.

ANIMATION

Use subtle animation where it improves usability.

Examples:

sidebar transitions
dialog transitions
dropdown transitions
loading states
clip generation feedback
hover states

Avoid excessive animation.

Do not make the application feel like a marketing website.

MICROINTERACTIONS

Add useful microinteractions:

button hover
active navigation
copy confirmation
save confirmation
processing transitions
upload feedback
selected states

Keep them subtle.

DESIGN FOR REAL CONTENT

Do not only design for perfect dummy content.

Consider:

very long titles
missing thumbnails
failed videos
long durations
many clips
no clips
hundreds of projects
different statuses
slow API responses

The UI must remain usable.

DATA SAFETY

Do not invent data.

If existing APIs return:

6 clips

show 6.

If they return:

35 credits

show 35.

If a field doesn't exist:

do not fabricate it.

BEFORE CODING

Perform this sequence:

STEP 1
Inspect entire frontend structure.

STEP 2
Read:

app/globals.css
app/layout.tsx
providers
theme configuration
components.json

STEP 3
Understand the existing shadcn setup.

STEP 4
Check which shadcn components are installed.

STEP 5
Identify missing shadcn components required by the redesign.

STEP 6
Install/add missing shadcn components.

STEP 7
Map the actual application domains.

STEP 8
Create a redesign plan.

STEP 9
Refactor architecture where necessary.

STEP 10
Implement the new design.

STEP 11
Test every route.

STEP 12
Fix responsive issues.

STEP 13
Fix TypeScript errors.

STEP 14
Fix lint/build errors.

DO NOT MODIFY GLOBAL THEME UNNECESSARILY

Before changing global.css, determine what it currently provides.

If the existing theme is good enough:

KEEP IT.

If changes are needed:

make them centralized and semantic.

Do not spread theme values across individual components.

DO NOT MODIFY layout.tsx UNNECESSARILY

layout.tsx is foundational.

Preserve:

providers
metadata
fonts
theme
authentication context
query providers
global application configuration

Only modify it if the redesign genuinely requires it.

SHADCN INSTALLATION RULE

If a component is missing, use the project's shadcn CLI/configuration to add it.

Examples:

If missing:

Sheet
→ add Sheet

If missing:

Command
→ add Command

If missing:

Breadcrumb
→ add Breadcrumb

If missing:

Tabs
→ add Tabs

If missing:

Tooltip
→ add Tooltip

etc.

Do not manually recreate standard shadcn components.

VISUAL QUALITY BAR

The final result should NOT look like:

"developer redesigned a dashboard."

It should look like:

"professional product team designed an AI video creation platform."

Pay special attention to:

hierarchy
whitespace
information density
alignment
interaction states
visual rhythm
responsive behavior
consistency
MOST IMPORTANT UX QUESTION

At every page ask:

What is the user trying to accomplish here?

Then make that action obvious.

Do not design based on:

"What components can I put on this page?"

Design based on:

"What does the user need to accomplish?"

IMPLEMENTATION ORDER

Do not redesign everything randomly.

Use this order:

PHASE 1 — FOUNDATION

Inspect and establish:

global.css
layout.tsx
theme
typography
shadcn
spacing
surfaces
buttons
inputs
dialogs
navigation
PHASE 2 — APPLICATION SHELL

Redesign:

sidebar
top bar
mobile navigation
user menu
credits
global loading/error states
PHASE 3 — DASHBOARD

Redesign:

create workflow
recent projects
project cards
empty states
processing states
PHASE 4 — CLIPS

Redesign:

My Clips
filters
search
sorting
clip cards
clip actions
PHASE 5 — VIDEO/JOB WORKSPACE

Redesign:

video player
project header
processing state
generated clips
transcript
captions
settings
editor layout

Preserve existing functionality.

PHASE 6 — BILLING

Redesign:

current plan
credits
usage
plans
upgrade flow
PHASE 7 — AUTH

Redesign:

login
signup
forgot password
OTP
PHASE 8 — RESPONSIVE

Test:

375px
390px
768px
1024px
1280px
1440px
1920px

PHASE 9 — CLEANUP

Remove:

obsolete dashboard components
duplicate UI components
duplicate theme logic
unused imports
dead CSS
redundant styles
old layout code

ONLY remove code after confirming it is no longer used.

FINAL VALIDATION

Before declaring the redesign complete:

Run:

TypeScript check
ESLint
production build

Then verify:

authentication
dashboard
create workflow
jobs
clips
video player
processing states
billing
navigation
dialogs
dropdowns
mobile navigation
responsive layouts

No broken routes.

No broken imports.

No TypeScript errors.

No obvious console errors.

FINAL ARCHITECTURE CHECK

At the end, verify:

Theme

Everything follows:

global.css

and

layout.tsx

UI

Everything uses:

shadcn/ui

where an appropriate component exists.

Missing UI

Missing shadcn components were installed rather than unnecessarily recreated.

Features

Business functionality lives inside:

features/

Routes

Routing lives inside:

app/

Shared UI

Shared primitives live inside:

components/ui

Shared application layout lives inside:

components/layout

Logic

Infrastructure lives inside:

lib/

Providers

Application providers live inside:

providers/

ABSOLUTE DON'Ts

DO NOT:

❌ create an unrelated theme

❌ introduce a new font without reason

❌ bypass global.css

❌ bypass layout.tsx

❌ create a custom component when shadcn already provides it

❌ install another UI framework

❌ rewrite backend logic

❌ rewrite working API logic

❌ fabricate data

❌ create fake features

❌ copy the example folder structure literally

❌ make every element a card

❌ make every element a pill

❌ use excessive gradients

❌ use excessive glow

❌ use excessive animations

❌ create giant hero sections everywhere

❌ turn every component into "use client"

❌ create massive monolithic components

❌ over-engineer the architecture

❌ delete existing functionality because it is inconvenient

FINAL EXPECTATION

Do not think:

"I need to make the current dashboard prettier."

Think:

"I need to redesign Blynta as a complete professional AI video creation product."

The final product should have:

a coherent design system
excellent visual hierarchy
clear workflows
professional video workspace UX
strong responsive behavior
consistent shadcn components
clean feature-based architecture
centralized theme management
minimal visual clutter
excellent usability

Most importantly:

The UI should feel intentional.

Every spacing decision, component, button, surface, navigation item and interaction should have a reason.

Build it like a senior product designer and senior frontend engineer are working together.


### One thing I'd emphasize to the agent

Your uploaded project already has the main structure under `frontend/app`, `frontend/components`, and `frontend/features`, including the existing dashboard/jobs/auth/billing areas. :contentReference[oaicite:0]{index=0} :contentReference[oaicite:1]{index=1}

So I would **not** tell the agent to rebuild the whole frontend from zero. The better instruction is:

**audit → establish design system → redesign shell → redesign pages → move components into proper feature ownership → remove obsolete code → validate.**

That reduces the chance that the agent destroys working video/job functionality while chasing a new UI.

Also, the **shadcn requirement is now explicit**: if `Sheet`, `Tabs`, `Tooltip`, `Command`, `Breadcrumb`, etc. are missing, the agent should **add the official shadcn component and use it**, rather than inventing another custom implementation.