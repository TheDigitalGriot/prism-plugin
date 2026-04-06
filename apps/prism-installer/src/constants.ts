export interface ComponentInfo {
  id: "cli" | "vscode" | "plugin" | "electron";
  name: string;
  desc: string;
  size: string;
  sizeMb: number;
  required: boolean;
  defaultChecked: boolean;
  icon: string;
  color: string;
}

export const COMPONENTS: ComponentInfo[] = [
  {
    id: "cli",
    name: "Prism CLI",
    desc: "Core terminal interface and workflow engine",
    size: "~2 MB",
    sizeMb: 2,
    required: true,
    defaultChecked: true,
    icon: ">_",
    color: "#4A9EFF",
  },
  {
    id: "vscode",
    name: "VS Code Extension",
    desc: "Pixel office monitor and story integration for VS Code, Cursor, Windsurf",
    size: "~8 MB",
    sizeMb: 8,
    required: false,
    defaultChecked: true,
    icon: "{}",
    color: "#2DD4BF",
  },
  {
    id: "plugin",
    name: "Claude Code Plugin",
    desc: "Slash commands, agents, and skills for Claude Code",
    size: "~1 MB",
    sizeMb: 1,
    required: false,
    defaultChecked: true,
    icon: "◈",
    color: "#4ADE80",
  },
  {
    id: "electron",
    name: "Prism Desktop App",
    desc: "Standalone visual workspace manager (downloads from GitHub)",
    size: "~130 MB",
    sizeMb: 130,
    required: false,
    defaultChecked: false,
    icon: "⬡",
    color: "#FBB040",
  },
];

export const WIN_STEPS = [
  "welcome",
  "components",
  "directory",
  "preflight",
  "progress",
  "finish",
] as const;

export const MAC_STEPS = [
  { id: "intro", label: "Introduction" },
  { id: "license", label: "License" },
  { id: "destination", label: "Destination" },
  { id: "type", label: "Installation Type" },
  { id: "install", label: "Installing" },
  { id: "summary", label: "Summary" },
] as const;
