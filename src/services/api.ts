import {
  UploadResponse,
  ProceedResponse,
  PresetsMap,
  GoogleStatusResponse,
  GoogleLoginResponse,
  GoogleLogoutResponse,
  GooglePhotosUploadResult,
  ResumableSessionResponse,
} from '../types';

export async function uploadImages(files: File[], type: 'target' | 'source'): Promise<UploadResponse> {
  const formData = new FormData();
  if (files.length === 1) {
    formData.append('image', files[0]);
  } else {
    for (let i = 0; i < files.length; i++) {
      formData.append('images[]', files[i]);
    }
  }

  const res = await fetch(`process.php?action=upload_${type}`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Upload failed with status: ${res.status}`);
  }

  return (await res.json()) as UploadResponse;
}

export async function proceedProcessing(
  targetImages: string[],
  metadata: Record<string, string>,
  convertTo: string | null = null
): Promise<ProceedResponse> {
  const res = await fetch('process.php?action=proceed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target_images: targetImages,
      target_image: targetImages[0] || null,
      metadata,
      convert_to: convertTo,
    }),
  });

  if (!res.ok) {
    throw new Error(`Processing failed with status: ${res.status}`);
  }

  return (await res.json()) as ProceedResponse;
}

export async function fetchPresets(): Promise<PresetsMap> {
  try {
    const res = await fetch('process.php?action=get_presets');
    if (!res.ok) return {};
    return (await res.json()) as PresetsMap;
  } catch (err) {
    console.error('Failed to load presets:', err);
    return {};
  }
}

export async function clearUploads(): Promise<{ success: boolean; error?: string }> {
  const res = await fetch('process.php?action=clear_uploads');
  if (!res.ok) throw new Error('Clear uploads request failed');
  return (await res.json()) as { success: boolean; error?: string };
}

export async function checkGoogleStatus(): Promise<{ authenticated: boolean; email?: string | null }> {
  try {
    const res = await fetch('google_status.php');
    if (!res.ok) return { authenticated: false };
    const data = (await res.json()) as GoogleStatusResponse;
    return {
      authenticated: !!data.authenticated,
      email: data.email || null,
    };
  } catch (err) {
    console.error('Status check failed:', err);
    return { authenticated: false };
  }
}

export async function fetchGoogleLoginUrl(): Promise<string | null> {
  const res = await fetch('google_login.php');
  if (!res.ok) throw new Error('Failed to get Google login URL');
  const data = (await res.json()) as GoogleLoginResponse;
  return data.url || null;
}

export async function logoutGoogle(): Promise<boolean> {
  const res = await fetch('google_logout.php');
  if (!res.ok) throw new Error('Logout request failed');
  const data = (await res.json()) as GoogleLogoutResponse;
  return !!data.success;
}

export async function startResumableSession(filePath: string): Promise<ResumableSessionResponse> {
  const res = await fetch('upload_to_photos.php?action=start_resumable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath }),
  });

  if (!res.ok) throw new Error(`Resumable session initialization failed: ${res.status}`);
  return (await res.json()) as ResumableSessionResponse;
}

export async function createGoogleMediaItem(uploadToken: string, fileName?: string): Promise<GooglePhotosUploadResult> {
  const body: { upload_token: string; file_name?: string } = { upload_token: uploadToken };
  if (fileName) {
    body.file_name = fileName;
  }
  const res = await fetch('upload_to_photos.php?action=create_media_item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Creating media item failed: ${res.status}`);
  return (await res.json()) as GooglePhotosUploadResult;
}

/**
 * Uploads processed photo to Google Photos via the backend endpoint with smooth, monotonic progress.
 * Eliminates browser CORS rejection and avoids progress jumping to 100% and resetting.
 */
export function uploadFileResumable(
  filePath: string,
  fileName: string,
  onProgress: (percent: number) => void,
  onComplete: (result: GooglePhotosUploadResult) => void,
  onError: (err: Error) => void
): { abort: () => void; pause: () => void; resume: () => void } {
  const controller = new AbortController();
  let isPaused = false;
  let timer: number | null = null;
  let currentPct = 10;

  onProgress(currentPct);

  // Smooth, monotonic progress ticker while backend cURL transfer is in flight
  timer = window.setInterval(() => {
    if (isPaused) return;
    if (currentPct < 90) {
      const step = Math.max(1, Math.round((92 - currentPct) * 0.12));
      currentPct += step;
      onProgress(currentPct);
    }
  }, 160);

  const run = async () => {
    try {
      const res = await fetch('upload_to_photos.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, file_name: fileName }),
        signal: controller.signal,
      });

      if (timer) {
        clearInterval(timer);
        timer = null;
      }

      if (!res.ok) {
        throw new Error(`Upload failed with HTTP status ${res.status}`);
      }

      const result = (await res.json()) as GooglePhotosUploadResult;
      if (result.error) {
        throw new Error(result.error);
      }

      onProgress(100);
      onComplete(result);
    } catch (err: any) {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (err.name === 'AbortError') return;
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  run();

  return {
    abort: () => {
      if (timer) clearInterval(timer);
      controller.abort();
    },
    pause: () => {
      isPaused = true;
    },
    resume: () => {
      isPaused = false;
    },
  };
}
