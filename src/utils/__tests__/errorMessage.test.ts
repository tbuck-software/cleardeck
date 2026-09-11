import { userFacingErrorMessage } from '../errorMessage';

describe('userFacingErrorMessage', () => {
  it('removes transport prefixes and keeps the operation detail', () => {
    expect(userFacingErrorMessage(new Error('API saveEmployee failed: Name ist erforderlich.'))).toBe(
      'Name ist erforderlich.',
    );
    expect(
      userFacingErrorMessage(
        new Error("Error invoking remote method 'data:save': Beschäftigungsperiode überschneidet sich."),
      ),
    ).toBe('Beschäftigungsperiode überschneidet sich.');
  });

  it('uses a stable fallback for empty errors', () => {
    expect(userFacingErrorMessage(new Error(''))).toBe('Unbekannter Fehler');
  });
});

