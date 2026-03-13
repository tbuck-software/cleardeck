/**
 * Database Seed Data
 *
 * Seeds a realistic demo dataset on fresh databases:
 * - 20+ employees with active/left histories and mixed qualifications
 * - employee timeline events, expiring trainings, birthdays and anniversaries
 * - patients with many QPR visits across all ratings
 * - competency matrix assignments and employee instructions
 */

import type { Database as DatabaseType } from 'better-sqlite3';

type PeriodSeed = {
  startDate: string;
  endDate?: string | null;
  qualification: string;
  note?: string | null;
};

type EventSeed = {
  eventDate: string;
  type:
    | 'join'
    | 'leave'
    | 'name-change'
    | 'note-change'
    | 'fte-change'
    | 'weekly-hours-change'
    | 'care-visit'
    | 'emergency-training'
    | 'custom';
  title: string;
  details?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  expiresAt?: string | null;
  meta?: Record<string, unknown> | null;
};

type EmployeeSeed = {
  name: string;
  weeklyHours: number;
  fte: number;
  department: string;
  birthDate?: string | null;
  note?: string | null;
  competencyProfile: 'lead' | 'pfk' | 'assist' | 'new-hire';
  instructionProfile: 'lead' | 'pfk' | 'standard' | 'new-hire';
  periods: PeriodSeed[];
  extraEvents?: EventSeed[];
};

type PatientSeed = {
  name: string;
  birthDate?: string | null;
  diagnosis?: string | null;
  note?: string | null;
  initialStatus?: 'A' | 'B' | 'C' | 'D' | null;
  visits: Array<{
    visitDate: string;
    qprRating: 'A' | 'B' | 'C' | 'D';
    comment?: string | null;
  }>;
};

const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

const shiftDays = (base: Date, days: number): string => {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return toIsoDate(next);
};

const withYear = (base: Date, year: number, dayOffset = 0): string => {
  const shifted = new Date(base);
  shifted.setUTCDate(shifted.getUTCDate() + dayOffset);
  const next = new Date(
    Date.UTC(year, shifted.getUTCMonth(), shifted.getUTCDate()),
  );
  return toIsoDate(next);
};

const roundFte = (weeklyHours: number, baseHours: number): number =>
  Number(Math.min(1, weeklyHours / baseHours).toFixed(2));

const competencyProfiles: Record<EmployeeSeed['competencyProfile'], string[]> = {
  lead: ['Einarbeitung', 'P16', 'P16a', 'P17', 'BPf 9', 'BPf 24', 'BPf 29', 'QM-01'],
  pfk: ['Einarbeitung', 'P01', 'P03', 'P08', 'BPf 2', 'BPf 9', 'BPf 10', 'BPf 24', 'BPf 26'],
  assist: ['Einarbeitung', 'P02', 'P07', 'P08', 'P11', 'P13', 'P14', 'P31'],
  'new-hire': ['Einarbeitung', 'P02', 'P07', 'P08', 'QM-01'],
};

const instructionProfiles: Record<EmployeeSeed['instructionProfile'], string[]> = {
  lead: [
    'Erstunterweisung Arbeitsschutz',
    'Brandschutzunterweisung',
    'Hygieneunterweisung (jährlich)',
    'Datenschutz-Grundunterweisung',
    'Reanimationstraining (BLS/AED)',
    'SIS-Dokumentation (Strukturmodell)',
    'Pflegegradmanagement & Begutachtung',
    'Toursoftware 2026',
  ],
  pfk: [
    'Erstunterweisung Arbeitsschutz',
    'Hygieneunterweisung (jährlich)',
    'MRSA - Standard Umgang & Schutz',
    'Reanimationstraining (BLS/AED)',
    'Einweisung Medizinprodukte (MPG)',
    'Notfallmanagement / FAST-Erkennung',
    'Toursoftware 2026',
  ],
  standard: [
    'Erstunterweisung Arbeitsschutz',
    'Brandschutzunterweisung',
    'Hygieneunterweisung (jährlich)',
    'Datenschutz-Grundunterweisung',
    'Tourenplanung & Dienstplanung',
    'Toursoftware 2026',
  ],
  'new-hire': [
    'Erstunterweisung Arbeitsschutz',
    'Brandschutzunterweisung',
    'Datenschutz-Grundunterweisung',
    'Toursoftware 2026',
  ],
};

