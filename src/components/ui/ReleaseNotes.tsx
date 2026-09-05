import React from 'react';

type ChangelogItem = { text: string; kind: string; cls: string };
export type ChangelogSection = { version: string; date: string; items: ChangelogItem[] };

const KIND: Record<string, [string, string]> = {
  Hinzugefügt: ['Neu', 'tag-accent-2'],
  Geändert: ['Geändert', 'tag-neutral'],
  Behoben: ['Fix', 'tag-accent'],
};

/** Release notes ship as CHANGELOG.md sections; anything else falls back to raw text. */
export const parseChangelog = (markdown: string): ChangelogSection[] => {
  const sections: ChangelogSection[] = [];
  let current: ChangelogSection | null = null;
  let kind = '';

  markdown.split('\n').forEach((line) => {
    const version = line.match(/^##\s*\[(.+?)\]\s*-\s*(\d{4})-(\d{2})-(\d{2})/);
    if (version) {
      current = {
        version: `v${version[1]}`,
        date: `${version[4]}.${version[3]}.${version[2]}`,
        items: [],
      };
      sections.push(current);
      return;
    }
    const heading = line.match(/^###\s+(.+)/);
    if (heading) {
      kind = heading[1].trim();
      return;
    }
    const item = line.match(/^[-*]\s+(.+)/);
    if (item && current) {
      const [label, cls] = KIND[kind] ?? ['', 'tag-neutral'];
      current.items.push({ text: item[1], kind: label, cls });
    }
  });

  return sections.filter((section) => section.items.length > 0);
};

/**
 * Shared by the in-app update popover and the lock screen, so both show the
 * same thing rather than the lock screen showing only a version number.
 */
const ReleaseNotes = ({ notes }: { notes?: string }) => {
  const text = notes?.trim();
  if (!text) return null;

  const sections = parseChangelog(text);
  if (sections.length === 0) return <div className="update-notes-raw">{text}</div>;

  return (
    <div className="update-notes-list">
      {sections.map((section) => (
        <section key={section.version}>
          <div className="update-notes-version">
            <span className="tag tag-accent-2" style={{ fontWeight: 700 }}>
              {section.version}
            </span>
            <span>{section.date}</span>
          </div>
          <ul>
            {section.items.map((item, index) => (
              <li key={`${section.version}-${index}`}>
                {item.kind && <span className={`tag ${item.cls} update-notes-kind`}>{item.kind}</span>}
                {item.text}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

export default ReleaseNotes;
