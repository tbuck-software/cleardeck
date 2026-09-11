import { userFacingErrorMessage } from '../errorMessage';

describe('userFacingErrorMessage', () => {
  it('entfernt den Wrapper von Electron und behält die fachliche Meldung', () => {
    expect(
      userFacingErrorMessage(
        new Error("Error invoking remote method 'data:save': Beschäftigungsperiode überschneidet sich."),
      ),
    ).toBe('Beschäftigungsperiode überschneidet sich.');
    expect(
      userFacingErrorMessage(
        new Error("Error invoking remote method 'data:save': Error: Name ist erforderlich."),
      ),
    ).toBe('Name ist erforderlich.');
  });

  it('lässt eine bereits lesbare Meldung unverändert', () => {
    expect(userFacingErrorMessage(new Error('Name ist erforderlich.'))).toBe(
      'Name ist erforderlich.',
    );
  });

  it('nutzt den Ersatztext nur ohne Meldung', () => {
    expect(userFacingErrorMessage(new Error(''), 'Speichern fehlgeschlagen.')).toBe(
      'Speichern fehlgeschlagen.',
    );
    expect(userFacingErrorMessage(new Error(''))).toBe('Unbekannter Fehler');
  });
});
