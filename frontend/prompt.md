FRONTEND PROMPT — Job detail page, paid-tier customization UI, and social accounts "Coming Soon"

CONTEXT:
- Next.js App Router, TanStack Query + axios client (config/axiosClient.ts, already handles auth token attachment — reuse, never call fetch() or handle auth headers manually).
- Existing query hooks live alongside useCurrentUser/useJobs/useCreateJob (check the exact file/folder — likely src/features/jobs/ and src/features/auth/ — read the existing hooks file before adding new ones, match its exact patterns for query keys, error unwrapping, etc.).
- Custom components AppButton, AppInput, AppDialog, DashboardLayout — reuse as-is, do not use raw shadcn directly.
- Theme CSS variables in globals.css — no new colors.
- Backend now has (from a previous task): Job schema includes transcript, highlights, clips[] (each with status, localFilePath, captionedFilePath, downloadUrl), customPrompt, aiModel fields on Job. A GET /jobs/:jobId/clips/:clipId/download endpoint exists for downloading a finished clip file, protected by ownership check.
- Plans: FREE, PRO, BUSINESS (from useCurrentUser().plan). Only PRO/BUSINESS users may set a customPrompt or choose aiModel when creating a job — FREE users always get the default prompt/model, with no UI to change it.

===========================================
TASK 1 — New query hooks
===========================================

Add these to the existing jobs query hooks file, following the EXACT pattern already used by useJobs()/useJob(id) if useJob already exists (check first) — if useJob(id) does not exist yet, create it following this shape:

// Example of the pattern to match — adjust to actual existing conventions found in the codebase:
export function useJob(jobId: string) {
  return useQuery({
    queryKey: ['jobs', jobId],
    queryFn: async () => {
      const { data } = await axiosClient.get(`/jobs/${jobId}`);
      return data.data as Job; // unwrap the { success, data } envelope — confirm this matches how other hooks in this file already unwrap it, use the SAME unwrapping approach, don't invent a second pattern
    },
    // IMPORTANT: this must poll while the job is still processing, since status changes server-side
    // without any user action. Example of conditional polling based on the last fetched data:
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      const activeStatuses = ['pending', 'transcribing', 'detecting_highlights', 'cutting_clips'];
      return status && activeStatuses.includes(status) ? 4000 : false; // poll every 4s while active, stop once completed/failed
    },
  });
}

export function useDownloadClip() {
  return useMutation({
    mutationFn: async ({ jobId, clipId }: { jobId: string; clipId: string }) => {
      const response = await axiosClient.get(`/jobs/${jobId}/clips/${clipId}/download`, {
        responseType: 'blob', // required for binary file downloads via axios
      });
      return response.data as Blob;
    },
  });
}

===========================================
TASK 2 — Job detail page: src/app/jobs/[id]/page.tsx (or match existing routing convention if different)
===========================================

Build this as a page inside DashboardLayout (same authenticated shell as the rest of the app). Structure, top to bottom:

1. HEADER: source URL (truncated, matching the truncateUrl utility already built in src/features/dashboard/utils.ts — reuse it, don't reimplement), platform badge, created date, overall status badge (reuse the existing STATUS_META styling pattern from the dashboard's JobsCard component if accessible/exported — check if it's exported already, export it if not rather than duplicating the status-color mapping a third time).

2. LIVE PROGRESS INDICATOR (only shown while job is in an active status — pending/transcribing/detecting_highlights/cutting_clips):
   Example of what this should look like — a simple horizontal stepper showing the 4 pipeline stages, with the current one highlighted/pulsing and completed ones checked off:

   [✓ Downloaded] → [● Transcribing...] → [ Detecting highlights] → [ Cutting clips]

   Implement this as a small standalone component (components/PipelineStepper.tsx or similar within the jobs feature folder) that takes the job's current status as a prop and derives which steps are done/active/pending from it. Example step-state logic:

   const STEPS = ['pending', 'transcribing', 'detecting_highlights', 'cutting_clips', 'completed'];
   function getStepState(stepName: string, currentStatus: string): 'done' | 'active' | 'pending' {
     const currentIndex = STEPS.indexOf(currentStatus);
     const stepIndex = STEPS.indexOf(stepName);
     if (currentStatus === 'failed') return stepIndex === 0 ? 'done' : 'pending'; // adjust based on errorStage if you want more precision — optional enhancement, not required
     if (stepIndex < currentIndex) return 'done';
     if (stepIndex === currentIndex) return 'active';
     return 'pending';
   }

3. FAILED STATE: if status === 'failed', show a clear error card with the job's errorMessage and errorStage (both already in the schema), and a "Try again" AppButton that calls useCreateJob() again with the same sourceUrl/sourcePlatform (a fresh job, not a retry of the same job record — confirm this matches backend behavior, i.e. there's no PATCH/retry endpoint, just create a new job).

