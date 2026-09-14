import { elements } from './dom';

export class ModalManager {
  public showConflict(targetExt: string, sourceExt: string): void {
    elements.targetExtDisplay.innerText = `.${targetExt}`;
    elements.sourceExtDisplay.innerText = `.${sourceExt}`;
    elements.conflictModal.style.display = 'flex';
  }

  public hideConflict(): void {
    elements.conflictModal.style.display = 'none';
  }

  public showDownloadResult(outputPath: string): void {
    elements.downloadLink.href = outputPath;
    elements.downloadResult.style.display = 'flex';
  }

  public hideDownloadResult(): void {
    elements.downloadResult.style.display = 'none';
  }

  public updateGoogleAuthUI(authenticated: boolean): void {
    if (authenticated) {
      elements.googleLoginBtn.style.display = 'none';
      elements.googleUploadBtn.style.display = 'flex';
      elements.googleLogoutBtn.style.display = 'flex';
    } else {
      elements.googleLoginBtn.style.display = 'flex';
      elements.googleUploadBtn.style.display = 'none';
      elements.googleLogoutBtn.style.display = 'none';
    }
  }

  public setProcessingState(isProcessing: boolean): void {
    elements.mainLoader.style.display = isProcessing ? 'block' : 'none';
    elements.btnText.innerText = isProcessing ? 'Processing...' : 'Proceed';
    elements.finalProceedBtn.disabled = isProcessing;
  }
}

export const modalManager = new ModalManager();
