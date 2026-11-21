import fs from 'node:fs'; import vm from 'node:vm';
import { perfect } from './perfect.mjs';
const w = {}; vm.runInNewContext(fs.readFileSync(new URL('../public/data.js', import.meta.url), 'utf8'), { window: w });
fs.writeFileSync('/tmp/d.json', JSON.stringify({ D: w.W13, perfect: perfect() }));
