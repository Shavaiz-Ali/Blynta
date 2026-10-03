"use client";
import { useState } from 'react';
import { AppButton } from '@blynta/ui';
import { Film } from 'lucide-react';
import { toast } from 'sonner';
import { axiosClient } from '@/config/axiosClient';
export function EditInStudioButton({ jobId, clipId }: { jobId: string; clipId: string }) {
  const [busy, setBusy] = useState(false);
  return <AppButton size="sm" variant="outline" isLoading={busy} onClick={async () => {
    setBusy(true);
    try {
      const { data: project } = await axiosClient.post<{ id: string }>('/studio/from-clip', { jobId, clipId });
      const base = process.env.NEXT_PUBLIC_STUDIO_URL || (process.env.NODE_ENV === 'production' ? 'https://studio.blynta.com' : 'http://localhost:3002');
      window.location.assign(new URL(`/editor/${project.id}`, base).href);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to open Studio'); }
    finally { setBusy(false); }
  }}><Film />Edit in Studio</AppButton>;
}
