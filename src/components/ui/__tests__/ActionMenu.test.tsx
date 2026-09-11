/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from '@testing-library/react';
import ActionMenu from '../ActionMenu';

const renderMenu = (onSelect = vi.fn()) => {
  render(
    <ActionMenu items={[{ label: 'Austritt erfassen', onSelect }]}>Aktion</ActionMenu>,
  );
  return { trigger: screen.getByRole('button', { name: 'Aktion' }), onSelect };
};

it('announces its state and closes again after choosing an entry', () => {
  const { trigger, onSelect } = renderMenu();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');

  fireEvent.click(trigger);
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(screen.getByRole('menuitem', { name: 'Austritt erfassen' }));

  expect(onSelect).toHaveBeenCalledOnce();
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

it('closes on Escape and returns focus to the trigger', () => {
  const { trigger } = renderMenu();
  fireEvent.click(trigger);

  fireEvent.keyDown(document, { key: 'Escape' });

  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it('closes when clicking outside the menu', () => {
  const { trigger, onSelect } = renderMenu();
  fireEvent.click(trigger);

  fireEvent.click(document.querySelector('.cd-menu-scrim')!);

  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(onSelect).not.toHaveBeenCalled();
});
