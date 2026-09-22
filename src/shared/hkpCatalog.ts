import type { CompetencyDefinition } from './types';

/** Source transcription, not an authorization model. See docs/fachwissen/kompetenzmatrix-foto-katalogabgleich.md. */
export const HKP_GROUPS = [
  { value: 'HKP G1', label: 'Pflegefachkräfte / Notfallsanitäter' },
  { value: 'HKP G2', label: 'Krankenpflegehilfe / Krankenpflegeassistenz / MFA' },
  { value: 'HKP G3', label: 'Pflegefachassistenz' },
  { value: 'HKP G4', label: 'Weitere Kräfte gemäß Anlage 10' },
] as const;
export type HkpGroup = typeof HKP_GROUPS[number]['value'];
export const HKP_SOURCE = 'HKP NRW · Anlage 10 · Stand 06.03.2023';
export const HKP_PENDING_NOTE = 'Betriebliche Anwendbarkeit und persönliche Voraussetzungen prüfen. Vorlage zur Kompetenzbewertung, keine Durchführungserlaubnis.';
export const NO_COMPETENCY_TEMPLATE = 'Keine Vorlage';

type Row = readonly [code: string, name: string, group: string, columns: '1234' | '123' | '12' | '1'];
const rows: readonly Row[] = [
  ['032201', 'Blutdruckmessung', 'LG 1', '1234'],
  ['032240', 'Blutzuckermessung', 'LG 1', '1234'],
  ['032C24', 'Interstitielle Glukosemessung ohne Kalibrierung und/oder Sensorwechsel', 'LG 1', '1234'],
  ['032255', 'Inhalation', 'LG 1', '1234'],
  ['032324', 'Injektion s.c.', 'LG 1', '1234'],
  ['032311', 'Richten von Injektionen', 'LG 1', '1234'],
  ['032203', 'Auflegen von Kälteträgern', 'LG 1', '1234'],
  ['032367', 'Richten ärztlich verordneter Medikamente ohne Wochendispenser', 'LG 1', '1234'],
  ['032233', 'Medikamentengabe', 'LG 1', '1234'],
  ['032234', 'Augentropfen', 'LG 1', '1234'],
  ['032299', 'Ausziehen von Kompressionsstrümpfen / -strumpfhosen', 'LG 1', '1234'],
  ['032387', 'Abnehmen eines Kompressionsverbandes', 'LG 1', '1234'],
  ['032598', 'Abnehmen einer s.c.-Infusion', 'LG 1', '1234'],
  ['032C14', 'Ablegen ärztlich verordneter Bandagen und Orthesen', 'LG 1', '1234'],
  ['032303', 'Klistier / Klysma', 'LG 2', '1234'],
  ['032249', 'Flüssigkeitsbilanzierung', 'LG 2', '1234'],
  ['032313', 'SPK-Versorgung', 'LG 2', '1234'],
  ['032248', 'Medizinische Einreibungen', 'LG 2', '1234'],
  ['032236', 'Dermatologische Bäder', 'LG 2', '1234'],
  ['032309', 'Versorgung bei PEG', 'LG 2', '1234'],
  ['032298', 'Anziehen von Kompressionsstrümpfen / -strumpfhosen', 'LG 2', '1234'],
  ['032C13', 'Anlegen ärztlich verordneter Bandagen und Orthesen', 'LG 2', '1234'],
  ['032B82', 'Ablegen stützender oder stabilisierender Verbände', 'LG 2', '1234'],
  ['032B79', 'Positionswechsel zur Dekubitusbehandlung', 'LG 2', '1234'],
  ['032C26', 'Interstitielle Glukosemessung mit Kalibrierung bei Bedarf', 'LG 2', '1234'],
  ['032230', 'Absaugen der oberen Luftwege / Bronchialtoilette', 'LG 3', '12'],
  ['032241', 'Blasenspülung', 'LG 3', '12'],
  ['032246', 'Versorgung und Überprüfen von Drainagen', 'LG 3', '12'],
  ['032325', 'Injektion i.m.', 'LG 3', '12'],
  ['032259', 'Instillation', 'LG 3', '12'],
  ['032276', 'Stomaversorgung bei krankhaften Veränderungen', 'LG 3', '123'],
  ['032262', 'Katheterisierung / intermittierende Einmalkatheterisierung', 'LG 3', '12'],
  ['032312', 'Richten ärztlich verordneter Medikamente im Wochendispenser', 'LG 3', '123'],
  ['032261', 'Wechsel und Pflege der Trachealkanüle', 'LG 3', '1'],
  ['032235', 'Augenhöhlungspülung', 'LG 3', '12'],
  ['032308', 'Anlegen eines Kompressionsverbandes', 'LG 3', '123'],
  ['032323', 'Anlegen stützender oder stabilisierender Verbände', 'LG 3', '12'],
  ['032200', 'Legen und Anhängen einer s.c.-Infusion', 'LG 3', '12'],
  ['032591', 'Wechseln einer s.c.-Infusion', 'LG 3', '12'],
  ['032B80', 'Wundversorgung einer akuten Wunde', 'LG 3', '123'],
  ['032C25', 'Interstitielle Glukosemessung mit Sensorwechsel bei Bedarf', 'LG 3', '123'],
  ['032C27', 'Interstitielle Glukosemessung mit Kalibrierung und Sensorwechsel bei Bedarf', 'LG 3', '123'],
  ['032238', 'Bedienung und Überwachung eines Beatmungsgeräts', 'LG 4', '1'],
  ['032247', 'Einlauf (Hebe- und Senkeinlauf)', 'LG 4', '1'],
  ['032315', 'Digitales Enddarmausräumen', 'LG 4', '1'],
  ['032326', 'Anhängen, Wechsel oder Abhängen einer i.v.-Infusion', 'LG 4', '1'],
  ['032265', 'Legen und Wechseln einer Magensonde', 'LG 4', '1'],
  ['032319', 'Pflege des zentralen Venenkatheters und von Portsystemen', 'LG 4', '1'],
  ['032B81', 'Wundversorgung einer chronischen und schwer heilenden Wunde', 'Weitere', '1'],
  ['032132', 'Psychiatrische häusliche Krankenpflege', 'Weitere', '1'],
];

