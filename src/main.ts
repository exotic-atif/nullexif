import './styles/main.css';
import { elements } from './ui/dom';
import { themeManager } from './ui/themeManager';
import { previewManager } from './ui/previewManager';
import { modalManager } from './ui/modalManager';
import { formRenderer } from './ui/formRenderer';
import { uploaderDrawer } from './ui/uploaderDrawer';
import { getIconSvg } from './ui/icons';
import {
  uploadImages,
  proceedProcessing,
  fetchPresets,
  clearUploads,
  checkGoogleStatus,
  fetchGoogleLoginUrl,
  logoutGoogle,
  uploadFileResumable,
} from './services/api';
import { parseClientExif } from './services/clientExif';
import { UploadSuccessFile, UploadSuccessResponse } from './types';

class NullExifApp {
  private session = {
    targets: [] as UploadSuccessFile[],
    source: null as UploadSuccessResponse | null,
  };

  private googleAuthenticated = false;
  private userEmail: string | null = null;
  private processedOutputs: Array<{ path: string; filename: string; size?: number }> = [];
  private presetsCache: Record<string, Record<string, string>> = {};

  public async init(): Promise<void> {
    // 1. Initialize Theme (Dark/Light/Auto)
    themeManager.init(elements.themeToggleBtn);

    // 2. Setup Listeners
    this.setupEventListeners();
    this.setupDragAndDrop();
    this.setupOAuthListener();

    // 3. Load Presets & Auth state
    await Promise.all([
      this.loadPresets(),
      this.refreshGoogleStatus(),
    ]);
  }

  private setupEventListeners(): void {
    // Target & Source inputs
    elements.targetInput.addEventListener('change', (e) => this.handleTargetFileInput(e));
    elements.sourceInput.addEventListener('change', (e) => this.handleSourceFileInput(e));

    // Proceed button
    elements.finalProceedBtn.addEventListener('click', () => this.handleProceedClick());

    // Conflict modal buttons
    elements.modalConfirm.addEventListener('click', () => {
      modalManager.hideConflict();
      const sourceExt = this.session.source?.extension || null;
      this.startProcessing(sourceExt);
    });

    elements.modalCancel.addEventListener('click', () => {
      modalManager.hideConflict();
    });

    // Close download notification
    elements.closeDownloadBtn.addEventListener('click', () => {
      modalManager.hideDownloadResult();
    });

    // Clear uploads
    elements.clearUploadsBtn.addEventListener('click', () => this.handleClearUploads());

    // Google Auth buttons
    elements.googleLoginBtn.addEventListener('click', () => this.handleGoogleLogin());
    elements.googleUploadBtn.addEventListener('click', () => this.handleGoogleUpload());
    elements.googleLogoutBtn.addEventListener('click', () => this.handleGoogleLogout());
  }

  private setupDragAndDrop(): void {
    const zones = [
      { el: elements.targetDropZone, type: 'target' as const },
      { el: elements.sourceDropZone, type: 'source' as const },
    ];

    for (const { el, type } of zones) {
      ['dragenter', 'dragover'].forEach((eventName) => {
        el.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          el.classList.add('drag-over');
        });
      });

