import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, NightDigest, ReadNight } from './types.js';

type RunEvent = {
  at: string;
  job: string;
  status: DigestRow['lastStatus'];
  owner: string | null;
  error?: string;
};

function isRunEvent(value: unknown): value is RunEvent {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const event = value as Record<string, unknown>;
  return (
    typeof event.at === 'string' &&
    event.at.length > 0 &&
    typeof event.job === 'string' &&
    event.job.length > 0 &&
    (event.status === 'ok' || event.status === 'retry' || event.status === 'fail') &&
    (event.owner === null || typeof event.owner === 'string') &&
    (event.error === undefined || typeof event.error === 'string')
  );
}

export const readNight: ReadNight = (runsDir, night): NightDigest => {
  const content = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  const lines = content.split(/\r?\n/);

  // A final newline terminates the last record; it does not add a blank record.
  if (lines.at(-1) === '') {
    lines.pop();
  }

  const rowsByJob = new Map<string, DigestRow>();
  let badLines = 0;

  for (const line of lines) {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      badLines += 1;
      continue;
    }

    if (!isRunEvent(value)) {
      badLines += 1;
      continue;
    }

    const row = rowsByJob.get(value.job);
    if (row === undefined) {
      rowsByJob.set(value.job, {
        job: value.job,
        owner: value.owner,
        runs: 1,
        retries: value.status === 'retry' ? 1 : 0,
        lastStatus: value.status,
        lastError: value.error ?? null,
        firstAt: value.at,
        lastAt: value.at,
      });
      continue;
    }

    row.owner = value.owner;
    row.runs += 1;
    if (value.status === 'retry') {
      row.retries += 1;
    }
    row.lastStatus = value.status;
    if (value.error !== undefined) {
      row.lastError = value.error;
    }
    row.lastAt = value.at;
  }

  return { rows: [...rowsByJob.values()], badLines };
};
