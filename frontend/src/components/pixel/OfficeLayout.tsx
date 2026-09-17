import React from 'react';

// ─── REUSABLE MODERN FURNITURE & CABIN COMPONENTS ─────────────────────────────

// High-tech curved corner modern cabin desk
export const CabinDesk: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  label?: string;
  hasMonitors?: number; // 0, 1, 2, or 3 monitors
  monitorTheme?: 'code' | 'terminal' | 'charts' | 'server';
  hasLamp?: boolean;
  hasMug?: boolean;
  hasKeyboard?: boolean;
}> = ({
  x,
  y,
  w = 140,
  h = 65,
  label,
  hasMonitors = 1,
  monitorTheme = 'code',
  hasLamp = false,
  hasMug = true,
  hasKeyboard = true,
}) => (
  <g transform={`translate(${x}, ${y})`}>
    {/* Desk Soft Ambient Shadow */}
    <rect x="4" y="6" width={w} height={h} rx="8" fill="#0f172a" opacity="0.25" />
    {/* Desk Main Surface (Modern matte oak / slate wood finish) */}
    <rect x="0" y="0" width={w} height={h} rx="7" fill="#e2d9cc" stroke="#b0a290" strokeWidth="2" />
    {/* Subtle chamfer highlight */}
    <rect x="3" y="3" width={w - 6} height="7" rx="3" fill="#f5ede2" opacity="0.8" />

    {/* Desk Mat (dark leather workspace pad) */}
    <rect x={w / 2 - 45} y="18" width="90" height={h - 24} rx="4" fill="#334155" opacity="0.9" />

    {/* Keyboard & Mouse */}
    {hasKeyboard && (
      <g transform={`translate(${w / 2 - 28}, ${h - 22})`}>
        {/* Keyboard base */}
        <rect x="0" y="0" width="42" height="13" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="1" />
        {/* Key rows */}
        <line x1="4" y1="4" x2="38" y2="4" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 2" />
        <line x1="4" y1="7" x2="38" y2="7" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 2" />
        <line x1="12" y1="10" x2="30" y2="10" stroke="#cbd5e1" strokeWidth="1.5" />
        {/* Mouse */}
        <ellipse cx="50" cy="6" rx="4" ry="6" fill="#1e293b" stroke="#475569" strokeWidth="1" />
      </g>
    )}

    {/* Coffee Mug */}
    {hasMug && (
      <g transform={`translate(${w - 22}, 22)`}>
        <circle cx="6" cy="6" r="6" fill="#0284c7" stroke="#0369a1" strokeWidth="1" />
        <circle cx="6" cy="6" r="4.5" fill="#382110" />
        <path d="M 12 3 Q 16 6 12 9" fill="none" stroke="#0284c7" strokeWidth="1.5" />
      </g>
    )}

    {/* Desk Lamp */}
    {hasLamp && (
      <g transform={`translate(12, 10)`}>
        <ellipse cx="6" cy="6" rx="6" ry="4" fill="#64748b" />
        <line x1="6" y1="6" x2="10" y2="-4" stroke="#94a3b8" strokeWidth="2.5" />
        <path d="M 6 -8 L 18 -4 L 14 -12 Z" fill="#f59e0b" />
        <ellipse cx="12" cy="10" rx="14" ry="8" fill="#fef08a" opacity="0.3" />
      </g>
    )}

    {/* Monitors */}
    {hasMonitors === 1 && (
      <g transform={`translate(${w / 2 - 25}, 4)`}>
        {/* Stand */}
        <rect x="20" y="16" width="10" height="4" rx="1" fill="#475569" />
        <line x1="25" y1="16" x2="25" y2="12" stroke="#64748b" strokeWidth="3" />
        {/* Bezel */}
        <rect x="0" y="0" width="50" height="24" rx="3" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
        {/* Screen */}
        <rect x="2" y="2" width="46" height="20" rx="1" fill="#090d16" />
        {/* Screen Content */}
        {monitorTheme === 'code' && (
          <g>
            <rect x="5" y="5" width="22" height="2" fill="#38bdf8" />
            <rect x="5" y="9" width="34" height="2" fill="#34d399" />
            <rect x="8" y="13" width="26" height="2" fill="#a78bfa" />
            <rect x="5" y="17" width="18" height="2" fill="#f43f5e" />
          </g>
        )}
        {monitorTheme === 'terminal' && (
          <g>
            <rect x="5" y="5" width="12" height="2" fill="#4ade80" />
            <rect x="5" y="9" width="38" height="2" fill="#4ade80" opacity="0.8" />
            <rect x="5" y="13" width="28" height="2" fill="#4ade80" opacity="0.6" />
            <rect x="5" y="17" width="6" height="2" fill="#4ade80">
              <animate attributeName="opacity" values="1;0;1" dur="0.8s" repeatCount="indefinite" />
            </rect>
          </g>
        )}
        {monitorTheme === 'charts' && (
          <g>
            <rect x="6" y="14" width="6" height="6" fill="#38bdf8" />
            <rect x="14" y="10" width="6" height="10" fill="#34d399" />
            <rect x="22" y="6" width="6" height="14" fill="#fbbf24" />
            <rect x="30" y="12" width="6" height="8" fill="#f43f5e" />
            <path d="M 6 12 Q 18 6 38 8" fill="none" stroke="#a855f7" strokeWidth="1.5" />
          </g>
        )}
        {monitorTheme === 'server' && (
          <g>
            <circle cx="8" cy="8" r="2" fill="#22c55e" />
            <circle cx="8" cy="14" r="2" fill="#22c55e" />
            <rect x="14" y="6" width="28" height="4" rx="1" fill="#1e293b" />
            <rect x="14" y="12" width="28" height="4" rx="1" fill="#1e293b" />
          </g>
        )}
      </g>
    )}

    {hasMonitors === 2 && (
      <g transform={`translate(${w / 2 - 46}, 4)`}>
        {/* Left Monitor */}
        <g transform="rotate(-6 20 12)">
          <rect x="0" y="0" width="42" height="22" rx="2" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
          <rect x="2" y="2" width="38" height="18" rx="1" fill="#090d16" />
          <rect x="5" y="5" width="28" height="2" fill="#38bdf8" />
          <rect x="5" y="9" width="20" height="2" fill="#34d399" />
          <rect x="5" y="13" width="32" height="2" fill="#fbbf24" />
        </g>
        {/* Right Monitor */}
        <g transform="translate(48, 0) rotate(6 20 12)">
          <rect x="0" y="0" width="42" height="22" rx="2" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
          <rect x="2" y="2" width="38" height="18" rx="1" fill="#090d16" />
          <rect x="5" y="5" width="18" height="2" fill="#a78bfa" />
          <rect x="5" y="9" width="30" height="2" fill="#38bdf8" />
          <rect x="5" y="13" width="14" height="2" fill="#34d399" />
        </g>
      </g>
    )}

    {/* Desk Role/User Label on edge */}
    {label && (
      <text
        x={w / 2}
        y={h - 4}
        textAnchor="middle"
        fontSize="9.5"
        fontWeight="bold"
        fill="#64748b"
        fontFamily="system-ui, monospace"
      >
        {label}
      </text>
    )}
  </g>
);

