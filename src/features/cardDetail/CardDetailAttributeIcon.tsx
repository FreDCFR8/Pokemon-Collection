import type { ReactNode } from 'react';

import type { CardDetailMetadataIcon } from './cardDetailGallery';

type IconProps = { className?: string };

function EnergyIconBase({ children, className, darkGlyph = false }: IconProps & { children: ReactNode; darkGlyph?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <g fill={darkGlyph ? '#29271f' : '#fff'}>{children}</g>
    </svg>
  );
}

function PsychicEnergyIcon(props: IconProps) {
  return <EnergyIconBase {...props}><path d="M12 5.1a6.9 6.9 0 1 0 6.9 6.9h-3.1a3.8 3.8 0 1 1-3.8-3.8V5.1Zm0 4.8a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Z" /></EnergyIconBase>;
}

function DarknessEnergyIcon(props: IconProps) {
  return <EnergyIconBase {...props}><path d="M15.8 5.2a7.6 7.6 0 1 0 3.1 11.2 6.2 6.2 0 1 1-3.1-11.2Z" /></EnergyIconBase>;
}

function FireEnergyIcon(props: IconProps) {
  return <EnergyIconBase {...props}><path d="M13.2 3.1c.8 3.5-2.2 4.9-2.2 8 0 1.5.8 2.5 2 2.5 2.1 0 3.1-2.4 2.6-4.5 2.8 2.6 4.2 5.1 3.2 7.7A7.1 7.1 0 0 1 5.2 14c0-3.6 2.2-6.2 5.3-8.9-.2 2.3.5 3.7 1.5 4.4-.2-2.4.2-4.6 1.2-6.4Z" /></EnergyIconBase>;
}

function WaterEnergyIcon(props: IconProps) {
  return <EnergyIconBase {...props}><path d="M12 3.2S6.1 10.1 6.1 15a5.9 5.9 0 1 0 11.8 0C17.9 10.1 12 3.2 12 3.2Z" /></EnergyIconBase>;
}

function GrassEnergyIcon(props: IconProps) {
  return <EnergyIconBase {...props}><path d="M20.5 3.8C10.3 4.2 5 8.1 5 14.1c0 3.1 2.2 5.2 5.3 5.2 6.3 0 10.2-5.5 10.2-15.5ZM6 20.8c2.3-5.3 6.4-9.2 11.9-12.3-4.6 4.2-7.7 8.3-9.2 12.3H6Z" /></EnergyIconBase>;
}

function LightningEnergyIcon(props: IconProps) {
  return <EnergyIconBase {...props} darkGlyph><path d="M13.6 2.2 5 13.9h6.8l-1.2 7.9L19 10.1h-6.6l1.2-7.9Z" /></EnergyIconBase>;
}

function ColorlessEnergyIcon(props: IconProps) {
  return <EnergyIconBase {...props}><path d="m12 2.8 2.4 5.1 5.3-2.7-2.7 5.3 5.2 2.4-5.2 2.4 2.7 5.3-5.3-2.7-2.4 5.2-2.4-5.2-5.3 2.7L7 15.3l-5.2-2.4L7 10.5 4.3 5.2l5.3 2.7L12 2.8Z" /></EnergyIconBase>;
}

function FightingEnergyIcon(props: IconProps) {
  return <EnergyIconBase {...props}><path d="M5.1 9.2h2V6.4h2.5v2.8h1V5.5h2.5v3.7h1V6.4h2.5v3.5h1V8h2.3v5.3c0 4.7-2.8 7.3-7.3 7.3-4.8 0-7.5-2.8-7.5-7.7V9.2Zm3.4 4.1c0 2 1.1 3.2 3 3.2h1.2v-2.4h-1.4c-.9 0-1.5-.3-1.8-.8h-1Z" /></EnergyIconBase>;
}

function MetalEnergyIcon(props: IconProps) {
  return <EnergyIconBase {...props}><path fillRule="evenodd" d="m12 3 2.3 2.5 3.4-.4.7 3.3 3 1.7-1.5 3.1 1.5 3.1-3 1.7-.7 3.3-3.4-.4L12 23l-2.3-2.5-3.4.4-.7-3.3-3-1.7 1.5-3.1-1.5-3.1 3-1.7.7-3.3 3.4.4L12 3Zm0 5.2a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2Z" clipRule="evenodd" /></EnergyIconBase>;
}

