import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID } from 'node:crypto';
import { matches } from '../security/credentials.mjs';
export class Store {
  constructor(filename = ':memory:', brokerUrl = '') {
    this.brokerUrl = brokerUrl;
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS installations(id TEXT PRIMARY KEY, secret TEXT NOT NULL, token TEXT NOT NULL, bins TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS alarms(device TEXT NOT NULL, kind TEXT NOT NULL, active INTEGER NOT NULL, PRIMARY KEY(device,kind));
      CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, installation TEXT NOT NULL, device TEXT NOT NULL, topic TEXT NOT NULL,
        kind TEXT NOT NULL, name TEXT NOT NULL, created INTEGER NOT NULL, due INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
        ticket TEXT, ticket_token TEXT);`);
  }
  get(id) { return this.db.prepare('SELECT * FROM installations WHERE id=?').get(id); }
  registrationCount() { return this.db.prepare('SELECT COUNT(*) AS n FROM installations').get().n; }
  authorize(id, secret) { const row = this.get(id); return !!row && matches(secret, row.secret); }
  register(id, token, bins, secret) {
    const credential = secret || randomBytes(32).toString('hex');
    this.db.prepare(`INSERT INTO installations VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET secret=excluded.secret,token=excluded.token,bins=excluded.bins`).run(id, credential, token, JSON.stringify(bins));
    // Remove jobs for bins no longer followed. Pending jobs use the latest token/name.
    for (const job of this.db.prepare('SELECT id,device,topic FROM jobs WHERE installation=?').all(id)) {
      if (!bins.some(b => b.id === job.device && b.topic === job.topic)) this.removeJob(job.id);
    }
    return credential;
  }
  remove(id) {
    this.db.exec('BEGIN');
    try {
      this.db.prepare('DELETE FROM jobs WHERE installation=?').run(id);
      this.db.prepare('DELETE FROM installations WHERE id=?').run(id);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  removeToken(id, token) { if (this.get(id)?.token === token) this.remove(id); }
  transition(device, topic, kind, active, now) {
    this.db.exec('BEGIN');
    try {
      const previous = this.db.prepare('SELECT active FROM alarms WHERE device=? AND kind=?').get(device, kind);
      this.db.prepare('INSERT INTO alarms VALUES(?,?,?) ON CONFLICT(device,kind) DO UPDATE SET active=excluded.active').run(device, kind, Number(active));
      if (!active) this.db.prepare('DELETE FROM jobs WHERE device=? AND kind=? AND ticket IS NULL').run(device, kind);
      if (active && !previous?.active) {
        for (const row of this.db.prepare('SELECT * FROM installations').all()) {
          const bin = JSON.parse(row.bins).find(b => b.id === device && b.topic === topic);
          if (bin) this.db.prepare('INSERT INTO jobs(id,installation,device,topic,kind,name,created,due) VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(), row.id, device, topic, kind, bin.name, now, now);
        }
      }
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  due(now) { return this.db.prepare('SELECT * FROM jobs WHERE due<=? ORDER BY due LIMIT 30').all(now); }
  removeJob(id) { this.db.prepare('DELETE FROM jobs WHERE id=?').run(id); }
  retry(job, now) {
    if (job.attempts >= 5 || now - job.created > 15 * 60_000) { this.removeJob(job.id); return; }
    this.db.prepare('UPDATE jobs SET attempts=attempts+1,due=?,ticket=NULL,ticket_token=NULL WHERE id=?').run(now + Math.min(120_000, 2000 * 2 ** job.attempts), job.id);
  }
  ticket(job, ticket, token, now) { this.db.prepare('UPDATE jobs SET ticket=?,ticket_token=?,due=? WHERE id=?').run(ticket, token, now + 15 * 60_000, job.id); }
  postpone(job, now) { this.db.prepare('UPDATE jobs SET due=? WHERE id=?').run(now + 60_000, job.id); }
  close() { this.db.close(); }
}