// Modern ergonomic office swivel chair
export const ModernChair: React.FC<{ x: number; y: number; color?: string; facing?: 'up' | 'down' | 'left' | 'right' }> = ({
  x,
  y,
  color = '#334155',
  facing = 'up',
}) => {
  const rot = facing === 'down' ? 180 : facing === 'left' ? -90 : facing === 'right' ? 90 : 0;
  return (
    <g transform={`translate(${x}, ${y}) rotate(${rot})`}>
      {/* 5-star caster base */}
      <circle cx="0" cy="0" r="16" fill="none" stroke="#64748b" strokeWidth="2.5" strokeDasharray="4 6" opacity="0.6" />
      {/* Seat cushion */}
      <rect x="-14" y="-12" width="28" height="24" rx="8" fill={color} stroke="#1e293b" strokeWidth="2" />
      <rect x="-10" y="-8" width="20" height="16" rx="5" fill="#475569" opacity="0.35" />
      {/* Backrest */}
      <rect x="-13" y="8" width="26" height="6" rx="3" fill="#1e293b" />
      {/* Armrests */}
      <rect x="-17" y="-7" width="4" height="14" rx="2" fill="#1e293b" />
      <rect x="13" y="-7" width="4" height="14" rx="2" fill="#1e293b" />
    </g>
  );
};

// Acoustic Glass Partition Wall for Team Cabins
export const CabinPartition: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  badgeColor?: string;
  sublabel?: string;
}> = ({ x, y, w, h, title, badgeColor = '#38bdf8', sublabel }) => (
  <g>
    {/* Cabin Floor Area / Carpet Pad */}
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx="12"
      fill="#fdfbf7"
      stroke="#d6cbbe"
      strokeWidth="2.5"
      filter="drop-shadow(0 4px 6px rgba(0,0,0,0.04))"
    />

    {/* Cabin Top Header Banner / Partition Border */}
    <rect x={x} y={y} width={w} height="32" rx="10" fill="#1e293b" />
    <rect x={x} y={y + 20} width={w} height="12" fill="#1e293b" />

    {/* Color accent strip */}
    <rect x={x} y={y} width={w} height="4" rx="2" fill={badgeColor} />

    {/* Title Text */}
    <text
      x={x + 16}
      y={y + 21}
      fill="#ffffff"
      fontSize="12"
      fontWeight="900"
      fontFamily="system-ui, -apple-system, sans-serif"
      letterSpacing="0.8px"
    >
      {title}
    </text>

    {sublabel && (
      <text
        x={x + w - 16}
        y={y + 21}
        textAnchor="end"
        fill="#94a3b8"
        fontSize="10"
        fontFamily="monospace"
        fontWeight="600"
      >
        {sublabel}
      </text>
    )}

    {/* Vertical frosted glass partitions inside cabin if needed */}
    <line x1={x + w / 2} y1={y + 36} x2={x + w / 2} y2={y + h - 12} stroke="#cbd5e1" strokeWidth="2" strokeDasharray="6 4" opacity="0.6" />
  </g>
);

// ─── LEFT WING ROOMS ─────────────────────────────────────────────────────────