export type HkpCatalogEntry = CompetencyDefinition & {
  templateKey: string;
  code: string;
  serviceGroup: string;
  groups: HkpGroup[];
};

/** Paraphrases of all seven footnotes in the supplied original PDF, page 3. */
export const HKP_FOOTNOTES: Record<number, string> = {
  1: 'Bis zu entsprechenden Regelungen in den Bundesrahmenempfehlungen nach § 132a Abs. 1 SGB V verweist die Fassung auf die Qualifikationsanforderungen nach Nr. 31a HKP-RL. Aktuelle Wundversorgungsregelungen gesondert prüfen.',
  2: 'Regelmäßig wiederkehrende Leistungen der Behandlungspflege im Berufsalltag erforderlich.',
  3: 'Bestandsschutz: Die genannten Arzthelfer-, Krankenpflegehelfer-, Krankenpflegeassistenz- und Pflegefachassistenzberufe müssen die konkrete Leistung bereits bis 29.07.2022 im Ermessen der Pflegedienstleitung erbracht haben. Personen und einzelne GPOS müssen auf der Handzeichenliste gekennzeichnet sein. Keine pauschale Freigabe dieser Berufsgruppen.',
  4: 'Ausbildung nach dem NRW-Lehrplan „Fachschule für Sozialwesen, Fachrichtung Heilerziehungspflege“, jeweils gültige Fassung ab Ausbildungsbeginn August 2008.',
  5: 'Dokumentierter Nachweis über mindestens 186 Stunden sach- und fachgerechte theoretische Schulung durch ein Fort- bzw. Weiterbildungsinstitut gemäß Anlage 6 sowie mindestens drei Monate angeleitetes Praktikum in rechnerischer Vollzeit bei einer dreijährig examinierten Pflegefachkraft in einer zugelassenen Pflegeeinrichtung gemäß Anlage 7. Bei Teilzeit verlängert sich die Dauer entsprechend.',
  6: 'Zusatzqualifikation gemäß Anlage 6 mit 186 Stunden, mindestens 140 Stunden gemäß Anlage 6a und drei jeweils vierwöchige Praxiseinsätze. Bei Teilzeit verlängert sich die Dauer entsprechend.',
  7: 'Dokumentierter Nachweis über mindestens drei Monate Praktikum in rechnerischer Vollzeit zur Anleitung und Einarbeitung durch eine dreijährig examinierte Pflegefachkraft in der ambulanten Pflege gemäß Anlage 7.',
};
const grandfatherCodes = new Set(['032247', '032315', '032326', '032265', '032319']);
const details: Record<string, string> = {
  '032C24': 'Nicht gesondert abrechenbar im selben Einsatz mit GPOS 032C25, 032C26 oder 032C27.',
  '032C25': 'Glukosemessung nach GPOS 032C24 im Einsatz enthalten, nicht gesondert abrechenbar.',
  '032C26': 'Glukosemessung nach GPOS 032C24 im Einsatz enthalten, nicht gesondert abrechenbar.',
  '032C27': 'Glukosemessung nach GPOS 032C24 im Einsatz enthalten, nicht gesondert abrechenbar.',
  '032276': 'Zum Beispiel Urostoma und Anus-Praeterversorgung, nur bei krankhaften Veränderungen.',
  '032262': 'Einlegen, Entfernen oder Wechseln eines Katheters zur Harnableitung.',
  '032238': 'Bedienung, Überwachung, Überprüfung, Reinigung und Wechsel des Systems.',
  '032326': 'Zum Beispiel parenterale Ernährung oder Substitutionstherapie über Port.',
  '032132': 'Zusatzvoraussetzungen gemäß § 13 Abs. 4 des zugehörigen Vertrags prüfen.',
};

