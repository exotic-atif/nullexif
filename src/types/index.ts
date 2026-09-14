/**
 * NullExif v2.0.0 Core Type Definitions
 */

export type MetadataRecord = Record<string, string | number | undefined>;

export interface TagGroupDefinition {
  title: string;
  icon: string;
  tags: string[];
}

export type DropdownMap = Record<string, Record<string, string>>;

export interface UploadSuccessFile {
  success: true;
  path: string;
  metadata: Record<string, any>;
  filename: string;
  extension: string;
  size?: number;
}

export interface UploadSuccessResponse {
  success: true;
  path: string;
  metadata: Record<string, any>;
  filename: string;
  extension: string;
  size?: number;
  files?: UploadSuccessFile[];
}

export interface UploadErrorResponse {
  success?: false;
  error: string;
}

export type UploadResponse = UploadSuccessResponse | UploadErrorResponse;

export interface ProceedPayload {
  target_images?: string[];
  target_image?: string;
  metadata: Record<string, string>;
  convert_to: string | null;
}

export interface ProceedOutputItem {
  success: true;
  path: string;
  filename: string;
  size?: number;
}

export interface ProceedSuccessResponse {
  success: true;
  output: string;
  outputs?: ProceedOutputItem[];
}

export interface ProceedErrorResponse {
  success?: false;
  error: string;
}

export type ProceedResponse = ProceedSuccessResponse | ProceedErrorResponse;

export interface GoogleStatusResponse {
  authenticated: boolean;
  email?: string | null;
}

export interface GoogleLoginResponse {
  url?: string;
  error?: string;
}

export interface GoogleLogoutResponse {
  success: boolean;
}

export interface ResumableSessionResponse {
  success: true;
  upload_url: string;
  file_size: number;
  file_name: string;
  mime_type?: string;
}

export interface GooglePhotosUploadItemStatus {
  message?: string;
  code?: number;
}

export interface GooglePhotosUploadResult {
  newMediaItemResults?: Array<{
    status?: GooglePhotosUploadItemStatus;
    mediaItem?: {
      id: string;
      productUrl: string;
    };
  }>;
  error?: string;
  details?: string;
}

export type PresetsMap = Record<string, Record<string, string>>;

export interface SessionState {
  targets: UploadSuccessFile[];
  source: UploadSuccessResponse | null;
  formMeta: Record<string, string>;
}

export interface ParsedGpsCoordinates {
  GPSLatitude: string;
  GPSLatitudeRef: string;
  GPSLongitude: string;
  GPSLongitudeRef: string;
}
