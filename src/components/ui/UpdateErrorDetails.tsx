import { useRef, useState } from 'react';

const UpdateErrorDetails = ({ message }: { message: string }) => {
  const details = useRef<HTMLTextAreaElement>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const copyError = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopyStatus('Kopiert');
    } catch {
      details.current?.focus();
      details.current?.select();
      setCopyStatus('Text markiert. Bitte mit Strg+C oder ⌘C kopieren.');
    }
  };

  return (
    <div className="update-error-details">
      <textarea
        ref={details}
        aria-label="Update-Fehlerdetails"
        readOnly
        rows={6}
        value={message}
        spellCheck={false}
      />
      <div className="update-error-actions">
        <button type="button" className="ghost-button" onClick={() => void copyError()}>Fehler kopieren</button>
        {copyStatus && <span role="status">{copyStatus}</span>}
      </div>
    </div>
  );
};

export default UpdateErrorDetails;