export const hkpCatalog: readonly HkpCatalogEntry[] = rows.map(([code, name, serviceGroup, columns]) => {
  const groups = HKP_GROUPS.filter((_, index) => columns.includes(String(index + 1))).map((group) => group.value);
  const conditions: string[] = [];
  if (groups.includes('HKP G2')) conditions.push(`Arzthelfer/innen / medizinische Fachangestellte, Fußnote 2: ${HKP_FOOTNOTES[2]}`);
  if (groups.includes('HKP G4')) {
    conditions.push(`Heilerziehungspflege, Fußnote 4: ${HKP_FOOTNOTES[4]}`);
    conditions.push(`Altenpflegehilfe / sonstige geeignete Kräfte, Fußnote 5: ${HKP_FOOTNOTES[5]} Sonstige geeignete Kräfte benötigen zusätzlich ein Jahr Berufserfahrung in der Pflege in Vollzeit.`);
    conditions.push(`Ambulante Pflegeassistenz, Fußnote 6: ${HKP_FOOTNOTES[6]}`);
    conditions.push(`Familienpflege / Rettungsassistenz: Fußnotenziffer 7 steht im Spaltenkopf nach Rettungsassistenz. ${HKP_FOOTNOTES[7]}`);
  }
  if (grandfatherCodes.has(code)) conditions.push(`Spalte 2 „nein“, Ausnahme Fußnote 3: ${HKP_FOOTNOTES[3]}`);
  if (code === '032B81') conditions.push(`Fußnote 1: ${HKP_FOOTNOTES[1]}`);
  return {
    templateKey: `hkp-nrw:${code}`, code, name, category: 'SGB V', serviceGroup, groups,
    relevance: groups.join('; '), reviewStatus: 'pending',
    note: [HKP_SOURCE, serviceGroup, details[code], ...conditions, HKP_PENDING_NOTE].filter(Boolean).join('\n\n'),
  };
});

/** Existing local definitions are never reinterpreted or overwritten by importing a template. */
export const findExistingHkpDefinition = (entry: HkpCatalogEntry, definitions: readonly CompetencyDefinition[]) =>
  definitions.find((definition) =>
    definition.templateKey === entry.templateKey ||
    definition.code?.trim().toUpperCase().replace(/^GPOS\s*/, '') === entry.code ||
    definition.name.trim().toLocaleLowerCase('de') === entry.name.toLocaleLowerCase('de'),
  );