// 1. MEETING ROOM (Top Left)
export const MeetingRoomArea: React.FC = () => (
  <g id="meeting-room-area">
    {/* Floor / Room boundary */}
    <rect
      x="25"
      y="80"
      width="535"
      height="280"
      rx="14"
      fill="#f1f5f9"
      stroke="#38bdf8"
      strokeWidth="3"
      filter="drop-shadow(0 6px 12px rgba(0,0,0,0.06))"
    />

    {/* Header bar */}
    <rect x="25" y="80" width="535" height="30" rx="10" fill="#0f172a" />
    <rect x="25" y="100" width="535" height="10" fill="#0f172a" />
    <rect x="25" y="80" width="535" height="4" fill="#38bdf8" />
    <text x="45" y="101" fill="#38bdf8" fontSize="12" fontWeight="900" fontFamily="system-ui">
      🏛️ EXECUTIVE BOARDROOM &amp; STRATEGY SUITE
    </text>
    <text x="540" y="101" textAnchor="end" fill="#94a3b8" fontSize="10" fontFamily="monospace">
      LEADERSHIP DISCUSSION &amp; SPRINT PLANNING
    </text>

    {/* ── BIG SCREEN PRESENTATION TV (Mounted on wall behind PM) ── */}
    <g transform="translate(190, 118)">
      {/* TV Frame */}
      <rect x="0" y="0" width="200" height="84" rx="6" fill="#020617" stroke="#334155" strokeWidth="2.5" />
      {/* Screen */}
      <rect x="4" y="4" width="192" height="76" rx="4" fill="#090d16" />
      {/* TV Glow */}
      <rect x="4" y="4" width="192" height="76" rx="4" fill="#38bdf8" fillOpacity="0.06" />

      {/* Screen Content: Sprint Roadmap & System Graph */}
      <text x="12" y="18" fill="#38bdf8" fontSize="9" fontWeight="bold" fontFamily="monospace">
        ⚡ SPRINT 42: AGENTIC ARCHITECTURE
      </text>
      <line x1="12" y1="23" x2="180" y2="23" stroke="#334155" strokeWidth="1" />

      {/* Architecture nodes on TV screen */}
      <rect x="15" y="30" width="42" height="22" rx="3" fill="#1e293b" stroke="#38bdf8" strokeWidth="1" />
      <text x="36" y="44" textAnchor="middle" fill="#7dd3fc" fontSize="7" fontWeight="bold">Jira BA</text>

      <line x1="57" y1="41" x2="75" y2="41" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="2 2" />

      <rect x="75" y="30" width="44" height="22" rx="3" fill="#1e293b" stroke="#34d399" strokeWidth="1" />
      <text x="97" y="44" textAnchor="middle" fill="#86efac" fontSize="7" fontWeight="bold">Arch Graph</text>

      <line x1="119" y1="41" x2="137" y2="41" stroke="#34d399" strokeWidth="1.5" />

      <rect x="137" y="30" width="46" height="22" rx="3" fill="#1e293b" stroke="#f59e0b" strokeWidth="1" />
      <text x="160" y="44" textAnchor="middle" fill="#fde047" fontSize="7" fontWeight="bold">Sprint Dev</text>

      {/* Metrics mini bar at bottom of TV */}
      <rect x="105" y="60" width="78" height="12" rx="2" fill="#0f172a" />
      <text x="110" y="69" fill="#a855f7" fontSize="7" fontFamily="monospace">Milestones: 8/8</text>
    </g>

    {/* Standing podium / presenter spot indicator under PM */}
    <ellipse cx="290" cy="216" rx="24" ry="10" fill="#38bdf8" fillOpacity="0.15" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 3" />
    <text x="290" y="219" textAnchor="middle" fill="#0284c7" fontSize="7.5" fontWeight="bold" fontFamily="monospace">
      PRESENTER ZONE
    </text>

    {/* ── LUXURY MAHOGANY CONFERENCE TABLE ── */}
    <g transform="translate(145, 238)">
      {/* Table shadow */}
      <ellipse cx="145" cy="46" rx="148" ry="44" fill="#0f172a" opacity="0.15" />
      {/* Table Top */}
      <ellipse cx="145" cy="42" rx="145" ry="42" fill="#854d0e" stroke="#713f12" strokeWidth="3" />
      {/* Wood grain ring */}
      <ellipse cx="145" cy="42" rx="135" ry="34" fill="#a16207" opacity="0.7" />
      {/* Center cable/AV well */}
      <rect x="85" y="34" width="120" height="16" rx="6" fill="#1e293b" stroke="#334155" strokeWidth="1" />
      {/* Teleconference Puck / mic */}
      <circle cx="145" cy="42" r="5" fill="#0f172a" stroke="#22c55e" strokeWidth="1" />

      {/* Laptops and water glasses for attendees */}
      <rect x="45" y="32" width="22" height="14" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
      <rect x="135" y="24" width="20" height="14" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
      <rect x="225" y="32" width="22" height="14" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
    </g>

    {/* Executive Conference Chairs (Facing UP towards PM & TV!) */}
    <ModernChair x={210} y={328} color="#1e293b" facing="up" />
    <ModernChair x={290} y={335} color="#1e293b" facing="up" />
    <ModernChair x={370} y={328} color="#1e293b" facing="up" />

    {/* Whiteboard on side wall */}
    <g transform="translate(45, 140)">
      <rect x="0" y="0" width="70" height="90" rx="4" fill="#ffffff" stroke="#94a3b8" strokeWidth="2" />
      <rect x="4" y="4" width="62" height="82" fill="#f8fafc" />
      <text x="35" y="16" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#334155">ACTION ITEMS</text>
      <line x1="8" y1="22" x2="62" y2="22" stroke="#cbd5e1" strokeWidth="1" />
      <rect x="10" y="28" width="8" height="8" fill="#fde047" />
      <rect x="10" y="42" width="8" height="8" fill="#86efac" />
      <rect x="10" y="56" width="8" height="8" fill="#93c5fd" />
      <line x1="22" y1="32" x2="58" y2="32" stroke="#64748b" strokeWidth="1.5" />
      <line x1="22" y1="46" x2="52" y2="46" stroke="#64748b" strokeWidth="1.5" />
      <line x1="22" y1="60" x2="55" y2="60" stroke="#64748b" strokeWidth="1.5" />
    </g>

    {/* Potted luxury office plant */}
    <g transform="translate(490, 160)">
      <ellipse cx="14" cy="40" rx="12" ry="6" fill="#0f172a" opacity="0.2" />
      <rect x="4" y="24" width="20" height="18" rx="3" fill="#b45309" />
      <ellipse cx="14" cy="16" rx="18" ry="14" fill="#15803d" />
      <ellipse cx="8" cy="8" rx="12" ry="10" fill="#22c55e" />
      <ellipse cx="20" cy="10" rx="14" ry="10" fill="#16a34a" />
    </g>
  </g>
);