      ['dragleave', 'drop'].forEach((eventName) => {
        el.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          el.classList.remove('drag-over');
        });
      });

      el.addEventListener('drop', (e: DragEvent) => {
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
          if (fileArray.length > 0) {
            if (type === 'target') {
              this.processTargetFiles(fileArray);
            } else {
              this.processSourceFile(fileArray[0]);
            }
          }
        }
      });
    }
  }

  private setupOAuthListener(): void {
    window.addEventListener('message', async (event) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        await this.refreshGoogleStatus();
      } else if (event.data?.type === 'GOOGLE_AUTH_FAILED') {
        alert(`Google sign-in failed: ${event.data.error || 'Unknown error'}`);
        await this.refreshGoogleStatus();
      }
    });
  }

  private handleTargetFileInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processTargetFiles(Array.from(input.files));
    }
  }

  private handleSourceFileInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.processSourceFile(file);
    }
  }

  /**
   * Ultra-fast Target processing with zero-lag UI feedback and WhatsApp-style multi-image grid.
   */
  private async processTargetFiles(files: File[]): Promise<void> {
    // 1. Instant WhatsApp-style multi-image preview
    previewManager.setTargetPreviews(files);

    // 2. Zero-lag instant transition: reveal editor immediately without waiting for promises
    elements.editorPanel.style.display = 'block';
    elements.actionBar.style.display = 'flex';
    elements.targetStatus.innerHTML = `${getIconSvg('clock', 14)} Parsing...`;

    // 3. Sub-millisecond client-side EXIF extraction on primary file
    const primaryFile = files[0];
    parseClientExif(primaryFile).then((clientMeta) => {
      if (Object.keys(clientMeta).length > 0) {
        formRenderer.render(clientMeta);
        const countLabel = files.length > 1 ? `${files.length} Photos` : primaryFile.name.split('.').pop()?.toUpperCase() || 'IMAGE';
        elements.targetStatus.innerHTML = `${getIconSvg('check-circle', 14)} Target: ${countLabel}`;
      }
    }).catch((err) => {
      console.debug('Client-side fast parse skipped:', err);
    });

    // 4. Server-side upload sync
    try {
      const result = await uploadImages(files, 'target');
      if (result.success) {
        if (result.files && result.files.length > 0) {
          this.session.targets = result.files;
        } else {
          this.session.targets = [{
            success: true,
            path: result.path,
            metadata: result.metadata,
            filename: result.filename,
            extension: result.extension,
            size: result.size,
          }];
        }

        const countText = this.session.targets.length > 1
          ? `${this.session.targets.length} Photos`
          : this.session.targets[0].extension.toUpperCase();

        elements.targetStatus.innerHTML = `${getIconSvg('check-circle', 14)} Target: ${countText}`;

        // Render full server metadata if client didn't render
        if (result.metadata && Object.keys(result.metadata).length > 0) {
          formRenderer.render(result.metadata);
        }
      } else {
        alert(`Upload error: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Target upload failed:', err);
      alert('Upload failed. Please verify server connection.');
    }
  }

  private async processSourceFile(file: File): Promise<void> {
    previewManager.setSourcePreview(file);

    // Pre-fill fields from client-side parse immediately
    parseClientExif(file).then((clientMeta) => {
      if (Object.keys(clientMeta).length > 0) {
        formRenderer.updateFields(clientMeta, true);
      }
    }).catch(() => {});

    try {
      const result = await uploadImages([file], 'source');
      if (result.success) {
        this.session.source = result;
        if (result.metadata) {
          formRenderer.updateFields(result.metadata, true);
        }
      }
    } catch (err) {
      console.error('Source upload failed:', err);
    }
  }

  private handleProceedClick(): void {
    if (this.session.targets.length === 0) return;

    const firstTargetExt = this.session.targets[0].extension;
    const sourceExt = this.session.source ? this.session.source.extension : null;

    if (sourceExt && firstTargetExt !== sourceExt) {
      if (elements.autoConvertCheck.checked) {
        this.startProcessing(sourceExt);
      } else {
        modalManager.showConflict(firstTargetExt, sourceExt);
      }
    } else {
      this.startProcessing();
    }
  }

  private async startProcessing(convertTo: string | null = null): Promise<void> {
    if (this.session.targets.length === 0) return;

    modalManager.setProcessingState(true);
    const targetPaths = this.session.targets.map((t) => t.path);

    try {
      const meta = formRenderer.getFormMetadata();
      const result = await proceedProcessing(targetPaths, meta, convertTo);

      if (result.success) {
        this.processedOutputs = result.outputs || [{ path: result.output, filename: result.output.split('/').pop() || 'processed.jpg' }];
        modalManager.showDownloadResult(this.processedOutputs[0].path);

        // Reset Google upload UI
        elements.uploadStatusText.innerText = 'Add to Google Photos';
        elements.googleUploadBtn.disabled = false;
        elements.googleUploadBtn.style.background = '';
      } else {
        alert(`Error: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Processing failed:', err);
      alert('Request Failed. Please try again.');
    } finally {
      modalManager.setProcessingState(false);
    }
  }

  /**
   * Resumable Google Photos Upload with real-time pill progress bars in the floating uploader drawer.
   */
  private async handleGoogleUpload(): Promise<void> {
    if (this.processedOutputs.length === 0) return;

    await this.refreshGoogleStatus();
    if (!this.googleAuthenticated) {
      alert('Please sign in to Google first.');
      return;
    }

    // Immediately close the download modal when starting the upload to photos
    modalManager.hideDownloadResult();

    const uploadBtn = elements.googleUploadBtn;
    const statusText = elements.uploadStatusText;
    uploadBtn.disabled = true;
    statusText.innerText = 'Uploading...';

    // Show floating uploader drawer
    uploaderDrawer.show();

    // Prepare queue handles and items upfront so user sees others as "In queue"
    const queueEntries = this.processedOutputs.map((item, i) => {
      const uploadId = `upload_${Date.now()}_${i}`;
      let cancelHandle: (() => void) | null = null;
      let pauseHandle: (() => void) | null = null;
      let resumeHandle: (() => void) | null = null;

      uploaderDrawer.addItem({
        id: uploadId,
        name: item.filename,
        sizeBytes: item.size || 2048000,
        progress: 0,
        status: i === 0 ? 'uploading' : 'queued',
        statusMessage: i === 0 ? '0%' : 'In queue',
        onPause: () => pauseHandle?.(),
        onResume: () => resumeHandle?.(),
        onCancel: () => cancelHandle?.(),
      });

      return {
        item,
        uploadId,
        setHandles: (cancel: () => void, pause: () => void, resume: () => void) => {
          cancelHandle = cancel;
          pauseHandle = pause;
          resumeHandle = resume;
        },
      };
    });

    for (let i = 0; i < queueEntries.length; i++) {
      const entry = queueEntries[i];
      const { item, uploadId } = entry;

      // Transition from queued to uploading
      uploaderDrawer.updateProgress(uploadId, 0, 'uploading', '0%');

      await new Promise<void>((resolve) => {
        const handle = uploadFileResumable(
          item.path,
          item.filename,
          (percent) => {
            uploaderDrawer.updateProgress(uploadId, percent, 'uploading', `${percent}%`);
          },
          (mediaResult) => {
            const firstItem = mediaResult?.newMediaItemResults?.[0];
            const isOk = !!firstItem && (!firstItem.status || !firstItem.status.code);
            if (isOk) {
              uploaderDrawer.updateProgress(uploadId, 100, 'completed', 'Complete');
            } else {
              uploaderDrawer.updateProgress(uploadId, 100, 'error', 'Error');
            }
            resolve();
          },
          (err) => {
            console.error('Resumable upload error:', err);
            uploaderDrawer.updateProgress(uploadId, 0, 'error', err.message || 'Failed');
            resolve();
          }
        );

        entry.setHandles(handle.abort, handle.pause, handle.resume);
      });
    }

    statusText.innerText = 'Upload complete!';
    uploadBtn.style.background = 'var(--color-nw-success)';
    uploadBtn.disabled = false;
  }

  private async refreshGoogleStatus(): Promise<void> {
    const status = await checkGoogleStatus();
    this.googleAuthenticated = status.authenticated;
    this.userEmail = status.email || null;

    modalManager.updateGoogleAuthUI(this.googleAuthenticated);

    // Update Logged in as <email> indicator
    if (this.googleAuthenticated && this.userEmail) {
      elements.authEmailBadge.style.display = 'inline-flex';
      elements.authEmailText.innerText = this.userEmail;
    } else if (this.googleAuthenticated) {
      elements.authEmailBadge.style.display = 'inline-flex';
      elements.authEmailText.innerText = 'Connected';
    } else {
      elements.authEmailBadge.style.display = 'none';
    }
  }

  private async handleGoogleLogin(): Promise<void> {
    try {
      const url = await fetchGoogleLoginUrl();
      if (url) {
        window.open(url, 'GoogleAuth', 'width=600,height=700');
      }
    } catch (err) {
      console.error('Google login failed:', err);
      alert('Failed to start Google login.');
    }
  }

  private async handleGoogleLogout(): Promise<void> {
    try {
      const success = await logoutGoogle();
      if (success) {
        this.googleAuthenticated = false;
        this.userEmail = null;
        modalManager.updateGoogleAuthUI(false);
        elements.authEmailBadge.style.display = 'none';
      }
    } catch (err) {
      console.error('Logout error:', err);
      alert('Logout failed.');
    }
  }

  private async loadPresets(): Promise<void> {
    try {
      this.presetsCache = await fetchPresets();
      const select = elements.presetSelect;
      select.innerHTML = '<option value="">Select Preset</option>';

      for (const name of Object.keys(this.presetsCache)) {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
      }

      select.addEventListener('change', () => {
        const chosen = this.presetsCache[select.value];
        if (chosen) {
          formRenderer.updateFields(chosen, true);
        }
      });
    } catch (err) {
      console.error('Failed to load presets:', err);
    }
  }

  private async handleClearUploads(): Promise<void> {
    if (!confirm('Delete all uploaded files?')) return;

    try {
      const res = await clearUploads();
      if (res.success) {
        previewManager.clearAll();
        elements.editorPanel.style.display = 'none';
        elements.actionBar.style.display = 'none';
        modalManager.hideDownloadResult();
        this.session.targets = [];
        this.session.source = null;
        elements.targetInput.value = '';
        elements.sourceInput.value = '';
        alert('Uploads folder cleared.');
      }
    } catch (err) {
      alert('Failed to clear uploads.');
    }
  }
}

// Bootstrap NullExif
document.addEventListener('DOMContentLoaded', () => {
  const app = new NullExifApp();
  app.init().catch(console.error);
});