const approvers = ['Anna Beispiel', 'Leonie Hartmann', 'PDL Team', 'Praxisanleitung'];

/**
 * Seed a realistic demo dataset if the database is still empty.
 */
export const seedDatabase = (db: DatabaseType): void => {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM employees').get() as { cnt: number };

  if (row.cnt > 0) {
    return;
  }

  const today = new Date();
  const baseDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const baseHours = 38;

  // Zielbild fuer den Demo-Dienst:
  // - 4 Leitung/Spezialrollen
  // - 12 Pflegefachkraefte
  // - 7 Assistenz-/Hilfskraefte
  // - 3 neue bzw. sehr frische Mitarbeitende
  const employees: EmployeeSeed[] = [
    {
      name: 'Anna Beispiel',
      weeklyHours: 38,
      fte: roundFte(38, baseHours),
      department: 'PDL',
      birthDate: withYear(baseDate, 1986, 6),
      note: 'Teamleitung, Praxisanleitung und Ansprechpartnerin fuer neue Mitarbeitende.',
      competencyProfile: 'lead',
      instructionProfile: 'lead',
      periods: [
        {
          startDate: shiftDays(baseDate, -1500),
          endDate: shiftDays(baseDate, -780),
          qualification: '1-jährig examiniert',
          note: 'Begann als stellvertretende Teamkoordinatorin.',
        },
        {
          startDate: shiftDays(baseDate, -779),
          qualification: '3-jährig examiniert',
          note: 'Seit Abschluss der Weiterbildung in leitender Rolle.',
        },
      ],
      extraEvents: [
        {
          eventDate: shiftDays(baseDate, -70),
          type: 'fte-change',
          title: 'VZAE-Aenderung',
          previousValue: '0.95',
          newValue: '1.00',
          details: 'Aufstockung wegen Uebernahme der Dienstplanung.',
        },
        {
          eventDate: shiftDays(baseDate, 18),
          type: 'emergency-training',
          title: 'Reanimationstraining',
          details: 'Pflichttraining fuer Leitung und Bezugspflege.',
          expiresAt: shiftDays(baseDate, 383),
          meta: { location: 'Schulungsraum 2' },
        },
      ],
    },
    {
      name: 'Ben Krueger',
      weeklyHours: 32,
      fte: roundFte(32, baseHours),
      department: 'Tour Nord',
      birthDate: withYear(baseDate, 1991, 18),
      note: 'Wundmanagement und diabetische Versorgung.',
      competencyProfile: 'pfk',
      instructionProfile: 'pfk',
      periods: [{ startDate: shiftDays(baseDate, -920), qualification: '3-jährig examiniert' }],
      extraEvents: [
        {
          eventDate: shiftDays(baseDate, -42),
          type: 'weekly-hours-change',
          title: 'Wochenstundenaenderung',
          previousValue: '30.0 h',
          newValue: '32.0 h',
        },
        {
          eventDate: shiftDays(baseDate, 26),
          type: 'care-visit',
          title: 'Begleitvisite Wundversorgung',
          details: 'Hospitation bei komplexem Ulcus-Fall.',
          meta: { patientGroup: 'Wundversorgung' },
        },
      ],
    },
    {
      name: 'Clara Nguyen',
      weeklyHours: 30,
      fte: roundFte(30, baseHours),
      department: 'Tour Sued',
      birthDate: withYear(baseDate, 1993, -12),
      competencyProfile: 'pfk',
      instructionProfile: 'pfk',
      periods: [
        {
          startDate: shiftDays(baseDate, -1180),
          endDate: shiftDays(baseDate, -310),
          qualification: '1-jährig examiniert',
          note: 'Aufbauphase in der ambulanten Pflege.',
        },
        {
          startDate: shiftDays(baseDate, -309),
          qualification: '3-jährig examiniert',
          note: 'Nach Examen uebernommen.',
        },
      ],
      extraEvents: [
        {
          eventDate: shiftDays(baseDate, -95),
          type: 'custom',
          title: 'Fortbildung Palliative Care',
          details: 'Externe Tagesfortbildung abgeschlossen.',
          expiresAt: shiftDays(baseDate, 55),
        },
      ],
    },
    {
      name: 'David Schneider',
      weeklyHours: 24,
      fte: roundFte(24, baseHours),
      department: 'Tour West',
      birthDate: withYear(baseDate, 1989, 24),
      competencyProfile: 'assist',
      instructionProfile: 'standard',
      periods: [{ startDate: shiftDays(baseDate, -830), qualification: 'Pflegekraft/-helfer' }],
    },
    {
      name: 'Eva Sommer',
      weeklyHours: 19,
      fte: roundFte(19, baseHours),
      department: 'Tour Nord',
      birthDate: withYear(baseDate, 1997, 2),
      note: 'Rueckkehr nach Elternzeit.',
      competencyProfile: 'new-hire',
      instructionProfile: 'new-hire',
      periods: [
        {
          startDate: shiftDays(baseDate, -1400),
          endDate: shiftDays(baseDate, -430),
          qualification: 'Pflegekraft/-helfer',
        },
        {
          startDate: shiftDays(baseDate, -35),
          qualification: 'Pflegekraft/-helfer',
          note: 'Wiedereinstieg mit reduzierter Tour.',
        },
      ],
      extraEvents: [
        {
          eventDate: shiftDays(baseDate, -20),
          type: 'custom',
          title: 'Rueckkehrgespraech',
          details: 'Rueckkehr nach Elternzeit.',
        },
      ],
    },
    {
      name: 'Felix Braun',
      weeklyHours: 38,
      fte: roundFte(38, baseHours),
      department: 'Springerteam',
      birthDate: withYear(baseDate, 1984, 14),
      note: 'Erfahrener Springer fuer komplexe Einsaetze und kurzfristige Tourwechsel.',
      competencyProfile: 'pfk',
      instructionProfile: 'pfk',
      periods: [{ startDate: shiftDays(baseDate, -1820), qualification: '3-jährig examiniert' }],
      extraEvents: [
        {
          eventDate: shiftDays(baseDate, 8),
          type: 'custom',
          title: 'Leitungsklausur',
          details: 'Review der Touren- und Patientenstruktur.',
        },
      ],
    },
    {
      name: 'Greta Wolff',
      weeklyHours: 27,
      fte: roundFte(27, baseHours),
      department: 'Tour Ost',
      birthDate: withYear(baseDate, 1990, 28),
      competencyProfile: 'pfk',
      instructionProfile: 'pfk',
      periods: [{ startDate: shiftDays(baseDate, -610), qualification: '1-jährig examiniert' }],
      extraEvents: [
        {
          eventDate: shiftDays(baseDate, -12),
          type: 'note-change',
          title: 'Notiz aktualisiert',
          details: 'Uebernahme der Hygienebeauftragten-Rolle dokumentiert.',
          previousValue: 'Pflegefachkraft',
          newValue: 'Pflegefachkraft, Hygienebeauftragte',
        },
      ],
    },
    {
      name: 'Hassan Ali',
      weeklyHours: 38,
      fte: roundFte(38, baseHours),
      department: 'Tour Sued',
      birthDate: withYear(baseDate, 1988, -4),
      competencyProfile: 'pfk',
      instructionProfile: 'pfk',
      periods: [{ startDate: shiftDays(baseDate, -980), qualification: '3-jährig examiniert' }],
      extraEvents: [
        {
          eventDate: shiftDays(baseDate, -58),
          type: 'emergency-training',
          title: 'Beatmungsgeraete-Einweisung',
          details: 'Auffrischung fuer ausserklinische Intensivpflege.',
          expiresAt: shiftDays(baseDate, 21),
        },
      ],
    },
    {
      name: 'Ines Hartmann',
      weeklyHours: 34,
      fte: roundFte(34, baseHours),
      department: 'Tour Nord',
      birthDate: withYear(baseDate, 1992, 11),
      competencyProfile: 'pfk',
      instructionProfile: 'pfk',
      periods: [{ startDate: shiftDays(baseDate, -715), qualification: '3-jährig examiniert' }],
    },
    {
      name: 'Jonas Richter',
      weeklyHours: 22,
      fte: roundFte(22, baseHours),
      department: 'Tour West',
      birthDate: withYear(baseDate, 1999, -16),
      competencyProfile: 'assist',
      instructionProfile: 'standard',
      periods: [{ startDate: shiftDays(baseDate, -480), qualification: 'Pflegekraft/-helfer' }],
    },
    {
      name: 'Katja Mertens',
      weeklyHours: 26,
      fte: roundFte(26, baseHours),
      department: 'Tour Ost',
      birthDate: withYear(baseDate, 1987, 9),
      competencyProfile: 'assist',
      instructionProfile: 'standard',
      periods: [
        {
          startDate: shiftDays(baseDate, -1260),
          endDate: shiftDays(baseDate, -500),
          qualification: 'Sonstige',
          note: 'Quereinstieg im Servicebereich.',
        },
        {
          startDate: shiftDays(baseDate, -499),
          qualification: 'Pflegekraft/-helfer',
          note: 'Nach interner Qualifizierung uebernommen.',
        },
      ],
    },
    {
      name: 'Leonie Hartmann',
      weeklyHours: 38,
      fte: roundFte(38, baseHours),
      department: 'Praxisanleitung',
      birthDate: withYear(baseDate, 1985, 3),
      note: 'Verantwortlich fuer Einarbeitung und Pflichtunterweisungen.',
      competencyProfile: 'lead',
      instructionProfile: 'lead',
      periods: [{ startDate: shiftDays(baseDate, -1610), qualification: '3-jährig examiniert' }],
      extraEvents: [
        {
          eventDate: shiftDays(baseDate, 34),
          type: 'custom',
          title: 'Praxisanleiter-Workshop',
          details: 'Vorbereitung der Sommer-Einarbeitungen.',
        },
      ],
    },
    {
      name: 'Marek Vogel',
      weeklyHours: 20,
      fte: roundFte(20, baseHours),
      department: 'Tour West',
      birthDate: withYear(baseDate, 1995, 31),
      competencyProfile: 'assist',
      instructionProfile: 'standard',
      periods: [{ startDate: shiftDays(baseDate, -290), qualification: 'Pflegekraft/-helfer' }],
    },
    {
      name: 'Nora Yilmaz',
      weeklyHours: 29,
      fte: roundFte(29, baseHours),
      department: 'Tour Nord',
      birthDate: withYear(baseDate, 1994, -8),
      competencyProfile: 'pfk',
      instructionProfile: 'pfk',
      periods: [{ startDate: shiftDays(baseDate, -880), qualification: '1-jährig examiniert' }],
      extraEvents: [
        {
          eventDate: shiftDays(baseDate, -28),
          type: 'care-visit',
          title: 'QPR-Begleitvisite',
          details: 'Gemeinsame Visite mit PDL.',
        },
      ],
    },
    {
      name: 'Oliver Frank',
      weeklyHours: 18,
      fte: roundFte(18, baseHours),
      department: 'Tour Ost',
      birthDate: withYear(baseDate, 2000, 16),
      competencyProfile: 'new-hire',
      instructionProfile: 'new-hire',
      periods: [{ startDate: shiftDays(baseDate, -12), qualification: 'Pflegekraft/-helfer' }],
    },
    {
      name: 'Petra Schmitt',
      weeklyHours: 25,
      fte: roundFte(25, baseHours),
      department: 'Tour Sued',
      birthDate: withYear(baseDate, 1983, 22),
      competencyProfile: 'pfk',
      instructionProfile: 'pfk',
      periods: [
        {
          startDate: shiftDays(baseDate, -1700),
          endDate: shiftDays(baseDate, -120),
          qualification: '3-jährig examiniert',
          note: 'Beendet wegen Renteneintritt.',
        },
      ],
    },
    {
      name: 'Quirin Bach',
      weeklyHours: 31,
      fte: roundFte(31, baseHours),
      department: 'Tour Nord',
      birthDate: withYear(baseDate, 1991, -20),
      competencyProfile: 'pfk',
      instructionProfile: 'pfk',
      periods: [{ startDate: shiftDays(baseDate, -640), qualification: '3-jährig examiniert' }],
    },
    {
      name: 'Rosa Becker',
      weeklyHours: 16,
      fte: roundFte(16, baseHours),
      department: 'Abendtour',
      birthDate: withYear(baseDate, 1998, 26),
      competencyProfile: 'assist',
      instructionProfile: 'standard',
      periods: [{ startDate: shiftDays(baseDate, -365), qualification: 'Pflegekraft/-helfer' }],
    },
    {
      name: 'Svenja Koch',
      weeklyHours: 34,
      fte: roundFte(34, baseHours),
      department: 'Tour West',
      birthDate: withYear(baseDate, 1988, -1),
      note: 'Senior-Fachkraft mit Schwerpunkt Qualitaetssicherung in der West-Tour.',
      competencyProfile: 'pfk',
      instructionProfile: 'pfk',
      periods: [
        {
          startDate: shiftDays(baseDate, -1290),
          endDate: shiftDays(baseDate, -660),
          qualification: '1-jährig examiniert',
        },
        {
          startDate: shiftDays(baseDate, -659),
          qualification: '3-jährig examiniert',
        },
      ],
      extraEvents: [
        {
          eventDate: shiftDays(baseDate, -47),
          type: 'name-change',
          title: 'Namensaenderung',
          previousValue: 'Svenja Lorenz',
          newValue: 'Svenja Koch',
        },
      ],
    },
    {
      name: 'Timo Adler',
      weeklyHours: 21,
      fte: roundFte(21, baseHours),
      department: 'Tour Sued',
      birthDate: withYear(baseDate, 1996, 34),
      competencyProfile: 'assist',
      instructionProfile: 'standard',
      periods: [
        {
          startDate: shiftDays(baseDate, -560),
          endDate: shiftDays(baseDate, -45),
          qualification: 'Sonstige',
          note: 'Befristeter Einsatz im Alltagsbegleitdienst.',
        },
      ],
    },
    {
      name: 'Ulrike Mann',
      weeklyHours: 28,
      fte: roundFte(28, baseHours),
      department: 'Tour Ost',
      birthDate: withYear(baseDate, 1982, 13),
      competencyProfile: 'pfk',
      instructionProfile: 'pfk',
      periods: [{ startDate: shiftDays(baseDate, -840), qualification: '3-jährig examiniert' }],
      extraEvents: [
        {
          eventDate: shiftDays(baseDate, 11),
          type: 'custom',
          title: 'Audit Wunddokumentation',
          details: 'Interner Stichproben-Termin.',
        },
      ],
    },
    {
      name: 'Valentina Graf',
      weeklyHours: 38,
      fte: roundFte(38, baseHours),
      department: 'Springerteam',
      birthDate: withYear(baseDate, 1990, 19),
      competencyProfile: 'lead',
      instructionProfile: 'lead',
      periods: [{ startDate: shiftDays(baseDate, -930), qualification: '3-jährig examiniert' }],
      extraEvents: [
        {
          eventDate: shiftDays(baseDate, -63),
          type: 'emergency-training',
          title: 'Sturzmanagement',
          details: 'Jaehrliche Pflichtfortbildung.',
          expiresAt: shiftDays(baseDate, 80),
        },
      ],
    },
    {
      name: 'Wiebke Jansen',
      weeklyHours: 24,
      fte: roundFte(24, baseHours),
      department: 'Abendtour',
      birthDate: withYear(baseDate, 1997, 5),
      competencyProfile: 'assist',
      instructionProfile: 'standard',
      periods: [{ startDate: shiftDays(baseDate, -410), qualification: 'Pflegekraft/-helfer' }],
    },
    {
      name: 'Yara Petersen',
      weeklyHours: 30,
      fte: roundFte(30, baseHours),
      department: 'Tour Nord',
      birthDate: withYear(baseDate, 1992, -14),
      competencyProfile: 'pfk',
      instructionProfile: 'pfk',
      periods: [{ startDate: shiftDays(baseDate, -520), qualification: '1-jährig examiniert' }],
    },
    {
      name: 'Zoe Kirchner',
      weeklyHours: 12,
      fte: roundFte(12, baseHours),
      department: 'Wochenendtour',
      birthDate: withYear(baseDate, 2002, 29),
      competencyProfile: 'new-hire',
      instructionProfile: 'new-hire',
      periods: [{ startDate: shiftDays(baseDate, -5), qualification: 'Pflegekraft/-helfer' }],
      extraEvents: [
        {
          eventDate: shiftDays(baseDate, 5),
          type: 'custom',
          title: 'Mentoring-Termin',
          details: 'Erstes Reflexionsgespraech nach den Einstiegstagen.',
        },
      ],
    },
  ];

  const patientFirstNames = [
    'Adelheid',
    'Bruno',
    'Charlotte',
    'Dieter',
    'Else',
    'Franziska',
    'Gerd',
    'Helga',
    'Irma',
    'Jens',
    'Karin',
    'Ludwig',
  ];
  const patientLastNames = [
    'Werner',
    'Keller',
    'Ebert',
    'Lange',
    'Winter',
    'Hoff',
    'Paulsen',
    'Busch',
  ];
  const patientNames = patientFirstNames
    .flatMap((firstName) => patientLastNames.map((lastName) => `${firstName} ${lastName}`))
    .slice(0, 72);

  const diagnoses = [
    'Diabetes mellitus Typ 2',
    'Chronische Herzinsuffizienz',
    'Demenz',
    'Parkinson',
    'Apoplex mit Hemiparese',
    'COPD',
    'pAVK mit Ulcus',
    'Tumorerkrankung in palliativer Versorgung',
  ];

  const patients: PatientSeed[] = patientNames.map((name, index) => {
    const visitCount = index % 7 === 0 ? 0 : (index % 4) + 1;
    const visits = Array.from({ length: visitCount }, (_item, visitIndex) => {
      const offset = -120 + index * 4 + visitIndex * 24;
      const rating = (['A', 'B', 'C', 'D'] as const)[(index + visitIndex) % 4];
      return {
        visitDate: shiftDays(baseDate, offset),
        qprRating: rating,
        comment:
          rating === 'A'
            ? 'Versorgung stabil und nachvollziehbar dokumentiert.'
            : rating === 'B'
              ? 'Leichte Auffaelligkeiten ohne akutes Risiko.'
              : rating === 'C'
                ? 'Defizite bei Transfer oder Dokumentation mit Risiko negativer Folgen.'
                : 'Akuter Handlungsbedarf, Fall wurde mit PDL besprochen.',
      };
    });

    if (index % 5 === 2) {
      visits.push({
        visitDate: shiftDays(baseDate, 6 + (index % 3) * 4),
        qprRating: (['A', 'B', 'C'] as const)[index % 3],
        comment: 'Geplante QPR-Verlaufsvisite.',
      });
    }

    visits.sort((a, b) => a.visitDate.localeCompare(b.visitDate));

    return {
      name,
      birthDate: index % 6 === 0 ? null : withYear(baseDate, 1942 + index, (index % 11) * 3 - 12),
      diagnosis: diagnoses[index % diagnoses.length],
      note: index % 4 === 0 ? 'Regelmaessige Rueckmeldung an Angehoerige.' : null,
      initialStatus: index % 7 === 0 ? null : (['A', 'B', 'C', 'D'] as const)[index % 4],
      visits,
    };
  });

  const seed = db.transaction(() => {
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('baseHours', ?)").run(
      String(baseHours),
    );
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('hiddenEventTypes', ?)").run(
      JSON.stringify([]),
    );

    const insertQualification = db.prepare(
      `
      INSERT INTO qualification_types (name, sortOrder, note)
      VALUES (@name, @sortOrder, @note)
      ON CONFLICT(name) DO UPDATE SET
        sortOrder = excluded.sortOrder,
        note = excluded.note
    `,
    );

    [
      {
        name: '3-jährig examiniert',
        sortOrder: 1,
        note: 'Pflegefachkraft mit Examen, geeignet fuer behandlungspflegerische Aufgaben.',
      },
      {
        name: '1-jährig examiniert',
        sortOrder: 2,
        note: 'Pflegeassistenz mit staatlicher Anerkennung.',
      },
      {
        name: 'Pflegekraft/-helfer',
        sortOrder: 3,
        note: 'Pflegehilfskraft fuer grundpflegerische und hauswirtschaftliche Aufgaben.',
      },
      {
        name: 'Sonstige',
        sortOrder: 4,
        note: 'Begleitdienst, Service oder individuelle Sonderrollen.',
      },
      {
        name: 'Praxisanleitung',
        sortOrder: 5,
        note: 'Interne Zusatzrolle fuer Onboarding und Kompetenzfreigaben.',
      },
    ].forEach((qualification) => insertQualification.run(qualification));

    db.prepare(
      `
      INSERT OR IGNORE INTO competency_definitions (code, name, category, relevance, sortOrder, note)
      VALUES ('QM-01', 'Toursoftware sicher bedienen', 'Digital', 'Alle', 999, 'Dokumentation, Terminpflege und mobile Rueckmeldungen.')
    `,
    ).run();

    db.prepare(
      `
      INSERT OR IGNORE INTO instruction_definitions (topic, legalBasis, note, sortOrder)
      VALUES ('Toursoftware 2026', 'interne Richtlinie', 'Einweisung in mobile Dokumentation und Rueckmeldelogik.', 999)
    `,
    ).run();

    const insertEmployee = db.prepare(
      `
      INSERT INTO employees (name, note, weeklyHours, fte, birthDate, department)
      VALUES (@name, @note, @weeklyHours, @fte, @birthDate, @department)
    `,
    );
    const insertPeriod = db.prepare(
      `
      INSERT INTO employment_periods (employeeId, startDate, endDate, qualification, note)
      VALUES (@employeeId, @startDate, @endDate, @qualification, @note)
    `,
    );
    const insertEvent = db.prepare(
      `
      INSERT INTO employee_events (
        employeeId,
        eventDate,
        type,
        title,
        details,
        meta,
        previousValue,
        newValue,
        expiresAt
      )
      VALUES (
        @employeeId,
        @eventDate,
        @type,
        @title,
        @details,
        @meta,
        @previousValue,
        @newValue,
        @expiresAt
      )
    `,
    );
    const insertPatient = db.prepare(
      `
      INSERT INTO patients (name, birthDate, diagnosis, qprStatus, note)
      VALUES (@name, @birthDate, @diagnosis, @qprStatus, @note)
    `,
    );
    const insertVisit = db.prepare(
      `
      INSERT INTO patient_visits (patientId, visitDate, qprRating, comment)
      VALUES (@patientId, @visitDate, @qprRating, @comment)
    `,
    );

    employees.forEach((employee) => {
      const employeeId = insertEmployee.run({
        name: employee.name,
        note: employee.note ?? null,
        weeklyHours: employee.weeklyHours,
        fte: employee.fte,
        birthDate: employee.birthDate ?? null,
        department: employee.department,
      }).lastInsertRowid as number;

      employee.periods.forEach((period) => {
        insertPeriod.run({
          employeeId,
          startDate: period.startDate,
          endDate: period.endDate ?? null,
          qualification: period.qualification,
          note: period.note ?? null,
        });
      });

      const firstPeriod = employee.periods[0];
      if (firstPeriod) {
        insertEvent.run({
          employeeId,
          eventDate: firstPeriod.startDate,
          type: 'join',
          title: 'Eintritt',
          details: `Start im Bereich ${employee.department}.`,
          meta: null,
          previousValue: null,
          newValue: null,
          expiresAt: null,
        });
      }

      const lastPeriod = employee.periods[employee.periods.length - 1];
      if (lastPeriod?.endDate) {
        insertEvent.run({
          employeeId,
          eventDate: lastPeriod.endDate,
          type: 'leave',
          title: 'Austritt',
          details: lastPeriod.note ?? 'Beschafftigungsverhaeltnis beendet.',
          meta: null,
          previousValue: null,
          newValue: null,
          expiresAt: null,
        });
      }

      employee.extraEvents?.forEach((event) => {
        insertEvent.run({
          employeeId,
          eventDate: event.eventDate,
          type: event.type,
          title: event.title,
          details: event.details ?? null,
          meta: event.meta ? JSON.stringify(event.meta) : null,
          previousValue: event.previousValue ?? null,
          newValue: event.newValue ?? null,
          expiresAt: event.expiresAt ?? null,
        });
      });
    });

    patients.forEach((patient) => {
      const patientId = insertPatient.run({
        name: patient.name,
        birthDate: patient.birthDate ?? null,
        diagnosis: patient.diagnosis ?? null,
        qprStatus: patient.initialStatus ?? null,
        note: patient.note ?? null,
      }).lastInsertRowid as number;

      patient.visits.forEach((visit) => {
        insertVisit.run({
          patientId,
          visitDate: visit.visitDate,
          qprRating: visit.qprRating,
          comment: visit.comment ?? null,
        });
      });
    });

    db.exec(`
      UPDATE patients
      SET qprStatus = (
        SELECT v.qprRating
        FROM patient_visits v
        WHERE v.patientId = patients.id
        ORDER BY date(v.visitDate) DESC, v.id DESC
        LIMIT 1
      )
      WHERE EXISTS (
        SELECT 1 FROM patient_visits v WHERE v.patientId = patients.id
      );
    `);

    const competencyDefinitions = db
      .prepare('SELECT id, code, name FROM competency_definitions')
      .all() as Array<{ id: number; code: string | null; name: string }>;
    const instructionDefinitions = db
      .prepare('SELECT id, topic FROM instruction_definitions')
      .all() as Array<{ id: number; topic: string }>;
    const employeeRows = db
      .prepare('SELECT id, name FROM employees ORDER BY id ASC')
      .all() as Array<{ id: number; name: string }>;

    const competencyLookup = new Map<string, number>();
    competencyDefinitions.forEach((definition) => {
      if (definition.code) {
        competencyLookup.set(definition.code, definition.id);
      }
      competencyLookup.set(definition.name, definition.id);
    });

    const instructionLookup = new Map<string, number>();
    instructionDefinitions.forEach((definition) => {
      instructionLookup.set(definition.topic, definition.id);
    });

    const insertEmployeeCompetency = db.prepare(
      `
      INSERT OR REPLACE INTO employee_competencies (
        employeeId,
        competencyDefinitionId,
        level,
        approvedAt,
        approvedBy,
        note
      )
      VALUES (@employeeId, @competencyDefinitionId, @level, @approvedAt, @approvedBy, @note)
    `,
    );

    const insertEmployeeInstruction = db.prepare(
      `
      INSERT OR REPLACE INTO employee_instructions (
        employeeId,
        instructionDefinitionId,
        dueDate,
        completedAt,
        conductedBy,
        note
      )
      VALUES (@employeeId, @instructionDefinitionId, @dueDate, @completedAt, @conductedBy, @note)
    `,
    );

    employeeRows.forEach((employeeRow, employeeIndex) => {
      const employeeSeed = employees[employeeIndex];
      const competencyKeys = competencyProfiles[employeeSeed.competencyProfile];

      competencyKeys.forEach((key, assignmentIndex) => {
        const competencyDefinitionId = competencyLookup.get(key);
        if (!competencyDefinitionId) {
          return;
        }

        const level =
          (employeeSeed.competencyProfile === 'new-hire' && assignmentIndex > 1) ||
          (employeeIndex + assignmentIndex) % 6 === 0
            ? null
            : ((employeeIndex + assignmentIndex) % 5) + 1;
        const approvedAt = level ? shiftDays(baseDate, -(employeeIndex * 7 + assignmentIndex * 9 + 12)) : null;
        const approvedBy = level ? approvers[(employeeIndex + assignmentIndex) % approvers.length] : null;

        insertEmployeeCompetency.run({
          employeeId: employeeRow.id,
          competencyDefinitionId,
          level,
          approvedAt,
          approvedBy,
          note:
            level === null
              ? 'Noch in Einarbeitung oder Freigabe ausstehend.'
              : assignmentIndex % 3 === 0
                ? 'Sicher im Touralltag beobachtet.'
                : null,
        });
      });

      const instructionKeys = instructionProfiles[employeeSeed.instructionProfile];
      instructionKeys.forEach((key, assignmentIndex) => {
        const instructionDefinitionId = instructionLookup.get(key);
        if (!instructionDefinitionId) {
          return;
        }

        const mode = (employeeIndex + assignmentIndex) % 3;
        const dueDate =
          mode === 0
            ? shiftDays(baseDate, -(assignmentIndex * 21 + 30))
            : mode === 1
              ? shiftDays(baseDate, assignmentIndex * 12 + 14)
              : shiftDays(baseDate, -(assignmentIndex * 10 + 8));
        const completedAt = mode === 0 ? shiftDays(baseDate, -(assignmentIndex * 21 + 37)) : null;
        const conductedBy = completedAt ? approvers[(employeeIndex + assignmentIndex + 1) % approvers.length] : null;

        insertEmployeeInstruction.run({
          employeeId: employeeRow.id,
          instructionDefinitionId,
          dueDate,
          completedAt,
          conductedBy,
          note:
            mode === 1
              ? 'Naechster Termin bereits geplant.'
              : mode === 2
                ? 'Nachweis steht noch aus.'
                : null,
        });
      });
    });
  });

  seed();
};
