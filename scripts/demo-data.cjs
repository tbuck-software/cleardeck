/* eslint-disable @typescript-eslint/no-var-requires -- Standalone CommonJS Electron launcher. */
const { seedDatabase } = require('../src/main/database/seed.ts');
const { nextDueDate } = require('../src/utils/instructionSchedule.ts');
const { localDate } = require('../src/utils/calendarDate.ts');
const { nextDeviceId } = require('../src/main/syncRecords.ts');

// Called only by the explicit demo launcher, on a new isolated database.
module.exports = function populateDemo(db) {
  for (const table of ['employees', 'patients', 'audits']) {
    if (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n)
      throw Error('Demo requires an empty database');
  }
  const today = localDate(new Date());
  const shift = (date, days) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + days);
    return localDate(d);
  };
  const fte = (hours) => Math.min(hours, 36) / 36;
  const duringEmployment = (employeeId, date) => {
    const period = db
      .prepare(
        'SELECT startDate,endDate FROM employment_periods WHERE employeeId=? AND startDate<=? ORDER BY startDate DESC LIMIT 1',
      )
      .get(employeeId, date);
    return period?.endDate && period.endDate < date ? period.endDate : date;
  };
  db.transaction(() => {
    seedDatabase(db);
    db.prepare("UPDATE settings SET value='36' WHERE key='baseHours'").run();
    db.prepare(
      "INSERT OR REPLACE INTO settings(key,value) VALUES('demoProfile','synthetic-v1')",
    ).run();
    db.exec("DELETE FROM employee_events WHERE type IN ('fte-change','weekly-hours-change')");
    const insertTerm = db.prepare(
      'INSERT INTO employment_terms(id,periodId,effectiveFrom,weeklyHours,fte,verified,sourceRef) VALUES(?,?,?,?,?,?,?)',
    );
    for (const e of db.prepare('SELECT * FROM employees ORDER BY id').all()) {
      db.prepare('UPDATE employees SET name=?, note=?, fte=? WHERE id=?').run(
        e.name,
        `[DEMO] ${e.note || 'Frei erfundene Testperson.'}`,
        fte(e.weeklyHours),
        e.id,
      );
      for (const p of db.prepare('SELECT * FROM employment_periods WHERE employeeId=?').all(e.id)) {
        const end = p.endDate && p.endDate < today ? p.endDate : today;
        const days = Math.floor(
          (new Date(`${end}T12:00:00`) - new Date(`${p.startDate}T12:00:00`)) / 86400000,
        );
        const change = days > 180 ? shift(p.startDate, Math.floor(days / 2)) : null;
        const verified = e.id % 9 ? 1 : 0;
        const source = verified ? `DEMO-Personalakte ${e.id} / Abschnitt ${p.id}` : null;
        insertTerm.run(
          nextDeviceId(db, 'employment_terms'),
          p.id,
          p.startDate,
          change ? Math.max(12, e.weeklyHours - 6) : e.weeklyHours,
          fte(change ? Math.max(12, e.weeklyHours - 6) : e.weeklyHours),
          verified,
          source,
        );
        if (change) {
          insertTerm.run(
            nextDeviceId(db, 'employment_terms'),
            p.id,
            change,
            e.weeklyHours,
            fte(e.weeklyHours),
            verified,
            source,
          );
          db.prepare(
            'INSERT INTO employee_events(id,employeeId,eventDate,type,title,details) VALUES(?,?,?,?,?,?)',
          ).run(
            nextDeviceId(db, 'employee_events'),
            e.id,
            change,
            'weekly-hours-change',
            'Demo: Wochenstunden geändert',
            `Neuer Stundenstand ${e.weeklyHours} h; synthetischer Änderungsvertrag.`,
          );
        }
      }
    }
    const insertTermHistory = db.prepare(
      'INSERT INTO employment_term_history(id,periodId,effectiveFrom,weeklyHours,fte,verified,sourceRef) VALUES(?,?,?,?,?,?,?)',
    );
    for (const term of db
      .prepare(
        'SELECT periodId,effectiveFrom,weeklyHours,fte,verified,sourceRef FROM employment_terms',
      )
      .all())
      insertTermHistory.run(
        nextDeviceId(db, 'employment_term_history'),
        term.periodId,
        term.effectiveFrom,
        term.weeklyHours,
        term.fte,
        term.verified,
        term.sourceRef,
      );
    for (const p of db.prepare('SELECT * FROM patients ORDER BY id').all()) {
      const ended = p.id % 19 === 0;
      const unknown = p.id % 13 === 0;
      const codes = p.hkpCode ? [p.hkpCode] : [];
      if (p.id % 8 === 0 && !codes.includes('31a')) codes.push('31a');
      if (p.id % 16 === 0 && !codes.includes('6')) codes.push('6');
      const source =
        p.mobilityImpaired == null || p.cognitionImpaired == null
          ? 'unknown'
          : p.id % 3 === 0
            ? 'own'
            : 'report';
      db.prepare(
        `UPDATE patients SET name=?,note=?,serviceStatus=?,serviceEndDate=?,serviceScope=?,representativeStatus=?,contact=?,hkpCodes=?,hkpCode=?,assessmentSource=?,assessmentDate=?,assessmentNote=?,akiSetting=?,phkpFirst=?,phkpStartDate=? WHERE id=?`,
      ).run(
        p.name,
        `[DEMO] ${unknown ? 'Absichtlich offen: Leistungsumfang prüfen. ' : ''}${p.note || 'Frei erfundener Versorgungsfall.'}`,
        ended ? 'ended' : 'active',
        ended ? shift(today, -10) : null,
        unknown ? 'unknown' : p.id % 17 === 0 ? 'excluded' : 'eligible',
        p.id % 15 === 0 ? 'unknown' : p.contact ? 'present' : 'none',
        p.contact ? `Demo-Kontakt ${p.id} · 0000 000000 (nicht erreichbar)` : null,
        JSON.stringify(codes),
        codes[0] || null,
        source,
        source === 'unknown' ? null : shift(today, p.id % 11 === 0 ? -420 : -35),
        source === 'unknown'
          ? 'DEMO: Einschätzung fehlt absichtlich.'
          : 'DEMO: synthetischer Beleg; veraltete Fälle absichtlich zur Nachprüfung.',
        p.intensiveCare?.startsWith('AKI') ? (p.id % 2 ? 'EV' : 'MV') : null,
        p.intensiveCare?.startsWith('pHKP') ? 1 : 0,
        p.intensiveCare?.startsWith('pHKP') ? shift(today, -12) : null,
        p.id,
      );
      if (ended)
        db.prepare('DELETE FROM patient_visits WHERE patientId=? AND visitDate>?').run(
          p.id,
          shift(today, -10),
        );
      const earliest = db
        .prepare('SELECT MIN(visitDate) AS date FROM patient_visits WHERE patientId=?')
        .get(p.id).date;
      if (earliest && p.admissionDate && earliest < p.admissionDate)
        db.prepare('UPDATE patients SET admissionDate=? WHERE id=?').run(shift(earliest, -1), p.id);
    }
    for (const v of db.prepare('SELECT * FROM patient_visits').all()) {
      const planned = v.visitDate > today;
      const resolved = !planned && v.actionNeeded && v.id % 4 === 0;
      db.prepare(
        'UPDATE patient_visits SET status=?,actionNeeded=?,assignedTo=?,actionDueDate=?,resolvedAt=?,comment=? WHERE id=?',
      ).run(
        planned ? 'planned' : 'completed',
        planned ? 0 : v.actionNeeded,
        !planned && v.actionNeeded ? 'Demo-Praxisanleitung' : null,
        !planned && v.actionNeeded ? shift(v.visitDate, 7) : null,
        resolved ? (shift(v.visitDate, 5) > today ? today : shift(v.visitDate, 5)) : null,
        planned
          ? 'DEMO: geplante Visite, noch nicht durchgeführt.'
          : `[DEMO] ${v.comment}${resolved ? ' Maßnahme erledigt und nachkontrolliert.' : ''}`,
        v.id,
      );
    }
    // Guarantee near-term planned visits and open, actionable cases on the dashboard.
    for (const [id, offset] of [
      [1, 3],
      [2, 10],
      [3, 21],
    ])
      db.prepare(
        'INSERT INTO patient_visits(id,patientId,visitDate,status,actionNeeded,comment) VALUES(?,?,?,?,0,?)',
      ).run(
        nextDeviceId(db, 'patient_visits'),
        id,
        shift(today, offset),
        'planned',
        'DEMO: nächster geplanter Hausbesuch.',
      );
    for (const id of [4, 5, 6])
      db.prepare(
        'INSERT INTO patient_visits(id,patientId,visitDate,status,actionNeeded,assignedTo,actionDueDate,comment) VALUES(?,?,?,?,1,?,?,?)',
      ).run(
        nextDeviceId(db, 'patient_visits'),
        id,
        shift(today, -3),
        'completed',
        'Demo-QM',
        shift(today, id - 5),
        'DEMO: Transfer beobachten, Hilfsmittel prüfen und Rückmeldung dokumentieren.',
      );

    // Replace only demo assignments to produce coherent evidence/follow-up pairs.
    db.exec('DELETE FROM employee_instructions');
    const definitions = db
      .prepare('SELECT * FROM instruction_definitions ORDER BY sortOrder,id LIMIT 8')
      .all();
    const insertInstruction = db.prepare(
      'INSERT INTO employee_instructions(id,employeeId,instructionDefinitionId,dueDate,completedAt,conductedBy,note,evidenceRef,content,previousInstructionId) VALUES(?,?,?,?,?,?,?,?,?,?)',
    );
    for (const e of db.prepare('SELECT * FROM employees').all()) {
      const start = db
        .prepare('SELECT MIN(startDate) AS date FROM employment_periods WHERE employeeId=?')
        .get(e.id).date;
      definitions.forEach((d, index) => {
        const complete = (e.id + index) % 3 !== 0;
        const proposed = shift(today, -30 - index * 13);
        const completion = complete
          ? duringEmployment(e.id, proposed < start ? start : proposed)
          : null;
        if (completion && completion <= today) {
          const result = insertInstruction.run(
            nextDeviceId(db, 'employee_instructions'),
            e.id,
            d.id,
            completion,
            completion,
            'Demo-Unterweisende Person',
            'DEMO: synthetischer Durchführungsnachweis.',
            (e.id + index) % 11 ? `DEMO-Akte ${e.id} / Nachweis ${d.id}` : null,
            `DEMO: ${d.topic}; Ablauf besprochen und praktisch geübt.`,
            null,
          );
          const next = nextDueDate(
            d.intervalMonths,
            e.birthDate,
            completion,
            Boolean(d.minorHazardInstruction),
          );
          if (next)
            insertInstruction.run(
              nextDeviceId(db, 'employee_instructions'),
              e.id,
              d.id,
              next,
              null,
              null,
              'DEMO: automatisch verknüpfter Folgetermin.',
              null,
              null,
              Number(result.lastInsertRowid),
            );
        } else
          insertInstruction.run(
            nextDeviceId(db, 'employee_instructions'),
            e.id,
            d.id,
            shift(today, (((e.id + index) % 5) - 2) * 10),
            null,
            null,
            'DEMO: offen; Durchführung noch zu dokumentieren.',
            null,
            null,
            null,
          );
      });
    }
    for (const [index, c] of db
      .prepare('SELECT * FROM employee_competencies ORDER BY employeeId,competencyDefinitionId')
      .all()
      .entries()) {
      const start = db
        .prepare('SELECT MIN(startDate) AS date FROM employment_periods WHERE employeeId=?')
        .get(c.employeeId).date;
      const level = start > today ? 0 : index % 7;
      const approved = level === 6;
      db.prepare(
        "UPDATE employee_competencies SET level=?,stageScheme='practice-v1',approvedAt=?,approvedBy=?,note=? WHERE employeeId=? AND competencyDefinitionId=?",
      ).run(
        level,
        approved
          ? duringEmployment(c.employeeId, start > shift(today, -4) ? start : shift(today, -4))
          : null,
        approved ? 'Demo-Praxisanleitung' : null,
        approved
          ? 'DEMO: Einarbeitung bestätigt abgeschlossen.'
          : 'DEMO: laufender oder noch offener Einarbeitungsstand.',
        c.employeeId,
        c.competencyDefinitionId,
      );
      if (start <= today)
        db.prepare(
          "INSERT INTO competency_history(id,employeeId,competencyDefinitionId,changedAt,level,approvedAt,approvedBy,note,stageScheme) VALUES(?,?,?,?,?,?,?,?,'practice-v1')",
        ).run(
          nextDeviceId(db, 'competency_history'),
          c.employeeId,
          c.competencyDefinitionId,
          `${start > shift(today, -10) ? start : shift(today, -10)} 12:00:00`,
          Math.max(0, level - 1),
          null,
          null,
          'DEMO: vorheriger Lernstand.',
        );
    }
    const audit = db
      .prepare(
        "INSERT INTO audits(id,auditDate,inspector,kind,findings,confirmed) VALUES(?,?,?,'regel',?,0)",
      )
      .run(
        nextDeviceId(db, 'audits'),
        shift(today, -7),
        'Demo-Prüfstelle',
        'DEMO-Entwurf: Originalbericht und Zuordnung noch abgleichen.',
      );
    for (const [key, result] of [
      ['qb1', 'B'],
      ['qb2', 'A'],
      ['qb3', 'C'],
      ['qb4', 'text'],
      ['qb5', 'ok'],
    ])
      db.prepare('INSERT INTO audit_results(id,auditId,sectionKey,result,note) VALUES(?,?,?,?,?)').run(
        nextDeviceId(db, 'audit_results'),
        Number(audit.lastInsertRowid),
        key,
        result,
        'DEMO: unbestätigte interne Zusammenfassung.',
      );
    for (const id of [1, 2, 3])
      db.prepare('INSERT INTO audit_clients(auditId,patientId) VALUES(?,?)').run(
        Number(audit.lastInsertRowid),
        id,
      );
    db.prepare(
      "INSERT INTO audits(id,auditDate,inspector,kind,findings,confirmed) VALUES(?,?,?,'anlass',?,0)",
    ).run(
      nextDeviceId(db, 'audits'),
      today,
      'Demo-Prüfstelle',
      'DEMO: leerer Entwurf zum Ausprobieren.',
    );
    if (db.pragma('foreign_key_check').length) throw Error('Demo foreign key check failed');
  })();
};
