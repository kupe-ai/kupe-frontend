import type { ReactElement, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type KupeIconName =
  | "home"
  | "robot"
  | "book"
  | "wave"
  | "phone"
  | "inbound"
  | "outbound-phone"
  | "megaphone"
  | "code"
  | "bars"
  | "line-chart"
  | "gear"
  | "folder"
  | "upload"
  | "braces"
  | "ban"
  | "key"
  | "layers"
  | "user"
  | "users"
  | "building"
  | "search"
  | "search-x"
  | "palette"
  | "sun"
  | "moon"
  | "monitor"
  | "file"
  | "wrench"
  | "phone-transfer"
  | "check-square"
  | "plus"
  | "clock"
  | "copy"
  | "plug"
  | "wallet";

type SvgProps = { className?: string };

function Frame({
  name,
  className,
  children,
}: {
  name: KupeIconName;
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      overflow="visible"
      aria-hidden
      className={cn("ki", `ki-${name}`, className)}
    >
      {children}
    </svg>
  );
}

function HomeIcon({ className }: SvgProps) {
  return (
    <Frame name="home" className={className}>
      <path className="ki-roof" d="M3.5 11 12 3.4 20.5 11" />
      <path d="M6 10.2V19a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V10.2" />
      <rect className="ki-door" x="10" y="14.4" width="4" height="6.1" rx="0.6" />
    </Frame>
  );
}

function RobotIcon({ className }: SvgProps) {
  return (
    <Frame name="robot" className={className}>
      <rect x="6.2" y="8" width="11.6" height="10.2" rx="2.6" />
      <circle className="ki-eye" cx="10.1" cy="12.6" r="1.15" fill="currentColor" stroke="none" />
      <circle className="ki-eye ki-eye-r" cx="13.9" cy="12.6" r="1.15" fill="currentColor" stroke="none" />
      <path className="ki-mouth" d="M10.2 15.7h3.6" />
      <g className="ki-ant-l">
        <path d="M9.1 8 7.8 4.1" />
        <circle cx="7.7" cy="3.6" r="0.95" />
      </g>
      <g className="ki-ant-r">
        <path d="M14.9 8 16.2 4.1" />
        <circle cx="16.3" cy="3.6" r="0.95" />
      </g>
    </Frame>
  );
}

function BookIcon({ className }: SvgProps) {
  return (
    <Frame name="book" className={className}>
      <path d="M12 6.6v13.2" />
      <path
        className="ki-page-l"
        d="M12 6.6C10.4 5 8.2 4.4 6 4.4H4.6A1.6 1.6 0 0 0 3 6v11.2a1.5 1.5 0 0 1 1.5-1.4H7c1.9 0 3.6.6 5 2"
      />
      <path
        className="ki-page-r"
        d="M12 6.6c1.6-1.6 3.8-2.2 6-2.2h1.4A1.6 1.6 0 0 1 21 6v11.2a1.5 1.5 0 0 0-1.5-1.4H17c-1.9 0-3.6.6-5 2"
      />
    </Frame>
  );
}

function WaveIcon({ className }: SvgProps) {
  return (
    <Frame name="wave" className={className}>
      <rect className="ki-bar ki-bar-1" x="3.8" y="10.2" width="3.1" height="8.3" rx="1.4" />
      <rect className="ki-bar ki-bar-2" x="8.2" y="5.5" width="3.1" height="13" rx="1.4" />
      <rect className="ki-bar ki-bar-3" x="12.7" y="8" width="3.1" height="10.5" rx="1.4" />
      <rect className="ki-bar ki-bar-4" x="17.1" y="11.4" width="3.1" height="7.1" rx="1.4" />
    </Frame>
  );
}

function PhoneIcon({ className }: SvgProps) {
  return (
    <Frame name="phone" className={className}>
      <g className="ki-handset">
        <path d="M7.6 3.8c.7-.7 1.9-.6 2.5.3l1.1 1.8c.4.7.2 1.5-.4 2L9.6 9c.9 1.9 2.4 3.4 4.3 4.4l1.1-1.2c.5-.6 1.3-.8 2-.4l1.8 1.1c.9.6 1 1.8.3 2.5l-.9.9c-.8.8-2 .9-3.1.5-2.9-1.1-5.6-3.3-7.5-6.3C6.2 8.4 6.4 7 7.3 6.1z" />
      </g>
    </Frame>
  );
}

function InboundIcon({ className }: SvgProps) {
  return (
    <Frame name="inbound" className={className}>
      <g className="ki-handset">
        <path d="M8.2 8.6c.6-.6 1.6-.5 2.1.3l.8 1.3c.3.5.1 1.1-.3 1.4l-.8.6c.7 1.4 1.8 2.5 3.2 3.2l.6-.8c.3-.4.9-.6 1.4-.3l1.3.8c.8.5.9 1.5.3 2.1l-.7.7c-.7.7-1.7.8-2.6.4-2.4-.9-4.6-2.7-6.1-5.1-.7-1.2-.5-2.3.4-3.2z" />
      </g>
      <g className="ki-in-arrow">
        <path d="M14.2 4.2 19.6 9.6" />
        <path d="M14.4 9.6h5.2V4.4" />
      </g>
    </Frame>
  );
}

function OutboundPhoneIcon({ className }: SvgProps) {
  return (
    <Frame name="outbound-phone" className={className}>
      <g className="ki-handset">
        <path d="M8.2 8.6c.6-.6 1.6-.5 2.1.3l.8 1.3c.3.5.1 1.1-.3 1.4l-.8.6c.7 1.4 1.8 2.5 3.2 3.2l.6-.8c.3-.4.9-.6 1.4-.3l1.3.8c.8.5.9 1.5.3 2.1l-.7.7c-.7.7-1.7.8-2.6.4-2.4-.9-4.6-2.7-6.1-5.1-.7-1.2-.5-2.3.4-3.2z" />
      </g>
      <g className="ki-out-arrow">
        <path d="M14.4 9.8 19.8 4.4" />
        <path d="M15 4.4h4.8V9.2" />
      </g>
    </Frame>
  );
}

function MegaphoneIcon({ className }: SvgProps) {
  return (
    <Frame name="megaphone" className={className}>
      <g className="ki-horn">
        <path d="M3.8 11.2v2.2a1.4 1.4 0 0 0 1.4 1.4h1.3l3.3 3.6V6.2L6.5 9.8H5.2a1.4 1.4 0 0 0-1.4 1.4z" />
        <path d="M9.8 7.2 19.4 4.4v15.2l-9.6-2.8" />
      </g>
      <path className="ki-wave-1" d="M20.2 9.2c.7.8.7 2.8 0 3.6" />
      <path className="ki-wave-2" d="M22.1 7.6c1.3 1.4 1.3 5.4 0 6.8" />
    </Frame>
  );
}

function CodeIcon({ className }: SvgProps) {
  return (
    <Frame name="code" className={className}>
      <path className="ki-brack-l" d="M8.2 6.2 3.4 12l4.8 5.8" />
      <path className="ki-slash" d="M14.2 5.2 9.8 18.8" />
      <path className="ki-brack-r" d="M15.8 6.2 20.6 12l-4.8 5.8" />
    </Frame>
  );
}

function BarsIcon({ className }: SvgProps) {
  return (
    <Frame name="bars" className={className}>
      <rect className="ki-cbar ki-cbar-1" x="3.8" y="13.6" width="4.6" height="6.4" rx="1.1" />
      <rect className="ki-cbar ki-cbar-2" x="9.7" y="9.2" width="4.6" height="10.8" rx="1.1" />
      <rect className="ki-cbar ki-cbar-3" x="15.6" y="5" width="4.6" height="15" rx="1.1" />
    </Frame>
  );
}

function LineChartIcon({ className }: SvgProps) {
  return (
    <Frame name="line-chart" className={className}>
      <path d="M3.5 19.5h17" />
      <path className="ki-spark" d="M4.2 14.8 8.4 10l3.6 2.6 4.8-6.4 3.4 2.2" />
      <circle className="ki-dot" cx="20" cy="8.4" r="1.35" fill="currentColor" stroke="none" />
    </Frame>
  );
}

function GearIcon({ className }: SvgProps) {
  return (
    <Frame name="gear" className={className}>
      <g className="ki-cog">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3.4v2.1M12 18.5v2.1M4.9 6.4l1.5 1.5M17.6 16.1l1.5 1.5M3.4 12h2.1M18.5 12h2.1M4.9 17.6l1.5-1.5M17.6 7.9l1.5-1.5" />
        <circle cx="12" cy="12" r="7.2" />
      </g>
    </Frame>
  );
}

function FolderIcon({ className }: SvgProps) {
  return (
    <Frame name="folder" className={className}>
      <path
        className="ki-flap"
        d="M3.4 7.4h5.3l1.7 2.2h10.2A1.4 1.4 0 0 1 22 11v.2"
      />
      <path d="M3.4 7.4V18.4A1.6 1.6 0 0 0 5 20h14a1.6 1.6 0 0 0 1.6-1.6V11H10.2" />
    </Frame>
  );
}

function UploadIcon({ className }: SvgProps) {
  return (
    <Frame name="upload" className={className}>
      <path d="M4.2 16.4v2.1A1.6 1.6 0 0 0 5.8 20h12.4a1.6 1.6 0 0 0 1.6-1.5v-2.1" />
      <g className="ki-up">
        <path d="M12 16.2V5.6" />
        <path d="M8.2 9.2 12 5.4l3.8 3.8" />
      </g>
    </Frame>
  );
}

function BracesIcon({ className }: SvgProps) {
  return (
    <Frame name="braces" className={className}>
      <path
        className="ki-brace-l"
        d="M9.2 4.2c-2.1 0-3.2 1.3-3.2 3.2v2c0 1.1-.7 1.8-1.8 1.8 1.1 0 1.8.7 1.8 1.8v2c0 1.9 1.1 3.2 3.2 3.2"
      />
      <path
        className="ki-brace-r"
        d="M14.8 4.2c2.1 0 3.2 1.3 3.2 3.2v2c0 1.1.7 1.8 1.8 1.8-1.1 0-1.8.7-1.8 1.8v2c0 1.9-1.1 3.2-3.2 3.2"
      />
    </Frame>
  );
}

function BanIcon({ className }: SvgProps) {
  return (
    <Frame name="ban" className={className}>
      <circle className="ki-ring" cx="12" cy="12" r="8.4" />
      <path className="ki-slash" d="M6.2 6.2 17.8 17.8" />
    </Frame>
  );
}

function KeyIcon({ className }: SvgProps) {
  return (
    <Frame name="key" className={className}>
      <g className="ki-key">
        <circle cx="8.2" cy="15.4" r="4.1" />
        <path d="M11.4 12.6 20.4 3.6" />
        <path d="M16.6 7.4h3.2v3" />
      </g>
    </Frame>
  );
}

function LayersIcon({ className }: SvgProps) {
  return (
    <Frame name="layers" className={className}>
      <path
        className="ki-layer ki-layer-1"
        d="M12.8 3.5a2 2 0 0 0-1.6 0L3.2 7.2a1 1 0 0 0 0 1.8l8 3.6a2 2 0 0 0 1.6 0l8-3.6a1 1 0 0 0 0-1.8z"
      />
      <path className="ki-layer ki-layer-2" d="M3.4 13.2 12 17.1l8.6-3.9" />
      <path className="ki-layer ki-layer-3" d="M3.4 17.2 12 21.1l8.6-3.9" />
    </Frame>
  );
}

function UserIcon({ className }: SvgProps) {
  return (
    <Frame name="user" className={className}>
      <circle className="ki-head" cx="12" cy="8" r="3.2" />
      <path className="ki-body" d="M5.4 19.6c.9-3.5 3.5-5.3 6.6-5.3s5.7 1.8 6.6 5.3" />
    </Frame>
  );
}

function UsersIcon({ className }: SvgProps) {
  return (
    <Frame name="users" className={className}>
      <g className="ki-user-a">
        <circle cx="9" cy="8.2" r="2.8" />
        <path d="M3.6 19.4c.8-3.1 3-4.7 5.6-4.7" />
      </g>
      <g className="ki-user-b">
        <circle cx="16.2" cy="8.8" r="2.4" />
        <path d="M13.2 19.4c.6-2.4 2.3-3.7 4.4-3.7 2.2 0 3.9 1.3 4.5 3.7" />
      </g>
    </Frame>
  );
}

function BuildingIcon({ className }: SvgProps) {
  return (
    <Frame name="building" className={className}>
      <path d="M4.2 20.6V6.4A1.4 1.4 0 0 1 5.6 5h12.8a1.4 1.4 0 0 1 1.4 1.4v14.2" />
      <path d="M2.4 20.6h19.2" />
      <path className="ki-win ki-win-1" d="M8 8.4h2.2v2.2H8z" />
      <path className="ki-win ki-win-2" d="M13.8 8.4h2.2v2.2h-2.2z" />
      <path className="ki-win ki-win-3" d="M8 13.2h2.2v2.2H8z" />
      <path className="ki-win ki-win-4" d="M13.8 13.2h2.2v2.2h-2.2z" />
    </Frame>
  );
}

function SearchIcon({ className }: SvgProps) {
  return (
    <Frame name="search" className={className}>
      <g className="ki-glass">
        <circle cx="11" cy="11" r="6.4" />
        <path d="M16.2 16.2 21 21" />
      </g>
    </Frame>
  );
}

function SearchXIcon({ className }: SvgProps) {
  return (
    <Frame name="search-x" className={className}>
      <circle cx="11" cy="11" r="6.4" />
      <path d="M16.2 16.2 21 21" />
      <g className="ki-x">
        <path d="M9 9l4 4" />
        <path d="M13 9l-4 4" />
      </g>
    </Frame>
  );
}

function PaletteIcon({ className }: SvgProps) {
  return (
    <Frame name="palette" className={className}>
      <path d="M12 3.4a8.6 8.6 0 1 0 0 17.2h.4a2.2 2.2 0 0 0 2-3.1 2.1 2.1 0 0 1 1.9-3.1h1.7A8.6 8.6 0 0 0 12 3.4z" />
      <circle className="ki-swatch ki-swatch-1" cx="8.2" cy="10.2" r="1" fill="currentColor" stroke="none" />
      <circle className="ki-swatch ki-swatch-2" cx="12" cy="7.6" r="1" fill="currentColor" stroke="none" />
      <circle className="ki-swatch ki-swatch-3" cx="15.8" cy="10.2" r="1" fill="currentColor" stroke="none" />
    </Frame>
  );
}

function SunIcon({ className }: SvgProps) {
  return (
    <Frame name="sun" className={className}>
      <circle cx="12" cy="12" r="3.4" />
      <g className="ki-rays">
        <path d="M12 3.4v1.8M12 18.8v1.8M4.9 4.9l1.3 1.3M17.8 17.8l1.3 1.3M3.4 12h1.8M18.8 12h1.8M4.9 19.1l1.3-1.3M17.8 6.2l1.3-1.3" />
      </g>
    </Frame>
  );
}

function MoonIcon({ className }: SvgProps) {
  return (
    <Frame name="moon" className={className}>
      <path
        className="ki-crescent"
        d="M16.8 14.6A6.6 6.6 0 0 1 9.4 7.2 6.7 6.7 0 1 0 16.8 14.6z"
      />
    </Frame>
  );
}

function MonitorIcon({ className }: SvgProps) {
  return (
    <Frame name="monitor" className={className}>
      <rect x="3.2" y="4.2" width="17.6" height="12.2" rx="2" />
      <path className="ki-screen" d="M6.2 7.2h11.6v6.2H6.2z" />
      <path d="M8.4 20.6h7.2" />
      <path d="M12 16.4v4.2" />
    </Frame>
  );
}

function FileIcon({ className }: SvgProps) {
  return (
    <Frame name="file" className={className}>
      <path d="M14.2 3.4H7.2A1.8 1.8 0 0 0 5.4 5.2v13.6A1.8 1.8 0 0 0 7.2 20.6h9.6a1.8 1.8 0 0 0 1.8-1.8V9.2z" />
      <path className="ki-fold" d="M14.2 3.4v5.8h5.8" />
    </Frame>
  );
}

function WrenchIcon({ className }: SvgProps) {
  return (
    <Frame name="wrench" className={className}>
      <g className="ki-wrench">
        <path d="M14.6 6.4a3.6 3.6 0 0 0-4.8 4.8l-6 6a1.7 1.7 0 0 0 2.4 2.4l6-6a3.6 3.6 0 0 0 4.8-4.8l-2.2 2.2-2.4-2.4z" />
      </g>
    </Frame>
  );
}

function PhoneTransferIcon({ className }: SvgProps) {
  return (
    <Frame name="phone-transfer" className={className}>
      <g className="ki-handset">
        <path d="M7.4 9.2c.6-.6 1.5-.5 2 .3l.7 1.2c.3.5.1 1-.3 1.3l-.7.6c.6 1.3 1.6 2.3 2.9 2.9l.6-.7c.3-.4.8-.6 1.3-.3l1.2.7c.8.5.9 1.4.3 2l-.6.6c-.6.6-1.6.7-2.4.4-2.2-.8-4.2-2.5-5.6-4.7-.6-1.1-.4-2.1.4-2.9z" />
      </g>
      <g className="ki-xfer">
        <path d="M13.6 5.2h6.4" />
        <path d="M17.4 2.8 20.2 5.2 17.4 7.6" />
      </g>
    </Frame>
  );
}

function CheckSquareIcon({ className }: SvgProps) {
  return (
    <Frame name="check-square" className={className}>
      <rect x="3.6" y="3.6" width="16.8" height="16.8" rx="2.2" />
      <path className="ki-check" d="M8 12.2 10.7 15l5.4-6.4" />
    </Frame>
  );
}

function PlusIcon({ className }: SvgProps) {
  return (
    <Frame name="plus" className={className}>
      <g className="ki-plus">
        <path d="M12 5.2v13.6" />
        <path d="M5.2 12h13.6" />
      </g>
    </Frame>
  );
}

function ClockIcon({ className }: SvgProps) {
  return (
    <Frame name="clock" className={className}>
      <circle cx="12" cy="12" r="8.4" />
      <path className="ki-hour" d="M12 7.4V12" />
      <path className="ki-minute" d="M12 12l4.2 2.4" />
    </Frame>
  );
}

function CopyIcon({ className }: SvgProps) {
  return (
    <Frame name="copy" className={className}>
      <rect x="8.2" y="8.2" width="11.4" height="11.4" rx="1.8" />
      <path className="ki-back" d="M6.2 15.6H5.4A1.8 1.8 0 0 1 3.6 13.8V5.4A1.8 1.8 0 0 1 5.4 3.6h8.4A1.8 1.8 0 0 1 15.6 5.4v.8" />
    </Frame>
  );
}

function WalletIcon({ className }: SvgProps) {
  return (
    <Frame name="wallet" className={className}>
      <rect x="3.6" y="6.4" width="16.8" height="13.2" rx="2.2" />
      <path d="M3.6 9.6h16.8" />
      <circle className="ki-coin" cx="16.4" cy="14.6" r="1.15" fill="currentColor" stroke="none" />
    </Frame>
  );
}

function PlugIcon({ className }: SvgProps) {
  return (
    <Frame name="plug" className={className}>
      <g className="ki-plug-a">
        <path d="M9.5 3.6v4.2" />
        <path d="M13 3.6v4.2" />
        <path d="M7.4 7.8h7.2a1 1 0 0 1 1 1v1.6a4.6 4.6 0 0 1-4.6 4.6 4.6 4.6 0 0 1-4.6-4.6V8.8a1 1 0 0 1 1-1Z" />
      </g>
      <g className="ki-plug-b">
        <path d="M11.2 15v2.4" />
        <path d="M8 20.4l3.2-3 3.2 3" />
      </g>
      <circle className="ki-spark" cx="17.6" cy="6.4" r="1" />
    </Frame>
  );
}

const ICONS: Record<KupeIconName, (props: SvgProps) => ReactElement> = {
  home: HomeIcon,
  robot: RobotIcon,
  book: BookIcon,
  wave: WaveIcon,
  phone: PhoneIcon,
  inbound: InboundIcon,
  "outbound-phone": OutboundPhoneIcon,
  megaphone: MegaphoneIcon,
  code: CodeIcon,
  bars: BarsIcon,
  "line-chart": LineChartIcon,
  gear: GearIcon,
  folder: FolderIcon,
  upload: UploadIcon,
  braces: BracesIcon,
  ban: BanIcon,
  key: KeyIcon,
  layers: LayersIcon,
  user: UserIcon,
  users: UsersIcon,
  building: BuildingIcon,
  search: SearchIcon,
  "search-x": SearchXIcon,
  palette: PaletteIcon,
  sun: SunIcon,
  moon: MoonIcon,
  monitor: MonitorIcon,
  file: FileIcon,
  wrench: WrenchIcon,
  "phone-transfer": PhoneTransferIcon,
  "check-square": CheckSquareIcon,
  plus: PlusIcon,
  clock: ClockIcon,
  copy: CopyIcon,
  plug: PlugIcon,
  wallet: WalletIcon,
};

export function KupeIcon({
  name,
  className,
}: {
  name: KupeIconName;
  className?: string;
}) {
  const Icon = ICONS[name];
  if (!Icon) return null;
  return <Icon className={cn("size-4 shrink-0", className)} />;
}
