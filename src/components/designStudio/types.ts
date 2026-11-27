import { DEFAULT_TEST_PAYLOAD } from "@/lib/revisionTestScenarios";
import type { DesignerPallet } from "@/store/designerGenerate/designerGenerateType";

export type ApiEndpoint =
  | "/api/enterprise-design-test"
  | "/api/design-brief"
  | "/api/design-brief?mode=revision";

export interface DesignVersion {
  id: string;
  versionNumber: number;
  title: string;
  subtitle: string;
  badge: string;
  imageUrl: string;
  originalImageUrl?: string;
  selected: boolean;
  isDemo: boolean;
  taskId?: string;
  status?: "generating" | "polling" | "completed" | "failed" | "text_answer";
  textAnswer?: string;
  error?: string;
  rawResponse?: unknown;
  pallets?: DesignerPallet[];
}

export const DESIGN_DIRECTIONS = [
  "Elegant & timeless",
  "Modern & minimal",
  "Natural & relaxed",
  "Classic & formal",
  "Coastal & airy",
];

export const IMAGE_STYLES = [
  "Photorealistic",
  "Architectural render",
  "Editorial daylight",
  "Soft evening glow",
];

export const DEFAULT_PROMPT =
  "Create an elegant, photorealistic front yard landscape for this blue Craftsman home. Keep the architecture, porch, white railings, existing windows, yellow door, camera angle and house colors unchanged. Design layered foundation plantings with structured evergreen shrubs, soft seasonal color and a clean, welcoming entry. Suitable for Michigan's climate.";

// Clean inline SVG fallback so demo cards always render crisp visuals even offline
export const DEMO_HOUSE_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 560" fill="none">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#93c5fd"/>
        <stop offset="100%" stop-color="#e0f2fe"/>
      </linearGradient>
      <linearGradient id="lawn" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#4d7c0f"/>
        <stop offset="100%" stop-color="#365314"/>
      </linearGradient>
    </defs>
    <rect width="960" height="560" fill="url(#sky)"/>
    <rect y="390" width="960" height="170" fill="url(#lawn)"/>
    <rect x="190" y="210" width="580" height="185" fill="#1e3a5f"/>
    <polygon points="155,215 480,105 805,215" fill="#334155"/>
    <polygon points="410,185 480,125 550,185" fill="#1e3a5f" stroke="#f8fafc" stroke-width="6"/>
    <rect x="200" y="220" width="560" height="175" fill="#1e3a5f"/>
    <rect x="185" y="210" width="590" height="18" fill="#f8fafc"/>
    <rect x="205" y="228" width="16" height="150" fill="#f8fafc"/>
    <rect x="360" y="228" width="16" height="150" fill="#f8fafc"/>
    <rect x="584" y="228" width="16" height="150" fill="#f8fafc"/>
    <rect x="739" y="228" width="16" height="150" fill="#f8fafc"/>
    <rect x="454" y="255" width="52" height="110" rx="2" fill="#eab308" stroke="#f8fafc" stroke-width="4"/>
    <circle cx="496" cy="312" r="3" fill="#713f12"/>
    <rect x="260" y="255" width="70" height="65" fill="#bae6fd" stroke="#f8fafc" stroke-width="5"/>
    <rect x="630" y="255" width="70" height="65" fill="#bae6fd" stroke="#f8fafc" stroke-width="5"/>
    <rect x="205" y="330" width="235" height="6" fill="#f8fafc"/>
    <rect x="520" y="330" width="235" height="6" fill="#f8fafc"/>
    <rect x="440" y="370" width="80" height="12" fill="#e2e8f0"/>
    <rect x="434" y="382" width="92" height="14" fill="#cbd5e1"/>
    <ellipse cx="240" cy="395" rx="45" ry="26" fill="#15803d"/>
    <ellipse cx="310" cy="400" rx="38" ry="22" fill="#166534"/>
    <ellipse cx="385" cy="402" rx="34" ry="20" fill="#4d7c0f"/>
    <ellipse cx="575" cy="402" rx="34" ry="20" fill="#4d7c0f"/>
    <ellipse cx="650" cy="400" rx="38" ry="22" fill="#166534"/>
    <ellipse cx="720" cy="395" rx="45" ry="26" fill="#15803d"/>
    <circle cx="245" cy="388" r="10" fill="#fef08a"/>
    <circle cx="385" cy="396" r="9" fill="#f472b6"/>
    <circle cx="575" cy="396" r="9" fill="#f472b6"/>
    <circle cx="715" cy="388" r="10" fill="#fef08a"/>
  </svg>`
)}`;

export const INITIAL_DEMO_VERSIONS: DesignVersion[] = [
  {
    id: "demo-1",
    versionNumber: 1,
    title: "Illustrative Luna concept 1",
    subtitle: "Sample preview for testing the builder workflow. Not generated live by Luna.",
    badge: "Demo concept",
    imageUrl: DEFAULT_TEST_PAYLOAD.image_url || DEMO_HOUSE_SVG,
    selected: true,
    isDemo: true,
  },
  {
    id: "demo-2",
    versionNumber: 2,
    title: "Illustrative Luna concept 2",
    subtitle: "Sample preview for testing the builder workflow. Not generated live by Luna.",
    badge: "Demo concept",
    imageUrl: DEFAULT_TEST_PAYLOAD.image_url || DEMO_HOUSE_SVG,
    selected: true,
    isDemo: true,
  },
  {
    id: "demo-3",
    versionNumber: 3,
    title: "Illustrative Luna concept 3",
    subtitle: "Sample preview for testing the builder workflow. Not generated live by Luna.",
    badge: "Demo concept",
    imageUrl: DEFAULT_TEST_PAYLOAD.image_url || DEMO_HOUSE_SVG,
    selected: true,
    isDemo: true,
  },
];
