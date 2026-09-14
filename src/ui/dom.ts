/**
 * Cached DOM elements with strict type safety for NullExif v2.0.0.
 */

function getRequiredElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Required DOM element with id "${id}" not found.`);
  }
  return el as T;
}

export const elements = {
  get themeToggleBtn() { return getRequiredElement<HTMLButtonElement>('theme-toggle-btn'); },
  get authEmailBadge() { return getRequiredElement<HTMLElement>('auth-email-badge'); },
  get authEmailText() { return getRequiredElement<HTMLElement>('auth-email-text'); },
  get targetInput() { return getRequiredElement<HTMLInputElement>('target-input'); },
  get sourceInput() { return getRequiredElement<HTMLInputElement>('source-input'); },
  get targetDropZone() { return getRequiredElement<HTMLElement>('target-drop-zone'); },
  get sourceDropZone() { return getRequiredElement<HTMLElement>('source-drop-zone'); },
  get targetPreviewCont() { return getRequiredElement<HTMLElement>('target-preview-cont'); },
  get sourcePreviewCont() { return getRequiredElement<HTMLElement>('source-preview-cont'); },
  get editorPanel() { return getRequiredElement<HTMLElement>('editor-panel'); },
  get groupsContainer() { return getRequiredElement<HTMLElement>('metadata-groups'); },
  get actionBar() { return getRequiredElement<HTMLElement>('actions-bar'); },
  get conflictModal() { return getRequiredElement<HTMLElement>('conflict-modal'); },
  get modalCancel() { return getRequiredElement<HTMLButtonElement>('modal-cancel'); },
  get modalConfirm() { return getRequiredElement<HTMLButtonElement>('modal-confirm'); },
  get targetExtDisplay() { return getRequiredElement<HTMLElement>('target-ext-display'); },
  get sourceExtDisplay() { return getRequiredElement<HTMLElement>('source-ext-display'); },
  get downloadResult() { return getRequiredElement<HTMLElement>('download-result'); },
  get downloadLink() { return getRequiredElement<HTMLAnchorElement>('download-link'); },
  get closeDownloadBtn() { return getRequiredElement<HTMLButtonElement>('close-download-btn'); },
  get targetStatus() { return getRequiredElement<HTMLElement>('target-status'); },
  get presetSelect() { return getRequiredElement<HTMLSelectElement>('preset-select'); },
  get clearUploadsBtn() { return getRequiredElement<HTMLButtonElement>('clear-uploads'); },
  get finalProceedBtn() { return getRequiredElement<HTMLButtonElement>('final-proceed'); },
  get mainLoader() { return getRequiredElement<HTMLElement>('main-loader'); },
  get btnText() { return getRequiredElement<HTMLElement>('btn-text'); },
  get autoConvertCheck() { return getRequiredElement<HTMLInputElement>('auto-convert-check'); },
  get googleLoginBtn() { return getRequiredElement<HTMLButtonElement>('google-login-btn'); },
  get googleUploadBtn() { return getRequiredElement<HTMLButtonElement>('google-upload-btn'); },
  get googleLogoutBtn() { return getRequiredElement<HTMLButtonElement>('google-logout-btn'); },
  get uploadStatusText() { return getRequiredElement<HTMLElement>('upload-status-text'); },
};