4. COMPLETED STATE — clips grid: once status === 'completed', show a responsive grid (2-3 columns desktop, 1 column mobile) of clip cards, one per item in job.clips[]. Each card:
   - A video thumbnail/preview — since we don't have a separate thumbnail image, use an HTML5 <video> element with the clip's downloadUrl as the source and controls (or a poster frame if the backend provides one — check if it does, if not just use the video element directly with preload="metadata" so it shows a frame without loading the full file).
   - The clip's score (from job.highlights, matched by index/order to job.clips — verify how clips and highlights correlate in the actual schema/order before assuming a 1:1 index match, confirm with the backend response shape) shown as a simple "Top pick" badge if it's the highest-scoring clip, otherwise omit or show a subtle score indicator.
   - A "Download" AppButton that calls useDownloadClip() and triggers a browser download using the returned blob:

   const handleDownload = async () => {
     const blob = await downloadClipMutation.mutateAsync({ jobId, clipId: clip.id });
     const url = window.URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `blynta-clip-${clip.id}.mp4`;
     document.body.appendChild(a);
     a.click();
     a.remove();
     window.URL.revokeObjectURL(url);
   };

   Show a loading state (AppButton isLoading prop) while the download mutation is in flight.

5. TRANSCRIPT SECTION (collapsed by default, expandable): show the full job.transcript as a simple scrollable list of timestamped lines (e.g. "[00:45] some transcript text..."), behind a "View full transcript" toggle — this is secondary info, don't show it expanded by default since it can be long.

===========================================
TASK 3 — Paid-tier customization UI on job creation
===========================================

This modifies the hero input / job-creation flow already built on the dashboard. Add this ONLY for users where useCurrentUser().plan is 'pro' or 'business' — FREE plan users see no change to the existing simple input.

Add a collapsed "Advanced options" toggle/disclosure below the existing URL input, visible ONLY for PRO/BUSINESS users:

Example UI when expanded:
- A textarea (use AppInput if it supports multiline, otherwise build a minimal AppTextarea following the exact same prop pattern as AppInput — label, error, helperText — check if one already exists before creating a new one) labeled "Custom instructions (optional)" with placeholder text like: "e.g. Focus on moments with strong opinions or controversial statements" — this maps to the customPrompt field sent in the create-job request.
- A select/dropdown labeled "AI model" (use shadcn's Select primitive wrapped in a small custom component if one doesn't exist, following the project's established pattern of wrapping shadcn rather than using it raw) with options — example values, confirm actual allowed model strings against what the backend's allowlist validates (from the earlier backend task's aiModel allowlist check) rather than inventing option values that don't match:
  - "Standard (fast)" → value matching backend's default model
  - "Advanced (higher quality)" → value matching backend's premium model option
- BUSINESS plan only: if you want to differentiate Pro vs Business options further (e.g. Business gets an even higher-tier model choice), check with the backend's actual allowlist for what's plan-gated at which tier — do not invent a three-tier model list without confirming the backend actually supports/restricts it that way; if the backend only distinguishes free vs paid (not pro vs business specifically) for this field, keep the frontend UI matching that reality (same options for both Pro and Business) rather than showing options that don't work.

Update useCreateJob()'s mutation input type to optionally include customPrompt and aiModel, only actually sending them in the request body when the advanced section was used (omit the fields entirely rather than sending empty strings, so the backend's defaults apply cleanly when a user leaves advanced options untouched).

===========================================
TASK 4 — "Coming Soon" on social accounts / scheduling sidebar item
===========================================

Find the sidebar item(s) related to social account connections or scheduled posting (check DashboardLayout.tsx's nav item list — this may have been removed already in the Part A scope-creep revert from a previous task; if it's already gone, add it BACK specifically as a disabled "Coming Soon" item, not a functional link).

Implementation:
- Add a nav item (or restore the removed one) labeled "Social Accounts" or "Scheduling" with its icon, but:
  - Not clickable / no href navigation (or href="#" with an onClick preventDefault, your call on cleanest implementation)
  - Visually de-emphasized (lower opacity, e.g. opacity-50, or muted text color) compared to active nav items
  - A small "Soon" badge next to the label (a tiny pill, similar visual weight to a notification count badge if one exists elsewhere in the sidebar for reference)

Example:
<div className="flex items-center gap-3 px-3 py-2 rounded-lg opacity-50 cursor-not-allowed">
  <SocialIcon className="h-4 w-4" />
  <span className="text-sm">Social Accounts</span>
  <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
    Soon
  </span>
</div>

CONSTRAINTS:
- Do not modify DashboardLayout's core structure, header, or the already-fixed sidebar behavior — only add the one "Coming Soon" nav item.
- Do not touch billing/Stripe UI, auth pages, or the welcome dialog.
- Reuse truncateUrl, STATUS_META (or equivalent exported status styling), AppButton, AppInput, AppDialog exactly as they exist — export anything currently private that needs to be shared across files rather than duplicating logic.
- Confirm the clips-to-highlights correlation (Task 2, point 4) against actual backend response shape before assuming index-matching — ask if uncertain rather than guessing.
- Maintain responsiveness for the clips grid and job detail page down to ~375px.
- Run typecheck/build and confirm it passes.

At the end, give me:
1. List of all new/modified files.
2. Confirmation of how you handled the clips-to-highlights correlation (Task 2.4) — did the actual backend shape make this a clean 1:1 index match, or did you find something different?
3. Confirmation of exactly which aiModel option values you used and where you sourced them from (the backend's actual allowlist, not invented values).
4. Confirmation typecheck/build passes.