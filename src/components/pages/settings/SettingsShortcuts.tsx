import React from 'react';

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent);
const MOD = isMac ? '⌘' : 'Strg';

const GROUPS: { title: string; items: { label: string; keys: string[] }[] }[] = [
  {
    title: 'Navigation',
    items: [
      { label: 'Suche öffnen', keys: [MOD, 'K'] },
      { label: 'Einstellungen öffnen', keys: [MOD, ','] },
      { label: 'Zurück', keys: ['Alt', '←'] },
      { label: 'Vorwärts', keys: ['Alt', '→'] },
    ],
  },
  {
    title: 'Dialoge',
    items: [
      { label: 'Dialog schließen', keys: ['Esc'] },
      { label: 'Auswahl bestätigen', keys: ['Enter'] },
      { label: 'In der Suche blättern', keys: ['↑', '↓'] },
    ],
  },
  {
    title: 'Fenster',
    items: [
      { label: 'App sperren', keys: [MOD, 'L'] },
      { label: 'Neu laden', keys: [MOD, 'R'] },
    ],
  },
];

const SettingsShortcuts = () => (
  <div className="cd-page cd-narrow" style={{ gap: 32 }}>
    <header>
      <h1 className="cd-h1" style={{ marginTop: 0 }}>
        Tastenkürzel
      </h1>
      <p className="cd-muted" style={{ margin: '4px 0 0' }}>
        {isMac ? 'Auf Windows steht Strg für ⌘.' : 'Auf macOS steht ⌘ für Strg.'}
      </p>
    </header>

    {GROUPS.map((group) => (
      <section key={group.title}>
        <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>{group.title}</h3>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {group.items.map((item) => (
            <div key={item.label} className="cd-shortcut-row">
              <span>{item.label}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {item.keys.map((key) => (
                  <kbd key={key} className="cd-kbd-key">
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    ))}
  </div>
);

export default SettingsShortcuts;