function FairyEnergyIcon(props: IconProps) {
  return <EnergyIconBase {...props}><path d="m12 3.2 1.8 5 5-1.8-2.5 4.7 4.5 2.9-5.3.9.3 5.3-3.8-3.7-3.8 3.7.3-5.3-5.3-.9 4.5-2.9-2.5-4.7 5 1.8 1.8-5Z" /></EnergyIconBase>;
}

function DragonEnergyIcon(props: IconProps) {
  return <EnergyIconBase {...props} darkGlyph><path d="M17.9 4.5c-3.8.2-7 2.1-8.4 5.1L5.4 7.8l1.5 4.6-3.7 2.4 4.6.4.9 4.4 2-4.1c3.6.8 6.9-.7 8.3-3.9-2.5 1.5-5.1 1.4-6.8.2 1.2-2.4 3.1-4.8 5.7-7.3Zm-.4 1.1 2.7.4-1.4 2.1-1.3-2.5Z" /></EnergyIconBase>;
}

function UnknownEnergyIcon(props: IconProps) {
  return <EnergyIconBase {...props}><path d="M9.2 9a3 3 0 0 1 5.8 1c0 2.2-3 2.2-3 4.3v.3h-2v-.5c0-2.9 2.9-3.2 2.9-4.2a1 1 0 0 0-1.9-.3L9.2 9Zm1.7 7.4h2.2v2.2h-2.2v-2.2Z" /></EnergyIconBase>;
}

function RarityIcon({ children, className }: IconProps & { children: ReactNode }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">{children}</svg>;
}

function CommonRarityIcon(props: IconProps) { return <RarityIcon {...props}><circle cx="12" cy="12" r="5" /></RarityIcon>; }
function UncommonRarityIcon(props: IconProps) { return <RarityIcon {...props}><path d="m12 3.6 8.4 8.4-8.4 8.4L3.6 12 12 3.6Z" /></RarityIcon>; }
function RareRarityIcon(props: IconProps) { return <RarityIcon {...props}><path d="m12 2.7 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.4 6.3-.9L12 2.7Z" /></RarityIcon>; }
function RareHoloRarityIcon(props: IconProps) { return <RarityIcon {...props}><path d="m10 3 2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7L10 3Zm8.3 11 .7 2.2 2.2.7-2.2.7-.7 2.2-.7-2.2-2.2-.7 2.2-.7.7-2.2Z" /></RarityIcon>; }
function DoubleRareRarityIcon(props: IconProps) { return <RarityIcon {...props}><path d="m7.5 4 1.7 3.5 3.8.6-2.8 2.7.7 3.8-3.4-1.8-3.4 1.8.6-3.8L2 8.1l3.8-.6L7.5 4Zm9 5.4 1.7 3.5 3.8.6-2.8 2.7.7 3.8-3.4-1.8-3.4 1.8.6-3.8-2.7-2.7 3.8-.6 1.7-3.5Z" /></RarityIcon>; }
function UltraRareRarityIcon(props: IconProps) { return <RarityIcon {...props}><path d="m8 3 1.8 3.8 4.2.6-3 3 .7 4.2L8 12.6l-3.7 2 .7-4.2-3-3 4.2-.6L8 3Zm9.2 8 1.3 2.7 3 .4-2.2 2.1.6 3-2.7-1.5-2.7 1.5.5-3-2.1-2.1 3-.4 1.3-2.7Z" /></RarityIcon>; }
function IllustrationRareRarityIcon(props: IconProps) { return <RarityIcon {...props}><path d="m12 2.8 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 2.8Z" /><path d="M6 19.5h12v1.8H6z" opacity=".55" /></RarityIcon>; }
function SpecialIllustrationRarityIcon(props: IconProps) { return <RarityIcon {...props}><path d="m6 2.7 1.3 2.7 3 .4-2.2 2.1.5 3L6 9.5l-2.7 1.4.5-3-2.1-2.1 3-.4L6 2.7Zm12 0 1.3 2.7 3 .4-2.1 2.1.5 3L18 9.5l-2.7 1.4.5-3-2.1-2.1 3-.4L18 2.7Zm-6 9.7 1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.7 1.4.5-3-2.1-2.1 3-.4 1.3-2.7Z" /></RarityIcon>; }
function HyperRareRarityIcon(props: IconProps) { return <RarityIcon {...props}><path d="M12 2.3 17.7 8 12 13.7 6.3 8 12 2.3Zm0 8.1 5.7 5.7-5.7 5.6-5.7-5.6 5.7-5.7Z" /></RarityIcon>; }
function SecretRareRarityIcon(props: IconProps) { return <RarityIcon {...props}><path d="m12 1.8 1.7 6.5 6.5 1.7-6.5 1.7-1.7 6.5-1.7-6.5L3.8 10l6.5-1.7L12 1.8Zm6 13.2.8 3.2L22 19l-3.2.8L18 23l-.8-3.2L14 19l3.2-.8L18 15Z" /></RarityIcon>; }
function UnknownRarityIcon(props: IconProps) { return <RarityIcon {...props}><path fillRule="evenodd" d="m12 2 8.7 5v10L12 22l-8.7-5V7L12 2Zm0 3.1L6 8.5v7l6 3.4 6-3.4v-7l-6-3.4Zm-1.1 3.2h2.2v2h-2.2v-2Zm0 3.4h2.2v4h-2.2v-4Z" clipRule="evenodd" /></RarityIcon>; }

