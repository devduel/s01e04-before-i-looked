import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { NightDigest } from '../src/digest/types.js';

const night = '2026-11-09';
const expectedJobs = ['alpha-job', 'mu-job', 'zeta-job'];

let runsDir: string;

beforeEach(async () => {
  runsDir = await mkdtemp(join(tmpdir(), 'rig-digest-routes-'));
});

afterEach(async () => {
  await rm(runsDir, { recursive: true, force: true });
});

function app() {
  return createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
}

async function writeNight(lines: string[]) {
  await writeFile(join(runsDir, `${night}.jsonl`), lines.join('\n'), 'utf8');
}

function logLine(at: string, job: string) {
  return JSON.stringify({ at, job, status: 'ok', owner: 'ops' });
}

describe('digest routes', () => {
  it('returns the same sorted jobs from the page and JSON API', async () => {
    await writeNight([
      logLine('2026-11-09T03:00:00+01:00', 'zeta-job'),
      logLine('2026-11-09T03:01:00+01:00', 'alpha-job'),
      logLine('2026-11-09T03:02:00+01:00', 'mu-job'),
    ]);

    const routeApp = app();
    const pageResponse = await routeApp.request(`/digest/${night}`);
    const jsonResponse = await routeApp.request(`/api/digest/${night}`);

    expect(pageResponse.status).toBe(200);
    expect(jsonResponse.status).toBe(200);

    const html = await pageResponse.text();
    const digest = (await jsonResponse.json()) as NightDigest;
    const apiJobs = digest.rows.map((row) => row.job);
    const pageJobs = expectedJobs
      .filter((job) => html.includes(job))
      .sort((left, right) => html.indexOf(left) - html.indexOf(right));

    expect(apiJobs).toEqual(expectedJobs);
    expect(pageJobs).toEqual(apiJobs);
  });

  it('returns 404 from both routes when the night file is missing', async () => {
    const routeApp = app();

    const pageResponse = await routeApp.request(`/digest/${night}`);
    const jsonResponse = await routeApp.request(`/api/digest/${night}`);

    expect(pageResponse.status).toBe(404);
    expect(jsonResponse.status).toBe(404);
  });

  it('renders an empty night and returns no rows', async () => {
    await writeNight([]);
    const routeApp = app();

    const pageResponse = await routeApp.request(`/digest/${night}`);
    const jsonResponse = await routeApp.request(`/api/digest/${night}`);

    expect(pageResponse.status).toBe(200);
    expect(await pageResponse.text()).toContain('nothing ran');
    expect(jsonResponse.status).toBe(200);
    expect((await jsonResponse.json() as NightDigest).rows).toEqual([]);
  });

  it('keeps valid rows when a night contains a malformed line', async () => {
    await writeNight([
      'not json',
      logLine('2026-11-09T03:00:00+01:00', 'alpha-job'),
    ]);
    const routeApp = app();

    const pageResponse = await routeApp.request(`/digest/${night}`);
    const jsonResponse = await routeApp.request(`/api/digest/${night}`);

    expect(pageResponse.status).toBe(200);
    expect(await pageResponse.text()).toContain('alpha-job');
    expect(jsonResponse.status).toBe(200);
    expect(await jsonResponse.json()).toMatchObject({
      badLines: 1,
      rows: [{ job: 'alpha-job' }],
    });
  });
});
