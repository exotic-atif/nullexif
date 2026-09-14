import { elements } from './dom';
import { getIconSvg } from './icons';

function isHeicFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.heic') ||
    name.endsWith('.heif') ||
    file.type === 'image/heic' ||
    file.type === 'image/heif'
  );
}

class PreviewManager {
  private targetObjectUrls: string[] = [];
  private sourceObjectUrl: string | null = null;

  private async getDisplayUrl(file: File): Promise<string> {
    if (isHeicFile(file)) {
      try {
        const heic2anyModule = await import('heic2any');
        const heic2any = heic2anyModule.default || heic2anyModule;
        const conversion = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.88,
        });
        const blob = Array.isArray(conversion) ? conversion[0] : conversion;
        return URL.createObjectURL(blob);
      } catch (err) {
        console.warn('HEIC decode failed, falling back to original blob URL:', err);
        return URL.createObjectURL(file);
      }
    }
    return URL.createObjectURL(file);
  }

  /**
   * Sets previews for target files with WhatsApp-style multi-image grid and fallback cards.
   * Matches 2x2 square tile layout with darkened +N overlay on tile 4.
   */
  public setTargetPreviews(files: File[]): void {
    // Revoke previous URLs to prevent memory leaks
    this.targetObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    this.targetObjectUrls = [];

    const previewCont = elements.targetPreviewCont;
    previewCont.innerHTML = '';

    if (!files || files.length === 0) {
      previewCont.style.display = 'none';
      return;
    }

    const count = files.length;

    // Header badge inside preview
    const headerBar = document.createElement('div');
    headerBar.className = 'preview-header-bar';
    headerBar.innerHTML = `
      <span class="preview-count-pill">${getIconSvg('image', 13)} ${count} ${count === 1 ? 'photo' : 'photos'}</span>
      <span class="preview-hint">Click to change</span>
    `;
    previewCont.appendChild(headerBar);

    const grid = document.createElement('div');
    grid.className = 'whatsapp-grid';

    if (count === 1) {
      grid.classList.add('grid-1');
    } else if (count === 2) {
      grid.classList.add('grid-2');
    } else if (count === 3) {
      grid.classList.add('grid-3');
    } else {
      grid.classList.add('grid-more');
    }

    const displayLimit = Math.min(count, 4);

    for (let i = 0; i < displayLimit; i++) {
      const file = files[i];
      const tile = document.createElement('div');
      tile.className = 'grid-tile';

      const img = document.createElement('img');
      img.alt = file.name || `Target ${i + 1}`;
      img.style.opacity = '0';
      img.style.transition = 'opacity 0.25s ease';

      img.onload = () => {
        img.style.opacity = '1';
      };

      img.onerror = () => {
        tile.innerHTML = `
          <div class="grid-tile-fallback">
            ${getIconSvg('file', 28)}
            <span class="fallback-name" title="${file.name}">${file.name}</span>
            <span class="fallback-badge">${file.name.split('.').pop()?.toUpperCase() || 'RAW'}</span>
          </div>
        `;
      };

      tile.appendChild(img);

      // 4th tile shows darkened photo underneath + clean "+ N" overlay (WhatsApp style)
      if (i === 3 && count > 4) {
        const remaining = count - 3;
        const overlay = document.createElement('div');
        overlay.className = 'grid-tile-more-overlay';
        overlay.innerHTML = `<span>+ ${remaining}</span>`;
        tile.appendChild(overlay);
      }

      grid.appendChild(tile);

      // Asynchronously resolve display URL (supports instant JPEG/PNG/WebP and WebAssembly HEIC)
      this.getDisplayUrl(file).then((url) => {
        this.targetObjectUrls.push(url);
        img.src = url;
      });
    }

    previewCont.appendChild(grid);
    previewCont.style.display = 'flex';
  }

  /**
   * Sets preview for single source image.
   */
  public setSourcePreview(file: File): void {
    if (this.sourceObjectUrl) {
      URL.revokeObjectURL(this.sourceObjectUrl);
      this.sourceObjectUrl = null;
    }

    const previewCont = elements.sourcePreviewCont;
    previewCont.innerHTML = '';

    const headerBar = document.createElement('div');
    headerBar.className = 'preview-header-bar';
    headerBar.innerHTML = `
      <span class="preview-count-pill">${getIconSvg('description', 13)} Template</span>
      <span class="preview-hint">Click to change</span>
    `;
    previewCont.appendChild(headerBar);

    const grid = document.createElement('div');
    grid.className = 'whatsapp-grid grid-1';

    const tile = document.createElement('div');
    tile.className = 'grid-tile';

    const img = document.createElement('img');
    img.alt = file.name || 'Source template';
    img.style.opacity = '0';
    img.style.transition = 'opacity 0.25s ease';

    img.onload = () => {
      img.style.opacity = '1';
    };

    img.onerror = () => {
      tile.innerHTML = `
        <div class="grid-tile-fallback">
          ${getIconSvg('file', 28)}
          <span class="fallback-name" title="${file.name}">${file.name}</span>
          <span class="fallback-badge">${file.name.split('.').pop()?.toUpperCase() || 'FILE'}</span>
        </div>
      `;
    };

    tile.appendChild(img);
    grid.appendChild(tile);
    previewCont.appendChild(grid);
    previewCont.style.display = 'flex';

    this.getDisplayUrl(file).then((url) => {
      this.sourceObjectUrl = url;
      img.src = url;
    });
  }

  public clearAll(): void {
    this.targetObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    this.targetObjectUrls = [];

    if (this.sourceObjectUrl) {
      URL.revokeObjectURL(this.sourceObjectUrl);
      this.sourceObjectUrl = null;
    }

    elements.targetPreviewCont.innerHTML = '';
    elements.sourcePreviewCont.innerHTML = '';
    elements.targetPreviewCont.style.display = 'none';
    elements.sourcePreviewCont.style.display = 'none';
  }
}

export const previewManager = new PreviewManager();
