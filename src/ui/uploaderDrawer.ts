import { getIconSvg } from './icons';

export type UploadItemStatus = 'queued' | 'uploading' | 'paused' | 'completed' | 'error' | 'cancelled';

export interface UploadItem {
  id: string;
  name: string;
  sizeBytes: number;
  progress: number;
  targetProgress: number;
  status: UploadItemStatus;
  statusMessage?: string;
  animId?: number | null;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
}

export class UploaderDrawer {
  private containerEl: HTMLElement | null = null;
  private isMinimized = false;
  private items: Map<string, UploadItem> = new Map();

  constructor() {
    this.createDom();
  }

  private formatFileSize(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  private createDom(): void {
    if (document.getElementById('uploader-drawer')) {
      this.containerEl = document.getElementById('uploader-drawer');
      return;
    }

    const drawer = document.createElement('div');
    drawer.id = 'uploader-drawer';
    drawer.className = 'uploader-drawer glass-heavy';

    drawer.innerHTML = `
      <div class="uploader-drawer-header" id="uploader-drawer-header">
        <div class="uploader-header-title">
          <span class="uploader-header-icon">${getIconSvg('upload', 18)}</span>
          <span>Uploads</span>
          <span class="uploader-count-badge" id="uploader-count-badge">0</span>
        </div>
        <div class="uploader-header-actions">
          <button class="uploader-header-btn" id="uploader-toggle-btn" title="Minimize / Maximize">
            ${getIconSvg('chevron-down', 16)}
          </button>
          <button class="uploader-header-btn" id="uploader-close-btn" title="Close">
            ${getIconSvg('close', 16)}
          </button>
        </div>
      </div>
      <div class="uploader-body" id="uploader-items-list"></div>
    `;

    document.body.appendChild(drawer);
    this.containerEl = drawer;

    const closeBtn = drawer.querySelector('#uploader-close-btn') as HTMLElement;
    const header = drawer.querySelector('#uploader-drawer-header') as HTMLElement;

    header.addEventListener('click', (e) => {
      if (closeBtn.contains(e.target as Node)) return;
      this.toggleMinimize();
    });

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });
  }

  public show(): void {
    if (this.containerEl) {
      this.containerEl.style.display = 'flex';
    }
  }

  public hide(): void {
    if (this.containerEl) {
      this.containerEl.style.display = 'none';
    }
  }

  public toggleMinimize(): void {
    this.isMinimized = !this.isMinimized;
    if (this.containerEl) {
      if (this.isMinimized) {
        this.containerEl.classList.add('minimized');
      } else {
        this.containerEl.classList.remove('minimized');
      }
      const toggleBtn = this.containerEl.querySelector('#uploader-toggle-btn');
      if (toggleBtn) {
        toggleBtn.innerHTML = getIconSvg(this.isMinimized ? 'chevron-up' : 'chevron-down', 16);
      }
    }
  }

  public addItem(item: Partial<UploadItem> & { id: string; name: string; sizeBytes: number }): void {
    const fullItem: UploadItem = {
      id: item.id,
      name: item.name,
      sizeBytes: item.sizeBytes,
      progress: item.progress ?? 0,
      targetProgress: item.progress ?? 0,
      status: item.status ?? 'queued',
      statusMessage: item.statusMessage ?? (item.status === 'queued' ? 'In queue' : ''),
      animId: null,
      onPause: item.onPause,
      onResume: item.onResume,
      onCancel: item.onCancel,
      onRetry: item.onRetry,
    };

    this.items.set(fullItem.id, fullItem);
    this.show();
    this.render();
  }

  public updateProgress(id: string, progress: number, status?: UploadItemStatus, statusMessage?: string): void {
    const item = this.items.get(id);
    if (!item) return;

    if (status !== undefined) {
      item.status = status;
    }
    if (statusMessage !== undefined) {
      item.statusMessage = statusMessage;
    }

    const clamped = Math.min(100, Math.max(0, progress));
    // Never allow progress to regress backwards during active upload
    if (item.status === 'uploading' && clamped < item.progress && clamped !== 0) {
      // Retain forward climb
    } else {
      item.targetProgress = clamped;
    }

    // Start smooth ease-in climb animation
    this.animateItemProgress(item);
  }

  private animateItemProgress(item: UploadItem): void {
    if (item.animId) {
      cancelAnimationFrame(item.animId);
      item.animId = null;
    }

    const step = () => {
      const diff = item.targetProgress - item.progress;

      // Small difference -> snap to target and finish
      if (Math.abs(diff) < 0.2) {
        item.progress = item.targetProgress;
        item.animId = null;
        this.updateItemDom(item);
        this.updateCountBadge();
        return;
      }

      // Smooth climb: step proportional to difference (12% per frame)
      // Jumps like 29% -> 56% smoothly climb over ~15-20 frames
      const delta = Math.max(0.2, Math.abs(diff) * 0.12);
      item.progress += diff > 0 ? delta : -delta;

      this.updateItemDom(item);
      item.animId = requestAnimationFrame(step);
    };

    item.animId = requestAnimationFrame(step);
  }

  private updateItemDom(item: UploadItem): void {
    const itemEl = this.containerEl?.querySelector(`[data-upload-id="${item.id}"]`);
    if (!itemEl) {
      this.render();
      return;
    }

    const fillEl = itemEl.querySelector('.sleek-progress-fill') as HTMLElement | null;
    const sizeEl = itemEl.querySelector('.uploader-item-size') as HTMLElement | null;
    const actionsEl = itemEl.querySelector('.uploader-item-actions') as HTMLElement | null;

    if (fillEl) {
      fillEl.style.width = `${item.progress}%`;
      if (item.status === 'completed') {
        fillEl.classList.add('completed');
      } else {
        fillEl.classList.remove('completed');
      }
    }

    if (sizeEl) {
      let subtext = '';
      if (item.status === 'completed') {
        subtext = `${this.formatFileSize(item.sizeBytes)} • Complete`;
      } else if (item.status === 'queued') {
        subtext = `${this.formatFileSize(item.sizeBytes)} • In queue`;
      } else if (item.status === 'paused') {
        subtext = `${this.formatFileSize(item.sizeBytes)} • Paused`;
      } else if (item.status === 'error') {
        subtext = `${this.formatFileSize(item.sizeBytes)} • ${item.statusMessage || 'Error'}`;
      } else {
        subtext = `${this.formatFileSize(item.sizeBytes)} • ${Math.round(item.progress)}%`;
      }
      sizeEl.innerText = subtext;
    }

    if (actionsEl) {
      actionsEl.innerHTML = this.getActionsHtml(item);
      this.attachItemEventListeners(itemEl as HTMLElement, item);
    }
  }

  private getActionsHtml(item: UploadItem): string {
    if (item.status === 'completed') {
      return `<span class="uploader-status-icon-complete" title="Complete">${getIconSvg('check-circle', 18)}</span>`;
    }
    if (item.status === 'queued') {
      return `
        <span class="uploader-status-icon-queued" title="In queue">${getIconSvg('clock', 15)}</span>
        <button class="uploader-action-btn btn-cancel" title="Remove from queue">${getIconSvg('close', 12)}</button>
      `;
    }
    if (item.status === 'uploading') {
      return `
        <button class="uploader-action-btn btn-pause" title="Pause">${getIconSvg('pause', 12)}</button>
        <button class="uploader-action-btn btn-cancel" title="Cancel">${getIconSvg('close', 12)}</button>
      `;
    }
    if (item.status === 'paused') {
      return `
        <button class="uploader-action-btn btn-resume" title="Resume">${getIconSvg('play', 12)}</button>
        <button class="uploader-action-btn btn-cancel" title="Cancel">${getIconSvg('close', 12)}</button>
      `;
    }
    if (item.status === 'error') {
      return `
        <button class="uploader-action-btn btn-retry" title="Retry">${getIconSvg('refresh', 12)}</button>
        <button class="uploader-action-btn btn-cancel" title="Dismiss">${getIconSvg('close', 12)}</button>
      `;
    }
    return '';
  }

  public removeItem(id: string): void {
    const item = this.items.get(id);
    if (item?.animId) {
      cancelAnimationFrame(item.animId);
    }
    this.items.delete(id);
    this.render();
    if (this.items.size === 0) {
      this.hide();
    }
  }

  public clear(): void {
    this.items.forEach((item) => {
      if (item.animId) cancelAnimationFrame(item.animId);
    });
    this.items.clear();
    this.render();
    this.hide();
  }

  private updateCountBadge(): void {
    const badge = this.containerEl?.querySelector('#uploader-count-badge');
    if (badge) {
      const active = Array.from(this.items.values()).filter((i) => i.status === 'uploading' || i.status === 'queued').length;
      badge.textContent = active > 0 ? `${active}` : `${this.items.size}`;
    }
  }

  public render(): void {
    const listEl = this.containerEl?.querySelector('#uploader-items-list');
    if (!listEl) return;

    this.updateCountBadge();
    listEl.innerHTML = '';

    this.items.forEach((item) => {
      const itemEl = document.createElement('div');
      itemEl.className = `uploader-item status-${item.status}`;
      itemEl.setAttribute('data-upload-id', item.id);

      let subtext = '';
      if (item.status === 'completed') {
        subtext = `${this.formatFileSize(item.sizeBytes)} • Complete`;
      } else if (item.status === 'queued') {
        subtext = `${this.formatFileSize(item.sizeBytes)} • In queue`;
      } else if (item.status === 'paused') {
        subtext = `${this.formatFileSize(item.sizeBytes)} • Paused`;
      } else if (item.status === 'error') {
        subtext = `${this.formatFileSize(item.sizeBytes)} • ${item.statusMessage || 'Error'}`;
      } else {
        subtext = `${this.formatFileSize(item.sizeBytes)} • ${Math.round(item.progress)}%`;
      }

      itemEl.innerHTML = `
        <div class="uploader-item-header">
          <div class="uploader-item-info">
            <div class="uploader-item-name" title="${item.name}">${item.name}</div>
            <div class="uploader-item-size">${subtext}</div>
          </div>
          <div class="uploader-item-actions">${this.getActionsHtml(item)}</div>
        </div>
        <div class="sleek-progress-container">
          <div class="sleek-progress-fill ${item.status === 'completed' ? 'completed' : ''}" style="width: ${item.progress}%;"></div>
        </div>
      `;

      this.attachItemEventListeners(itemEl, item);
      listEl.appendChild(itemEl);
    });
  }

  private attachItemEventListeners(itemEl: HTMLElement, item: UploadItem): void {
    const pauseBtn = itemEl.querySelector('.btn-pause');
    const resumeBtn = itemEl.querySelector('.btn-resume');
    const cancelBtn = itemEl.querySelector('.btn-cancel');
    const retryBtn = itemEl.querySelector('.btn-retry');

    pauseBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      item.status = 'paused';
      item.onPause?.();
      this.render();
    });

    resumeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      item.status = 'uploading';
      item.onResume?.();
      this.render();
    });

    cancelBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      item.status = 'cancelled';
      item.onCancel?.();
      this.removeItem(item.id);
    });

    retryBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      item.status = 'uploading';
      item.onRetry?.();
      this.render();
    });
  }
}

export const uploaderDrawer = new UploaderDrawer();
