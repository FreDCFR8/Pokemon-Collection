import colorlessEnergy from '../../assets/tcg-symbols/energy-colorless.png';
import darknessEnergy from '../../assets/tcg-symbols/energy-darkness.png';
import dragonEnergy from '../../assets/tcg-symbols/energy-dragon.png';
import fairyEnergy from '../../assets/tcg-symbols/energy-fairy.png';
import fightingEnergy from '../../assets/tcg-symbols/energy-fighting.png';
import fireEnergy from '../../assets/tcg-symbols/energy-fire.png';
import grassEnergy from '../../assets/tcg-symbols/energy-grass.png';
import lightningEnergy from '../../assets/tcg-symbols/energy-lightning.png';
import metalEnergy from '../../assets/tcg-symbols/energy-metal.png';
import psychicEnergy from '../../assets/tcg-symbols/energy-psychic.png';
import waterEnergy from '../../assets/tcg-symbols/energy-water.png';
import aceSpecRarity from '../../assets/tcg-symbols/rarity-ace-spec.png';
import commonRarity from '../../assets/tcg-symbols/rarity-common.png';
import doubleRarity from '../../assets/tcg-symbols/rarity-double.png';
import hyperRarity from '../../assets/tcg-symbols/rarity-hyper.png';
import illustrationRarity from '../../assets/tcg-symbols/rarity-illustration.png';
import rareRarity from '../../assets/tcg-symbols/rarity-rare.png';
import secretRarity from '../../assets/tcg-symbols/rarity-secret.png';
import specialRarity from '../../assets/tcg-symbols/rarity-special.png';
import ultraRarity from '../../assets/tcg-symbols/rarity-ultra.png';
import uncommonRarity from '../../assets/tcg-symbols/rarity-uncommon.png';
import type { CardDetailMetadataIcon } from './cardDetailGallery';

const ICON_ASSETS: Partial<Record<CardDetailMetadataIcon, string>> = {
  'energy-grass': grassEnergy,
  'energy-fire': fireEnergy,
  'energy-water': waterEnergy,
  'energy-lightning': lightningEnergy,
  'energy-fighting': fightingEnergy,
  'energy-psychic': psychicEnergy,
  'energy-darkness': darknessEnergy,
  'energy-metal': metalEnergy,
  'energy-dragon': dragonEnergy,
  'energy-fairy': fairyEnergy,
  'energy-colorless': colorlessEnergy,
  'rarity-common': commonRarity,
  'rarity-uncommon': uncommonRarity,
  'rarity-rare': rareRarity,
  // Holofoil Rare uses the same printed star as Rare; holofoil is the card finish.
  'rarity-rare-holo': rareRarity,
  'rarity-double': doubleRarity,
  'rarity-ultra': ultraRarity,
  'rarity-illustration': illustrationRarity,
  'rarity-special': specialRarity,
  'rarity-hyper': hyperRarity,
  'rarity-secret': secretRarity,
  'rarity-ace-spec': aceSpecRarity,
};

type NeutralIconProps = { className?: string };

function NeutralIcon({ children, className }: NeutralIconProps & { children: React.ReactNode }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">{children}</svg>;
}

function PokedexIcon(props: NeutralIconProps) {
  return <NeutralIcon {...props}><path d="M5 4h14M5 20h14M8 4v16M16 4v16M11 9h2a2 2 0 0 1 0 4h-2m0 0h2a2 2 0 0 1 0 4h-2" /></NeutralIcon>;
}

function ReleaseDateIcon(props: NeutralIconProps) {
  return <NeutralIcon {...props}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></NeutralIcon>;
}

function IllustratorIcon(props: NeutralIconProps) {
  return <NeutralIcon {...props}><path d="m14 5 5 5M4 20l4.2-1 9.7-9.7a2.1 2.1 0 0 0-3-3L5.2 16 4 20Zm9-13 4 4" /></NeutralIcon>;
}

function UnknownIcon({ kind }: { kind: 'energy' | 'rarity' }) {
  return (
    <svg className="card-detail-attribute-svg" viewBox="0 0 24 24" aria-hidden="true">
      {kind === 'energy' ? <circle cx="12" cy="12" r="10" fill="currentColor" /> : <path d="m12 2 8.7 5v10L12 22l-8.7-5V7L12 2Z" fill="currentColor" />}
      <path d="M9.3 9.3a2.8 2.8 0 0 1 5.4.9c0 2-2.7 2.2-2.7 4.1m0 2.1v.1" fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

export function CardDetailAttributeIcon({ icon }: { icon: CardDetailMetadataIcon }) {
  const source = ICON_ASSETS[icon];
  if (source) return <img className="card-detail-attribute-image" src={source} alt="" aria-hidden="true" />;
  if (icon === 'pokedex') return <PokedexIcon className="card-detail-attribute-svg" />;
  if (icon === 'release-date') return <ReleaseDateIcon className="card-detail-attribute-svg" />;
  if (icon === 'illustrator') return <IllustratorIcon className="card-detail-attribute-svg" />;
  return <UnknownIcon kind={icon.startsWith('energy-') ? 'energy' : 'rarity'} />;
}