// 2. GAMING ROOM (Middle Left)
export const GamingRoomArea: React.FC = () => (
  <g id="gaming-room-area">
    {/* Room Floor */}
    <rect
      x="25"
      y="375"
      width="535"
      height="235"
      rx="14"
      fill="#131722"
      stroke="#8b5cf6"
      strokeWidth="3"
      filter="drop-shadow(0 6px 12px rgba(0,0,0,0.08))"
    />

    {/* Header bar */}
    <rect x="25" y="375" width="535" height="30" rx="10" fill="#090b10" />
    <rect x="25" y="395" width="535" height="10" fill="#090b10" />
    <rect x="25" y="375" width="535" height="4" fill="#a855f7" />
    <text x="45" y="396" fill="#c084fc" fontSize="12" fontWeight="900" fontFamily="system-ui">
      🎮 RETRO ARCADE &amp; GAMING LOUNGE
    </text>
    <text x="540" y="396" textAnchor="end" fill="#e879f9" fontSize="10" fontFamily="monospace">
      IDLE AGENTS RELAX &amp; PLAY HERE
    </text>

    {/* Neon carpet runner in gaming room */}
    <rect x="45" y="420" width="495" height="175" rx="8" fill="#1e1b4b" stroke="#4c1d95" strokeWidth="1.5" />
    {/* Neon grid pattern */}
    <line x1="45" y1="465" x2="540" y2="465" stroke="#a855f7" strokeWidth="0.8" opacity="0.3" />
    <line x1="45" y1="510" x2="540" y2="510" stroke="#a855f7" strokeWidth="0.8" opacity="0.3" />
    <line x1="45" y1="555" x2="540" y2="555" stroke="#a855f7" strokeWidth="0.8" opacity="0.3" />

    {/* ── ARCADE CABINET 1 (Pac-Man / Space Invaders style) ── */}
    <g transform="translate(75, 425)">
      {/* Cabinet Body */}
      <path d="M 0 0 L 48 0 L 48 85 L 0 85 Z" fill="#4c0519" stroke="#be123c" strokeWidth="2" />
      {/* Marquee */}
      <rect x="4" y="4" width="40" height="14" rx="2" fill="#fb7185" />
      <text x="24" y="14" textAnchor="middle" fill="#881337" fontSize="7" fontWeight="bold" fontFamily="monospace">PAC-BOT</text>
      {/* Screen */}
      <rect x="4" y="22" width="40" height="34" rx="3" fill="#020617" stroke="#f43f5e" strokeWidth="1" />
      {/* Screen animation: Pixel ghost and dots */}
      <circle cx="16" cy="38" r="4" fill="#fbbf24" />
      <path d="M 30 34 C 28 34 26 36 26 40 L 34 40 Z" fill="#38bdf8">
        <animate attributeName="opacity" values="1;0.4;1" dur="1s" repeatCount="indefinite" />
      </path>
      {/* Joystick & Buttons Deck */}
      <rect x="4" y="58" width="40" height="18" fill="#1e1b4b" />
      <circle cx="14" cy="67" r="3" fill="#e11d48" />
      <circle cx="26" cy="65" r="2.5" fill="#38bdf8" />
      <circle cx="34" cy="69" r="2.5" fill="#22c55e" />
      {/* Coin slot */}
      <rect x="18" y="79" width="12" height="4" fill="#0f172a" />
    </g>

    {/* ── ARCADE CABINET 2 (Cyber racer style) ── */}
    <g transform="translate(155, 425)">
      <path d="M 0 0 L 48 0 L 48 85 L 0 85 Z" fill="#082f49" stroke="#0284c7" strokeWidth="2" />
      <rect x="4" y="4" width="40" height="14" rx="2" fill="#38bdf8" />
      <text x="24" y="14" textAnchor="middle" fill="#0c4a6e" fontSize="7" fontWeight="bold" fontFamily="monospace">TURBO 2D</text>
      <rect x="4" y="22" width="40" height="34" rx="3" fill="#020617" stroke="#38bdf8" strokeWidth="1" />
      {/* Racing road graphics on screen */}
      <polygon points="12,52 24,28 28,28 36,52" fill="#334155" />
      <line x1="24" y1="52" x2="26" y2="28" stroke="#facc15" strokeWidth="1.5" strokeDasharray="3 3" />
      <rect x="4" y="58" width="40" height="18" fill="#0f172a" />
      <circle cx="16" cy="67" r="4" fill="#38bdf8" />
      <circle cx="30" cy="67" r="2.5" fill="#f43f5e" />
    </g>

    {/* ── CONSOLE GAMING TV & SOFA BENCH ── */}
    <g transform="translate(255, 425)">
      {/* Big TV on stand */}
      <rect x="0" y="0" width="100" height="52" rx="4" fill="#090d16" stroke="#475569" strokeWidth="2" />
      <rect x="3" y="3" width="94" height="46" rx="2" fill="#020617" />
      <text x="50" y="24" textAnchor="middle" fill="#a855f7" fontSize="8" fontWeight="bold" fontFamily="monospace">
        MARIO KART AGENT
      </text>
      <rect x="42" y="52" width="16" height="8" fill="#334155" />
      <rect x="30" y="60" width="40" height="4" rx="1" fill="#475569" />
    </g>

    {/* Gaming Beanbag chairs */}
    <g transform="translate(265, 520)">
      <ellipse cx="20" cy="20" rx="24" ry="18" fill="#4338ca" stroke="#6366f1" strokeWidth="2" />
      <ellipse cx="20" cy="16" rx="16" ry="10" fill="#6366f1" opacity="0.4" />
    </g>
    <g transform="translate(345, 520)">
      <ellipse cx="20" cy="20" rx="24" ry="18" fill="#0d9488" stroke="#14b8a6" strokeWidth="2" />
      <ellipse cx="20" cy="16" rx="16" ry="10" fill="#14b8a6" opacity="0.4" />
    </g>

    {/* ── FOOSBALL / PING PONG TABLE ── */}
    <g transform="translate(425, 450)">
      <rect x="4" y="6" width="90" height="60" rx="6" fill="#000000" opacity="0.3" />
      <rect x="0" y="0" width="90" height="60" rx="5" fill="#15803d" stroke="#14532d" strokeWidth="2.5" />
      {/* Table markings */}
      <rect x="4" y="4" width="82" height="52" fill="#16a34a" />
      <line x1="45" y1="4" x2="45" y2="56" stroke="#ffffff" strokeWidth="1.5" />
      <circle cx="45" cy="30" r="10" fill="none" stroke="#ffffff" strokeWidth="1.5" />
      {/* Foosball rods */}
      <line x1="18" y1="-4" x2="18" y2="64" stroke="#94a3b8" strokeWidth="2" />
      <line x1="32" y1="-4" x2="32" y2="64" stroke="#94a3b8" strokeWidth="2" />
      <line x1="58" y1="-4" x2="58" y2="64" stroke="#94a3b8" strokeWidth="2" />
      <line x1="72" y1="-4" x2="72" y2="64" stroke="#94a3b8" strokeWidth="2" />
      {/* Tiny players */}
      <circle cx="18" cy="20" r="3" fill="#ef4444" />
      <circle cx="18" cy="40" r="3" fill="#ef4444" />
      <circle cx="72" cy="20" r="3" fill="#3b82f6" />
      <circle cx="72" cy="40" r="3" fill="#3b82f6" />
    </g>
  </g>
);

