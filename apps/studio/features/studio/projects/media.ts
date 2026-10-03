import type { Asset } from "../types";
import { studioApi, studioRequest } from '../api';
export async function uploadMedia(projectId: string, file: File): Promise<Asset> {
  const fallback: Record<string, string> = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
  const mimeType = fallback[file.name.split('.').pop()?.toLowerCase() || ''] || file.type;
  const upload = await studioRequest<{ assetId: string; uploadUrl: string }>(`projects/${projectId}/assets/upload`, 'POST', { name: file.name, mimeType, size: file.size });
  const response = await fetch(upload.uploadUrl, { method: 'PUT', headers: { 'Content-Type': mimeType }, body: file });
  if (!response.ok) throw new Error('Media upload failed. Check your connection and try again.');
  await studioRequest(`projects/${projectId}/assets/complete`, 'POST', { assetId: upload.assetId });
  for (let i = 0; i < 90; i++) {
    const assets = await studioApi.assets(projectId);
    const asset = assets.find((a) => a.id === upload.assetId);
    if (asset?.status === 'ready') return asset;
    if (asset?.status === 'failed') throw new Error(asset.error || 'Media processing failed');
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('Media is still processing. Reopen Media to check its status.');
}
