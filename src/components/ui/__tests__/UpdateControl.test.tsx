import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import UpdateControl from '../UpdateControl';

// jsdom has popover CSS but no top-layer API. Browser checks cover native
// placement; this shim lets the interaction tests observe the opened content.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'showPopover', { configurable: true, value: function (this: HTMLElement) { this.style.display = 'block'; } });
});
afterAll(() => { delete (HTMLElement.prototype as Partial<HTMLElement>).showPopover; });

const actions = () => ({ onCheck: vi.fn(), onDownload: vi.fn(), onInstall: vi.fn() });

describe('update controls', () => {
  it('offers download first, progress while loading, then an explicit restart', () => {
    const handlers = actions();
    const { rerender } = render(<UpdateControl status={{ state: 'available', version: '1.9.0' }} {...handlers} />);
    fireEvent.click(screen.getByRole('button', { name: 'Update herunterladen' }));
    expect(handlers.onDownload).toHaveBeenCalledOnce();
    expect(handlers.onInstall).not.toHaveBeenCalled();
    rerender(<UpdateControl status={{ state: 'downloading', progress: 42, remainingSeconds: 75 }} {...handlers} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '42');
    expect(screen.getByText('Noch ca. 2 Min.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download läuft …' })).toBeDisabled();
    rerender(<UpdateControl status={{ state: 'downloaded' }} {...handlers} />);
    fireEvent.click(screen.getByRole('button', { name: 'Update installieren und neu starten' }));
    expect(handlers.onInstall).toHaveBeenCalledOnce();
    rerender(<UpdateControl status={{ state: 'installing' }} {...handlers} />);
    expect(screen.getByText('Neustart wird vorbereitet …')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Installation läuft …' })).toBeDisabled();
  });

  it('keeps long installation errors visible and retries installation', () => {
    const handlers = actions();
    const message = 'Signature invalid. '.repeat(200);
    render(<UpdateControl compact status={{ state: 'error', retry: 'install', message }} {...handlers} />);
    expect(screen.getByRole('textbox', { name: 'Update-Fehlerdetails' })).toHaveValue(message);
    fireEvent.click(screen.getByRole('button', { name: 'Update installieren und neu starten' }));
    expect(handlers.onInstall).toHaveBeenCalledOnce();
    expect(handlers.onCheck).not.toHaveBeenCalled();
  });

  it('shows notes on hover and keyboard focus, dismisses on Escape, and treats markup as text', () => {
    render(<UpdateControl status={{ state: 'available', version: '1.9.0', releaseNotes: '- Übersicht\n<script>unsafe()</script>' }} {...actions()} />);
    const control = screen.getByRole('region', { name: 'Software-Update' });
    fireEvent.mouseEnter(control);
    expect(screen.getByRole('region', { name: 'Neuerungen' })).toHaveTextContent('<script>unsafe()</script>');
    expect(document.querySelector('script')).toBeNull();
    fireEvent.keyDown(control, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Neuerungen' })).not.toBeInTheDocument();
    fireEvent.focus(screen.getByRole('button', { name: 'Update herunterladen' }));
    expect(screen.getByRole('region', { name: 'Neuerungen' })).toBeInTheDocument();
    fireEvent.mouseLeave(control);
    fireEvent.click(screen.getByRole('button', { name: 'Neuerungen anzeigen' }));
    expect(screen.getByRole('region', { name: 'Neuerungen' })).toBeInTheDocument();
  });
});
