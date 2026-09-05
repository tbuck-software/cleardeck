import React from 'react';

/** Three tints, picked from the name so a person keeps the same colour. */
const PALETTE = [
  ['var(--color-accent-2-200)', 'var(--color-accent-2-800)'],
  ['var(--color-accent-200)', 'var(--color-accent-800)'],
  ['var(--color-neutral-200)', 'var(--color-neutral-800)'],
];

export const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();

const tintOf = (name: string): number => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i)) % 3;
  return hash;
};

type AvatarProps = {
  name: string;
  size?: number;
};

const Avatar = ({ name, size = 34 }: AvatarProps) => {
  const [background, color] = PALETTE[tintOf(name)];
  return (
    <span
      aria-hidden="true"
      style={{
        flex: 'none',
        width: size,
        height: size,
        borderRadius: '50%',
        background,
        color,
        display: 'grid',
        placeItems: 'center',
        font: `700 ${Math.round(size * 0.38)}px var(--font-body)`,
      }}
    >
      {initialsOf(name)}
    </span>
  );
};

export default Avatar;
