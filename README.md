# NullExif (v2.0.0)

> High-Precision Photo Metadata Engineering Suite • Part of **The Null Projects**

A fast, modern photo EXIF and metadata management application built with the **NullWave** aesthetic, real vector Lucide icons, dark/light/auto theming, WhatsApp-style bulk photo viewer, and resumable Google Photos uploads.

---

## Features
- **NullWave Design System**: Glassmorphism, Space Grotesk & Inter typography, cyan accent glow, smooth animations, and toggleable dark / light / auto themes.
- **WhatsApp Multi-Image Target Viewer**: Supports bulk target uploads displaying a 2x2 grid with `+n` overlay for 4+ photos.
- **Floating Uploader Drawer with Pill Progress Bars**: Minimizable floating upload drawer with real-time pill progress bars tracking resumable uploads with Pause, Resume, and Cancel capabilities.
- **Zero-Lag Instant Metadata**: In-browser sub-millisecond EXIF header parsing with zero perceptible delay when files are picked or dropped.
- **Google Account Indicator**: Displays `Logged in as: user@gmail.com` with sign-out support.
- **Zero Python Runtime Bottleneck**: Completely eliminates Python in favor of direct native ExifTool execution and PHP GD for native format conversions (5-10x faster execution).

---

## How to Run

### Option 1: Quick Launch (Recommended)
Just double click on `start-server.bat`. It will compile frontend assets if needed and launch the server at:
`http://localhost:6767`

### Option 2: Development Mode (Vite HMR + PHP Server)
1. Start the PHP backend on port 6767:
   ```bash
   php -S localhost:6767
   ```
2. In a separate terminal, start Vite with instant Hot Module Replacement (HMR):
   ```bash
   npm run dev
   ```
3. To rebuild the production bundle at any time:
   ```bash
   npm run build
   ```

**_NOTE:_** We use port `6767` because `GOOGLE_REDIRECT_URI` is configured on port `6767`.

---

## Requirements
- **Node.js**: v18+ (for TypeScript compilation and Vite build).
- **PHP**: Installed and in your PATH (with GD extension enabled).
- **ExifTool**: Installed and available in your system PATH (`exiftool`).
- *(Note: Python is no longer required!)*

---

## Architecture & File Structure
- `src/`: Full TypeScript modular codebase.
  - `src/types/`: Strict type definitions for EXIF, XMP, IPTC, and Google API schemas.
  - `src/services/`: Client-side instant EXIF parser (`clientExif.ts`), resumable Google Photos client, and typed API service (`api.ts`).
  - `src/utils/`: High-performance GPS coordinate parser and datetime normalizers.
  - `src/ui/`: WhatsApp-style preview manager (`previewManager.ts`), floating uploader drawer (`uploaderDrawer.ts`), Lucide vector icons (`icons.ts`), and Theme manager (`themeManager.ts`).
  - `src/styles/`: NullWave CSS design system (`main.css`).
  - `src/main.ts`: Main application bootstrap and event orchestrator.
- `dist/`: High-performance, minified production bundle (`bundle.js` and `bundle.css`).
- `index.html`: Clean semantic HTML loading NullWave UI and bundle.
- `process.php`: High-speed PHP bridge executing native ExifTool and GD operations without Python.
- `exif_engine.php`: Direct native ExifTool & GD processing logic.
- `upload_to_photos.php`: Resumable Google Photos upload protocol endpoints with chunked byte tracking.
- `google_status.php`: Authentication and user email status endpoint.
- `uploads/`: Temporary storage for uploaded images.
