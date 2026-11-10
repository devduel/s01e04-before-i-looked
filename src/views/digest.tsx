import type { NightDigest } from '../digest/types.js';

export function DigestPage({ night, digest }: { night: string; digest: NightDigest }) {
  const rows = [...digest.rows].sort((a, b) => a.job.localeCompare(b.job));

  return (
    <>
      <h1>digest · {night}</h1>
      {digest.badLines > 0 && (
        <p class="warn">
          {digest.badLines} malformed line{digest.badLines === 1 ? '' : 's'} skipped.
        </p>
      )}
      {rows.length === 0 ? (
        <p class="mute">{digest.badLines === 0 ? 'nothing ran' : 'no valid runs'}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">job</th>
              <th scope="col">owner</th>
              <th scope="col">runs</th>
              <th scope="col">retries</th>
              <th scope="col">last status</th>
              <th scope="col">last error</th>
              <th scope="col">first time</th>
              <th scope="col">last time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr>
                <td>{row.job}</td>
                <td>{row.owner ?? '—'}</td>
                <td>{row.runs}</td>
                <td>
                  {row.retries >= 3 ? <strong class="warn">{row.retries}</strong> : row.retries}
                </td>
                <td>
                  {row.lastStatus === 'fail' ? (
                    <strong class="warn">{row.lastStatus}</strong>
                  ) : (
                    row.lastStatus
                  )}
                </td>
                <td>{row.lastError ?? '—'}</td>
                <td>{row.firstAt}</td>
                <td>{row.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