// 3. RESTING & CAFE AREA (Bottom Left)
export const RestingAreaArea: React.FC = () => (
  <g id="resting-area">
    {/* Floor / Room boundary */}
    <rect
      x="25"
      y="625"
      width="535"
      height="255"
      rx="14"
      fill="#fdfbf7"
      stroke="#10b981"
      strokeWidth="3"
      filter="drop-shadow(0 6px 12px rgba(0,0,0,0.06))"
    />

    {/* Header bar */}
    <rect x="25" y="625" width="535" height="30" rx="10" fill="#064e3b" />
    <rect x="25" y="645" width="535" height="10" fill="#064e3b" />
    <rect x="25" y="625" width="535" height="4" fill="#34d399" />
    <text x="45" y="646" fill="#6ee7b7" fontSize="12" fontWeight="900" fontFamily="system-ui">
      ☕ RECHARGE LOUNGE, CAFE &amp; HYDRATION HUB
    </text>
    <text x="540" y="646" textAnchor="end" fill="#a7f3d0" fontSize="10" fontFamily="monospace">
      WATER DISPENSER, SOFA &amp; WELLNESS
    </text>

    {/* Cozy warm wool carpet */}
    <rect x="50" y="670" width="485" height="195" rx="10" fill="#fef3c7" stroke="#fde68a" strokeWidth="2" />

    {/* ── WATER DISPENSER AREA (Water Dispensing Station) ── */}
    <g transform="translate(75, 685)">
      {/* Shadow */}
      <ellipse cx="20" cy="88" rx="18" ry="6" fill="#000000" opacity="0.15" />
      {/* Dispenser Body */}
      <rect x="6" y="32" width="28" height="54" rx="4" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
      {/* Inverted Blue Water Bottle on top */}
      <ellipse cx="20" cy="18" rx="12" ry="16" fill="#38bdf8" stroke="#0284c7" strokeWidth="1.5" />
      {/* Water bubbles in bottle */}
      <circle cx="16" cy="16" r="2" fill="#ffffff" opacity="0.8">
        <animate attributeName="cy" values="24;10;24" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="23" cy="20" r="1.5" fill="#ffffff" opacity="0.8">
        <animate attributeName="cy" values="26;12;26" dur="1.6s" repeatCount="indefinite" />
      </circle>
      {/* Dispenser taps & drip tray */}
      <rect x="12" y="44" width="4" height="6" fill="#ef4444" />
      <rect x="24" y="44" width="4" height="6" fill="#3b82f6" />
      <rect x="10" y="56" width="20" height="4" rx="1" fill="#94a3b8" />
      {/* Label */}
      <text x="20" y="74" textAnchor="middle" fill="#0284c7" fontSize="6.5" fontWeight="bold" fontFamily="monospace">
        PURE H2O
      </text>
    </g>

    {/* ── PREMIUM SECTIONAL SOFA ── */}
    <g transform="translate(160, 715)">
      {/* Sofa Shadow */}
      <rect x="4" y="6" width="220" height="74" rx="16" fill="#000000" opacity="0.12" />
      {/* Sofa Backrest */}
      <rect x="0" y="0" width="220" height="28" rx="12" fill="#0284c7" stroke="#0369a1" strokeWidth="2" />
      {/* Sofa Seat Cushion */}
      <rect x="0" y="22" width="220" height="52" rx="10" fill="#38bdf8" stroke="#0284c7" strokeWidth="1.5" />
      {/* Cushion dividers */}
      <line x1="73" y1="22" x2="73" y2="74" stroke="#0284c7" strokeWidth="2" />
      <line x1="146" y1="22" x2="146" y2="74" stroke="#0284c7" strokeWidth="2" />
      {/* Armrests */}
      <rect x="0" y="10" width="16" height="64" rx="8" fill="#0369a1" />
      <rect x="204" y="10" width="16" height="64" rx="8" fill="#0369a1" />
      {/* Throw pillows */}
      <rect x="20" y="24" width="18" height="18" rx="4" fill="#facc15" transform="rotate(10 20 24)" />
      <rect x="180" y="24" width="18" height="18" rx="4" fill="#f43f5e" transform="rotate(-10 180 24)" />
    </g>

    {/* ── COFFEE TABLE IN FRONT OF SOFA ── */}
    <g transform="translate(200, 805)">
      <ellipse cx="70" cy="18" rx="68" ry="16" fill="#000000" opacity="0.12" />
      <ellipse cx="70" cy="16" rx="66" ry="15" fill="#d97706" stroke="#b45309" strokeWidth="2" />
      {/* Tech Magazine */}
      <rect x="40" y="10" width="22" height="12" rx="1" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" transform="rotate(-12 40 10)" />
      <text x="44" y="18" fontSize="5" fill="#0f172a" fontWeight="bold">AI TECH</text>
      {/* Coffee Mugs */}
      <circle cx="85" cy="16" r="4" fill="#ef4444" />
      <circle cx="102" cy="14" r="4" fill="#10b981" />
    </g>

    {/* ── ESPRESSO BAR & SNACK COUNTER ── */}
    <g transform="translate(415, 685)">
      <rect x="0" y="0" width="105" height="65" rx="6" fill="#451a03" stroke="#78350f" strokeWidth="2" />
      <rect x="3" y="3" width="99" height="10" fill="#92400e" />
      {/* Espresso Machine */}
      <rect x="12" y="18" width="36" height="34" rx="3" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
      <rect x="16" y="24" width="28" height="8" rx="1" fill="#38bdf8" opacity="0.8" />
      {/* Steam rising */}
      <path d="M 26 14 Q 28 8 26 4" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="2 2" />
      <path d="M 32 14 Q 34 8 32 4" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="2 2" />
      {/* Fruit bowl */}
      <ellipse cx="78" cy="35" rx="16" ry="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
      <circle cx="74" cy="32" r="4" fill="#ea580c" />
      <circle cx="82" cy="32" r="4" fill="#84cc16" />
      <circle cx="78" cy="28" r="4" fill="#eab308" />
      {/* Sign */}
      <text x="52" y="60" textAnchor="middle" fill="#fde68a" fontSize="7" fontWeight="bold" fontFamily="monospace">
        CAFE STATION
      </text>
    </g>
  </g>
);