function NeutralIcon({ children, className }: IconProps & { children: ReactNode }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">{children}</svg>;
}

function PokedexIcon(props: IconProps) { return <NeutralIcon {...props}><path d="M5 4h14M5 20h14M8 4v16M16 4v16M11 9h2a2 2 0 0 1 0 4h-2m0 0h2a2 2 0 0 1 0 4h-2" /></NeutralIcon>; }
function ReleaseDateIcon(props: IconProps) { return <NeutralIcon {...props}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></NeutralIcon>; }
function IllustratorIcon(props: IconProps) { return <NeutralIcon {...props}><path d="m14 5 5 5M4 20l4.2-1 9.7-9.7a2.1 2.1 0 0 0-3-3L5.2 16 4 20Zm9-13 4 4" /></NeutralIcon>; }

const ICON_COMPONENTS: Record<CardDetailMetadataIcon, (props: IconProps) => ReactNode> = {
  'energy-psychic': PsychicEnergyIcon,
  'energy-darkness': DarknessEnergyIcon,
  'energy-fire': FireEnergyIcon,
  'energy-water': WaterEnergyIcon,
  'energy-grass': GrassEnergyIcon,
  'energy-lightning': LightningEnergyIcon,
  'energy-colorless': ColorlessEnergyIcon,
  'energy-fighting': FightingEnergyIcon,
  'energy-metal': MetalEnergyIcon,
  'energy-fairy': FairyEnergyIcon,
  'energy-dragon': DragonEnergyIcon,
  'energy-unknown': UnknownEnergyIcon,
  'rarity-common': CommonRarityIcon,
  'rarity-uncommon': UncommonRarityIcon,
  'rarity-rare': RareRarityIcon,
  'rarity-rare-holo': RareHoloRarityIcon,
  'rarity-double': DoubleRareRarityIcon,
  'rarity-ultra': UltraRareRarityIcon,
  'rarity-illustration': IllustrationRareRarityIcon,
  'rarity-special': SpecialIllustrationRarityIcon,
  'rarity-hyper': HyperRareRarityIcon,
  'rarity-secret': SecretRareRarityIcon,
  'rarity-unknown': UnknownRarityIcon,
  pokedex: PokedexIcon,
  'release-date': ReleaseDateIcon,
  illustrator: IllustratorIcon,
};

export function CardDetailAttributeIcon({ icon }: { icon: CardDetailMetadataIcon }) {
  const Icon = ICON_COMPONENTS[icon];
  return <Icon className="card-detail-attribute-svg" />;
}
