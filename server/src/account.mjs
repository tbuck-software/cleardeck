import { openStore } from './store.mjs';

const [action, username, role = 'editor'] = process.argv.slice(2);
if (!['set', 'disable'].includes(action) || !username) {
  throw new Error('Aufruf: npm run account -- set BENUTZER reader|editor|admin oder disable BENUTZER. Passwort für set über stdin.');
}
const store = await openStore(process.env.DATABASE_URL);
try {
  if (action === 'disable') {
    if (!(await store.disableAccount(username))) throw new Error('Konto nicht gefunden.');
  } else {
    let password = '';
    for await (const chunk of process.stdin) {
      password += chunk.toString();
      if (password.length > 258) throw new Error('Passwort zu lang.');
    }
    await store.setAccount(username, password.replace(/\r?\n$/, ''), role);
  }
  console.log('Konto aktualisiert. Bestehende Sitzungen wurden widerrufen.');
} finally { await store.close(); }
