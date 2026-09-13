import supertest from 'supertest';
import { createApp } from '../../src/app.js';

// A fresh Express app per import is fine here - it's cheap to construct
// (no listener is bound) and keeps tests from sharing any accidental
// module-level state across files.
export function testAgent() {
  return supertest(createApp());
}
