const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/utils/date.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const dateModule = { exports: {} };
vm.runInNewContext(compiled, { exports: dateModule.exports, module: dateModule, Date });
const { toLocalDateKey, dateKeyToLocalNoon, datePartsToLocalNoon } = dateModule.exports;

// Node applies TZ changes to Date immediately. These tests run sequentially,
// restore TZ afterward, and are isolated from other test files by node:test.
function inTimeZone(zone, run) {
    const previous = process.env.TZ;
    process.env.TZ = zone;
    try {
        run();
    } finally {
        if (previous === undefined) delete process.env.TZ;
        else process.env.TZ = previous;
    }
}

const zones = [
    { zone: 'UTC', midnight: '2026-01-01', evening: '2026-12-31' },
    { zone: 'Asia/Tokyo', midnight: '2026-01-01', evening: '2027-01-01' },
    { zone: 'America/Los_Angeles', midnight: '2025-12-31', evening: '2026-12-31' },
];

for (const { zone, midnight, evening } of zones) {
    test(`imported calendar days stay on the selected date in ${zone}`, () => {
        inTimeZone(zone, () => {
            // Includes a leap day, year boundary, and both Los Angeles DST changes.
            for (const key of ['2024-02-29', '2026-01-01', '2026-03-08', '2026-10-10', '2026-11-01']) {
                assert.equal(toLocalDateKey(key), key);
                const local = dateKeyToLocalNoon(key);
                assert.equal(local.getHours(), 12);
                assert.equal(toLocalDateKey(local), key);
                assert.equal(toLocalDateKey(local.toISOString()), key);
                assert.equal(toLocalDateKey(local.getTime()), key);
            }
            const leapDay = datePartsToLocalNoon(2024, 2, 29);
            assert.equal(leapDay.getMonth(), 1);
            assert.equal(leapDay.getDate(), 29);
            assert.equal(toLocalDateKey(leapDay), '2024-02-29');
        });
    });

    test(`ISO instants still convert to the user's local day in ${zone}`, () => {
        inTimeZone(zone, () => {
            const start = '2026-01-01T00:30:00.000Z';
            const end = '2026-12-31T18:00:00.000Z';
            assert.equal(toLocalDateKey(start), midnight);
            assert.equal(toLocalDateKey(new Date(start)), midnight);
            assert.equal(toLocalDateKey(Date.parse(start)), midnight);
            assert.equal(toLocalDateKey(end), evening);
            assert.equal(toLocalDateKey('2027-01-01T03:00:00+09:00'), evening);
        });
    });
}