// ─── MAIN COMPLETE OFFICE LAYOUT (1800 × 900 SVG) ─────────────────────────────
export const OfficeLayout: React.FC = () => {
  return (
    <g id="master-office-layout">
      <defs>
        {/* Modern Warm Oak Parquet Floor Pattern */}
        <pattern id="oak-parquet" width="60" height="60" patternUnits="userSpaceOnUse">
          <rect width="60" height="60" fill="#ece4d8" />
          <rect x="0" y="0" width="30" height="30" fill="#e6dcce" />
          <rect x="30" y="30" width="30" height="30" fill="#e6dcce" />
          <line x1="0" y1="0" x2="60" y2="0" stroke="#d5c8b5" strokeWidth="1" />
          <line x1="0" y1="30" x2="60" y2="30" stroke="#d5c8b5" strokeWidth="1" />
          <line x1="0" y1="0" x2="0" y2="60" stroke="#d5c8b5" strokeWidth="1" />
          <line x1="30" y1="0" x2="30" y2="60" stroke="#d5c8b5" strokeWidth="1" />
        </pattern>
      </defs>

      {/* ── 1. GLOBAL OFFICE FLOOR ────────────────────────────────────────── */}
      <rect x="0" y="0" width="1800" height="900" fill="url(#oak-parquet)" />

      {/* ── 2. TOP BACK WALL (Dark Architectural Wood with Ambient Lighting) ── */}
      <rect x="0" y="0" width="1800" height="65" fill="#1e293b" />
      <rect x="0" y="60" width="1800" height="8" fill="#0f172a" />
      {/* Wall LED highlight strip */}
      <line x1="0" y1="62" x2="1800" y2="62" stroke="#38bdf8" strokeWidth="2" opacity="0.8" />

      {/* Corporate Building Sign on Back Wall */}
      <g transform="translate(900, 36)">
        <text
          x="0"
          y="0"
          textAnchor="middle"
          fill="#f8fafc"
          fontSize="16"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="3px"
        >
          AGENTFORGE GLOBAL HEADQUARTERS
        </text>
        <text
          x="0"
          y="16"
          textAnchor="middle"
          fill="#38bdf8"
          fontSize="9"
          fontFamily="monospace"
          fontWeight="bold"
          letterSpacing="1.5px"
        >
          AUTONOMOUS MULTI-AGENT WORKSPACE • REAL-TIME LANGGRAPH RUNTIME
        </text>
      </g>

      {/* ── 3. LEFT WING ROOMS (Meeting, Gaming, Resting) ─────────────────── */}
      <MeetingRoomArea />
      <GamingRoomArea />
      <RestingAreaArea />

      {/* ── 4. CENTRAL GLASS ATRIUM / CORRIDOR DIVIDER (x = 570 to 605) ──── */}
      <g transform="translate(575, 75)">
        {/* Glass corridor column */}
        <rect x="0" y="0" width="24" height="810" rx="6" fill="#0f172a" opacity="0.1" />
        <line x1="12" y1="0" x2="12" y2="810" stroke="#38bdf8" strokeWidth="2" strokeDasharray="16 8" opacity="0.5" />

        {/* Ambient wayfinding floor arrows */}
        {[180, 420, 680].map((ay) => (
          <g key={ay} transform={`translate(12, ${ay})`}>
            <circle cx="0" cy="0" r="10" fill="#0f172a" />
            <text x="0" y="4" textAnchor="middle" fill="#38bdf8" fontSize="10" fontWeight="bold">↕</text>
          </g>
        ))}
      </g>

      {/* ── 5. RIGHT WING: 6 DEDICATED TEAM CABIN PODS (Aligned Neatly) ──── */}

      {/* ── ROW 1: LEADERSHIP POD & ENGINEERING TEAM ── */}

      {/* CABIN 1: LEADERSHIP POD (Top Center, x: 615, y: 80, w: 545, h: 255) */}
      <CabinPartition
        x={615}
        y={80}
        w={545}
        h={255}
        title="👑 LEADERSHIP POD (PM, ARCHITECT, BA & JIRA AGENT)"
        badgeColor="#3b82f6"
        sublabel="CABIN 01 • STRATEGY & REQUIREMENTS"
      />
      {/* 4 Cabin Desks for Leadership Pod */}
      <CabinDesk x={635} y={135} w={115} h={60} label="Alex (PM)" monitorTheme="charts" hasLamp />
      <ModernChair x={692} y={222} color="#1d4ed8" facing="up" />

      <CabinDesk x={765} y={135} w={115} h={60} label="Ryan (Team Lead)" monitorTheme="code" hasMonitors={2} />
      <ModernChair x={822} y={222} color="#2563eb" facing="up" />

      <CabinDesk x={895} y={135} w={115} h={60} label="Zara (BA Agent)" monitorTheme="charts" />
      <ModernChair x={952} y={222} color="#0284c7" facing="up" />

      <CabinDesk x={1025} y={135} w={115} h={60} label="Aria (Jira Agent)" monitorTheme="terminal" />
      <ModernChair x={1082} y={222} color="#0369a1" facing="up" />

      {/* CABIN 2: ENGINEERING TEAM (Top Right, x: 1190, y: 80, w: 575, h: 255) */}
      <CabinPartition
        x={1190}
        y={80}
        w={575}
        h={255}
        title="💻 ENGINEERING BULLPEN (1 SENIOR DEV + 2 JUNIOR DEVS)"
        badgeColor="#10b981"
        sublabel="CABIN 02 • CORE DEVELOPMENT & APIS"
      />
      {/* Senior Dev in Center with Triple Monitor Setup */}
      <CabinDesk x={1400} y={130} w={155} h={65} label="Kaelen (Senior Dev)" monitorTheme="code" hasMonitors={2} hasLamp />
      <ModernChair x={1477} y={224} color="#15803d" facing="up" />

      {/* Junior Dev 1 (Left Desk) */}
      <CabinDesk x={1220} y={135} w={140} h={60} label="Leo (Junior Dev 1)" monitorTheme="code" hasMonitors={1} />
      <ModernChair x={1290} y={222} color="#16a34a" facing="up" />

      {/* Junior Dev 2 (Right Desk) */}
      <CabinDesk x={1595} y={135} w={145} h={60} label="Priya (Junior Dev 2)" monitorTheme="code" hasMonitors={1} />
      <ModernChair x={1667} y={222} color="#22c55e" facing="up" />

      {/* ── ROW 2: QA TESTING LAB & INFRA & DEVOPS BAY ── */}

      {/* CABIN 3: QA TESTING LAB (Middle Center, x: 615, y: 360, w: 545, h: 245) */}
      <CabinPartition
        x={615}
        y={360}
        w={545}
        h={245}
        title="🧪 QA AUTOMATION & AUDIT LAB (2 QA AGENTS)"
        badgeColor="#ec4899"
        sublabel="CABIN 03 • TEST SUITES & CODE REVIEW"
      />
      {/* QA Lead Desk */}
      <CabinDesk x={665} y={415} w={180} h={65} label="Sasha (QA Lead)" monitorTheme="terminal" hasMonitors={2} hasLamp />
      <ModernChair x={755} y={510} color="#be185d" facing="up" />

      {/* Junior QA Desk */}
      <CabinDesk x={920} y={415} w={180} h={65} label="Victor (Junior QA)" monitorTheme="code" hasMonitors={1} />
      <ModernChair x={1010} y={510} color="#db2777" facing="up" />

      {/* Bug Tracking Wall Board inside QA */}
      <g transform="translate(640, 520)">
        <rect x="0" y="0" width="120" height="60" rx="3" fill="#ffffff" stroke="#f472b6" strokeWidth="1.5" />
        <rect x="4" y="4" width="112" height="52" fill="#fff1f2" />
        <text x="60" y="16" textAnchor="middle" fontSize="7.5" fontWeight="bold" fill="#be123c">AUTOMATED TEST RUNS</text>
        <rect x="10" y="24" width="70" height="6" rx="2" fill="#22c55e" />
        <text x="85" y="29" fontSize="6.5" fill="#15803d" fontWeight="bold">98.4% PASS</text>
        <rect x="10" y="34" width="40" height="6" rx="2" fill="#ef4444" />
        <text x="55" y="39" fontSize="6.5" fill="#b91c1c" fontWeight="bold">2 FLAKY</text>
      </g>

      {/* CABIN 4: INFRASTRUCTURE & DEVOPS BAY (Middle Right, x: 1190, y: 360, w: 575, h: 245) */}
      <CabinPartition
        x={1190}
        y={360}
        w={575}
        h={245}
        title="⚡ INFRASTRUCTURE, SRE & DEVOPS (2 AGENTS)"
        badgeColor="#f97316"
        sublabel="CABIN 04 • KUBERNETES & INCIDENT SRE"
      />
      {/* DevOps Lead Desk */}
      <CabinDesk x={1220} y={415} w={165} h={65} label="Caleb (DevOps Lead)" monitorTheme="terminal" hasMonitors={2} hasLamp />
      <ModernChair x={1302} y={510} color="#c2410c" facing="up" />

      {/* Infra & SRE Engineer Desk */}
      <CabinDesk x={1415} y={415} w={165} h={65} label="Jaxson (Infra & SRE)" monitorTheme="server" hasMonitors={2} />
      <ModernChair x={1497} y={510} color="#ea580c" facing="up" />

      {/* High-Tech 42U Server Rack inside DevOps Cabin */}
      <g transform="translate(1615, 410)">
        <rect x="0" y="0" width="125" height="175" rx="6" fill="#090d16" stroke="#334155" strokeWidth="2.5" />
        {/* Rack rails */}
        <line x1="12" y1="8" x2="12" y2="167" stroke="#475569" strokeWidth="1" strokeDasharray="2 4" />
        <line x1="113" y1="8" x2="113" y2="167" stroke="#475569" strokeWidth="1" strokeDasharray="2 4" />
        {/* 1U and 2U Servers */}
        {[16, 38, 60, 82, 104, 126, 148].map((sy, i) => (
          <g key={sy} transform={`translate(16, ${sy})`}>
            <rect x="0" y="0" width="93" height="16" rx="2" fill="#1e293b" stroke="#0f172a" strokeWidth="1" />
            <circle cx="8" cy="8" r="2" fill={i % 2 === 0 ? '#22c55e' : '#38bdf8'} />
            <circle cx="16" cy="8" r="2" fill="#22c55e">
              <animate attributeName="opacity" values="1;0.2;1" dur="0.6s" repeatCount="indefinite" />
            </circle>
            <line x1="26" y1="8" x2="70" y2="8" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />
            <rect x="76" y="4" width="12" height="8" rx="1" fill="#0f172a" />
          </g>
        ))}
        {/* Rack Header */}
        <text x="62" y="12" textAnchor="middle" fill="#38bdf8" fontSize="7" fontWeight="bold" fontFamily="monospace">
          K8S PROD-CLUSTER-01
        </text>
      </g>

      {/* ── ROW 3: CUSTOMER SUPPORT & PROJECT ANALYTICS ── */}

      {/* CABIN 5: CUSTOMER SUPPORT TEAM (Bottom Center, x: 615, y: 625, w: 545, h: 245) */}
      <CabinPartition
        x={615}
        y={625}
        w={545}
        h={245}
        title="🎧 CUSTOMER SUPPORT & TRIAGE (1 SENIOR + 1 JUNIOR)"
        badgeColor="#a855f7"
        sublabel="CABIN 05 • LIVE TICKETS & SLA ESCALATION"
      />
      {/* Senior Support Desk */}
      <CabinDesk x={665} y={680} w={180} h={65} label="Maya (Senior Support)" monitorTheme="charts" hasMonitors={2} hasLamp />
      <ModernChair x={755} y={775} color="#7e22ce" facing="up" />

      {/* Junior Support Desk */}
      <CabinDesk x={920} y={680} w={180} h={65} label="Tariq (Junior Support)" monitorTheme="terminal" hasMonitors={1} />
      <ModernChair x={1010} y={775} color="#9333ea" facing="up" />

      {/* Ticket Queue Indicator Wall Display */}
      <g transform="translate(640, 785)">
        <rect x="0" y="0" width="150" height="60" rx="4" fill="#1e1b4b" stroke="#8b5cf6" strokeWidth="1.5" />
        <text x="75" y="16" textAnchor="middle" fill="#c084fc" fontSize="7.5" fontWeight="bold" fontFamily="monospace">
          ZENDESK / JIRA SERVICE QUEUE
        </text>
        <text x="14" y="32" fill="#ffffff" fontSize="7" fontFamily="monospace">Open Tickets: 3</text>
        <text x="14" y="44" fill="#34d399" fontSize="7" fontFamily="monospace">Avg Response: 1.4m</text>
        <text x="14" y="54" fill="#38bdf8" fontSize="7" fontFamily="monospace">CSAT Score: 99.2%</text>
      </g>

      {/* CABIN 6: PROJECT ANALYTICS & SECURITY (Bottom Right, x: 1190, y: 625, w: 575, h: 245) */}
      <CabinPartition
        x={1190}
        y={625}
        w={575}
        h={245}
        title="📊 PROJECT ANALYTICS & SEC OPS (2 AGENTS)"
        badgeColor="#06b6d4"
        sublabel="CABIN 06 • TELEMETRY & SECURITY POSTURE"
      />
      {/* Analytics Lead Desk */}
      <CabinDesk x={1250} y={680} w={190} h={65} label="Cipher (Analytics Lead)" monitorTheme="charts" hasMonitors={2} hasLamp />
      <ModernChair x={1345} y={775} color="#0891b2" facing="up" />

      {/* Big Screen Telemetry Wall Board */}
      <g transform="translate(1480, 675)">
        <rect x="0" y="0" width="255" height="165" rx="6" fill="#090d16" stroke="#0891b2" strokeWidth="2" />
        <rect x="4" y="4" width="247" height="157" rx="4" fill="#020617" />
        <text x="127" y="20" textAnchor="middle" fill="#22d3ee" fontSize="9" fontWeight="bold" fontFamily="monospace">
          GRAFANA & APM TELEMETRY WALL
        </text>
        {/* Metric gauge widgets */}
        <rect x="16" y="30" width="68" height="42" rx="3" fill="#1e293b" />
        <text x="50" y="44" textAnchor="middle" fill="#94a3b8" fontSize="6.5">SYSTEM LOAD</text>
        <text x="50" y="60" textAnchor="middle" fill="#34d399" fontSize="12" fontWeight="bold">0.42</text>

        <rect x="94" y="30" width="68" height="42" rx="3" fill="#1e293b" />
        <text x="128" y="44" textAnchor="middle" fill="#94a3b8" fontSize="6.5">API LATENCY</text>
        <text x="128" y="60" textAnchor="middle" fill="#38bdf8" fontSize="12" fontWeight="bold">38ms</text>

        <rect x="172" y="30" width="68" height="42" rx="3" fill="#1e293b" />
        <text x="206" y="44" textAnchor="middle" fill="#94a3b8" fontSize="6.5">TOKEN COST</text>
        <text x="206" y="60" textAnchor="middle" fill="#fbbf24" fontSize="12" fontWeight="bold">$1.38</text>

        {/* Live Sparkline Graph */}
        <path
          d="M 18 120 Q 50 95 85 110 T 150 85 T 235 98"
          fill="none"
          stroke="#06b6d4"
          strokeWidth="2.5"
        />
        <line x1="16" y1="130" x2="238" y2="130" stroke="#334155" strokeWidth="1" />
        <text x="127" y="148" textAnchor="middle" fill="#64748b" fontSize="7" fontFamily="monospace">
          TOKEN CONSUMPTION OVER LAST 60 MINS
        </text>
      </g>
    </g>
  );
};
