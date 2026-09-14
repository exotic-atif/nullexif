import {
  createElement,
  Camera,
  Sliders,
  Image as ImageIcon,
  MapPin,
  Sparkles,
  Check,
  AlertCircle,
  AlertTriangle,
  X,
  Sun,
  Moon,
  Laptop,
  LogIn,
  LogOut,
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  Trash2,
  CloudUpload,
  RefreshCw,
  FileImage,
  CheckCircle2,
  FileText,
  Clock,
  Layers,
  Info,
  Maximize2,
  Minimize2,
  type IconNode,
} from 'lucide';

const iconMap: Record<string, IconNode> = {
  camera: Camera,
  sliders: Sliders,
  image: ImageIcon,
  pin: MapPin,
  sparkles: Sparkles,
  check: Check,
  'check-circle': CheckCircle2,
  alert: AlertCircle,
  warning: AlertTriangle,
  close: X,
  sun: Sun,
  moon: Moon,
  laptop: Laptop,
  login: LogIn,
  logout: LogOut,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  pause: Pause,
  play: Play,
  trash: Trash2,
  upload: CloudUpload,
  refresh: RefreshCw,
  file: FileImage,
  description: FileText,
  clock: Clock,
  layers: Layers,
  info: Info,
  maximize: Maximize2,
  minimize: Minimize2,
};

export function getIconSvg(name: string, size = 18, className = ''): string {
  const iconNode = iconMap[name];
  if (!iconNode) {
    return `<span class="icon-fallback">${name}</span>`;
  }

  const svgElement = createElement(iconNode);
  svgElement.setAttribute('width', String(size));
  svgElement.setAttribute('height', String(size));
  if (className) {
    svgElement.setAttribute('class', className);
  }
  return svgElement.outerHTML;
}

export function renderIcon(element: HTMLElement, name: string, size = 18, className = ''): void {
  element.innerHTML = getIconSvg(name, size, className);
}
