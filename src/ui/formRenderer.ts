import { GROUP_DEFINITIONS, DROPDOWNS } from '../constants/tags';
import { exifToHtml, htmlToExif } from '../utils/datetime';
import { synthesizeGoogleMapsCoordinates } from '../utils/coordinates';
import { elements } from './dom';
import { getIconSvg } from './icons';

export class FormRenderer {
  private formMeta: Record<string, string> = {};

  constructor() {
    this.initEventDelegation();
  }

  public getFormMetadata(): Record<string, string> {
    const meta = { ...this.formMeta };
    if (elements.groupsContainer) {
      const inputs = elements.groupsContainer.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-tag]');
      inputs.forEach((input) => {
        const tag = input.getAttribute('data-tag');
        if (!tag) return;
        if (input instanceof HTMLInputElement && input.type === 'datetime-local') {
          if (input.value) {
            meta[tag] = htmlToExif(input.value);
          }
        } else {
          meta[tag] = input.value;
        }
      });
    }
    return meta;
  }

  public setTagValue(tag: string, value: string): void {
    this.formMeta[tag] = value;
  }

  private initEventDelegation(): void {
    const container = elements.groupsContainer;

    container.addEventListener('change', (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const tag = target.getAttribute('data-tag');
      if (!tag) return;

      if (target instanceof HTMLInputElement) {
        let finalVal = target.value;
        if (target.type === 'datetime-local') {
          finalVal = htmlToExif(finalVal);
        }
        this.formMeta[tag] = finalVal;
      } else if (target instanceof HTMLSelectElement) {
        this.formMeta[tag] = target.value;
      }
    });
  }

  private escapeAttr(val: unknown): string {
    return String(val ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * High-performance batch render using a DocumentFragment to eliminate layout thrashing.
   */
  public render(meta: Record<string, any>): void {
    this.formMeta = {};
    const fragment = document.createDocumentFragment();

    const normalizedCoords = synthesizeGoogleMapsCoordinates(meta);
    if (normalizedCoords) {
      meta['EXIF:GoogleMapsCoordinates'] = normalizedCoords;
    }

    for (const [, group] of Object.entries(GROUP_DEFINITIONS)) {
      const groupEl = document.createElement('div');
      groupEl.className = 'group-container';

      const titleEl = document.createElement('div');
      titleEl.className = 'group-title';
      titleEl.innerHTML = `${getIconSvg(group.icon, 16)} <span>${this.escapeAttr(group.title)}</span>`;
      groupEl.appendChild(titleEl);

      const gridEl = document.createElement('div');
      gridEl.className = 'tags-grid';

      for (const tag of group.tags) {
        let value = meta[tag] !== undefined ? String(meta[tag]) : '';

        if (tag === 'EXIF:GoogleMapsCoordinates' && !value) {
          const synth = synthesizeGoogleMapsCoordinates(meta);
          if (synth) value = synth;
        }

        this.formMeta[tag] = value;

        const fieldEl = document.createElement('div');
        fieldEl.className = 'tag-field';

        let cleanLabel = tag.split(':').pop()?.replace(/([A-Z])/g, ' $1').trim() || tag;
        if (tag === 'EXIF:GoogleMapsCoordinates') {
          cleanLabel = 'Google Maps Location Coordinates';
        }

        const fieldId = `field-${tag.replace(/:/g, '-')}`;

        let controlHtml = '';
        if (DROPDOWNS[tag]) {
          controlHtml = `<select class="tag-select" id="${fieldId}" data-tag="${this.escapeAttr(tag)}">`;
          for (const [val, label] of Object.entries(DROPDOWNS[tag])) {
            const isSelected = String(value).startsWith(val);
            controlHtml += `<option value="${this.escapeAttr(val)}" ${isSelected ? 'selected' : ''}>${this.escapeAttr(label)}</option>`;
          }
          controlHtml += '</select>';
        } else if (tag.includes('Date')) {
          const htmlDate = exifToHtml(value);
          controlHtml = `<input type="datetime-local" class="tag-input" id="${fieldId}" value="${this.escapeAttr(htmlDate)}" data-tag="${this.escapeAttr(tag)}">`;
        } else {
          const placeholder = tag === 'EXIF:GoogleMapsCoordinates' ? '22°54\'00.0"N 88°05\'23.0"E' : '';
          controlHtml = `<input type="text" class="tag-input" id="${fieldId}" value="${this.escapeAttr(value)}" data-tag="${this.escapeAttr(tag)}" placeholder="${this.escapeAttr(placeholder)}">`;
        }

        fieldEl.innerHTML = `<div class="tag-label" title="${this.escapeAttr(tag)}">${this.escapeAttr(cleanLabel)}</div>${controlHtml}`;
        gridEl.appendChild(fieldEl);
      }

      groupEl.appendChild(gridEl);
      fragment.appendChild(groupEl);
    }

    elements.groupsContainer.innerHTML = '';
    elements.groupsContainer.appendChild(fragment);
  }

  /**
   * Fast targeted update without re-rendering the whole form.
   */
  public updateFields(sourceMeta: Record<string, any>, highlight = false): void {
    const synthCoords = synthesizeGoogleMapsCoordinates(sourceMeta);
    if (synthCoords) {
      sourceMeta['EXIF:GoogleMapsCoordinates'] = synthCoords;
    }

    for (const [tag, val] of Object.entries(sourceMeta)) {
      if (val === undefined || val === null) continue;
      const strVal = String(val);
      const input = elements.groupsContainer.querySelector(`[data-tag="${tag}"]`) as HTMLInputElement | HTMLSelectElement | null;

      if (input) {
        if (input instanceof HTMLInputElement && input.type === 'datetime-local') {
          input.value = exifToHtml(strVal);
          this.formMeta[tag] = strVal;
        } else {
          input.value = strVal;
          this.formMeta[tag] = strVal;
        }

        if (highlight) {
          input.style.borderColor = 'var(--secondary)';
          setTimeout(() => {
            input.style.borderColor = '';
          }, 1000);
        }
      }
    }
  }
}

export const formRenderer = new FormRenderer();
