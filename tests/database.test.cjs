const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');

// Exercise date boundaries in the user's time zone, including UTC's previous day.
process.env.TZ = 'Asia/Tokyo';

const source = fs.readFileSync(path.join(__dirname, '../src/database/db.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const plain = (value) => JSON.parse(JSON.stringify(value));

function fixture(t, initialize = true) {
    const sqlite = new DatabaseSync(':memory:');
    t.after(() => sqlite.close());
    const control = { fail: null, openFailure: false, imported: null, canceled: false, exported: null, shared: null };
    const check = (sql) => {
        if (control.fail?.test(sql)) throw new Error('Simulated storage failure');
    };
    const database = {
        execSync(sql) { check(sql); sqlite.exec(sql); },
        runSync(sql, args = []) {
            check(sql);
            const result = sqlite.prepare(sql).run(...args);
            return { lastInsertRowId: Number(result.lastInsertRowid), changes: result.changes };
        },
        getFirstSync(sql, args = []) { check(sql); return sqlite.prepare(sql).get(...args) ?? null; },
        getAllSync(sql, args = []) { check(sql); return sqlite.prepare(sql).all(...args); },
        withTransactionSync(callback) {
            sqlite.exec('BEGIN');
            try { callback(); sqlite.exec('COMMIT'); }
            catch (error) { sqlite.exec('ROLLBACK'); throw error; }
        },
    };
    const stubs = {
        'expo-sqlite': { openDatabaseSync: () => {
            if (control.openFailure) throw new Error('Database could not open');
            return database;
        } },
        'expo-file-system/legacy': {
            documentDirectory: 'test://documents/',
            writeAsStringAsync: async (_uri, content) => { control.exported = JSON.parse(content); },
            readAsStringAsync: async () => JSON.stringify(control.imported),
        },
        'expo-sharing': { shareAsync: async (uri) => { control.shared = uri; } },
        'expo-document-picker': {
            getDocumentAsync: async () => ({ canceled: control.canceled, assets: [{ uri: 'test://backup.json' }] }),
        },
    };
    const module = { exports: {} };
    vm.runInNewContext(compiled, {
        module, exports: module.exports, Date,
        console: { error() {} },
        require(name) {
            assert.ok(name in stubs, `Unexpected dependency: ${name}`);
            return stubs[name];
        },
    }, { filename: 'db.ts' });
    const api = module.exports;
    if (initialize) api.initDB();
    const result = (fn, ...args) => {
        let value;
        fn(...args, (received) => { value = received; }, (error) => { throw error; });
        return plain(value);
    };
    const rows = (table) => plain(sqlite.prepare(`SELECT * FROM ${table} ORDER BY id`).all());
    const snapshot = () => plain({
        exercises: rows('exercises'), workouts: rows('workouts'), sets: rows('sets'),
        routines: rows('routines'), routine_exercises: rows('routine_exercises'),
        preferences: sqlite.prepare('SELECT * FROM preferences ORDER BY key').all(),
    });
    const createWorkout = (date = '2026-10-10') => result(api.createWorkout, '', date);
    const exerciseId = initialize ? rows('exercises')[0]?.id : undefined;
    const createHistory = () => {
        const workoutId = createWorkout();
        api.addSet(workoutId, exerciseId, 60, 10, () => {});
        api.addSet(workoutId, exerciseId + 1, 25, 12, () => {});
        api.createRoutineFromWorkout(' My routine ', workoutId, () => {});
        return workoutId;
    };
    return { api, control, sqlite, result, rows, snapshot, createWorkout, exerciseId, createHistory };
}

test('version 2 backup round trips history and ordered presets while keeping local preferences', async (t) => {
    const f = fixture(t);
    const workoutId = f.createHistory();
    f.api.setPreference('language', 'ja');
    const before = f.snapshot();
    await f.api.exportDatabase();
    assert.equal(f.control.exported.version, 2);
    assert.equal(f.control.exported.routines[0].name, 'My routine');
    assert.equal(f.control.exported.routine_exercises.length, 2);
    assert.equal(f.control.exported.preferences, undefined);
    assert.equal(f.control.shared, 'test://documents/localfit_memo_backup.json');
    f.api.clearDatabase(() => {});
    f.control.imported = f.control.exported;
    let completed = 0;
    await f.api.importDatabase(() => { completed++; });
    assert.equal(completed, 1);
    assert.deepEqual(f.snapshot(), before);
    const routineId = f.rows('routines')[0].id;
    assert.deepEqual(f.result(f.api.getRoutineExercises, routineId).map((row) => row.exercise_id), [f.exerciseId, f.exerciseId + 1]);
    assert.equal(f.result(f.api.getSetsForWorkout, workoutId).length, 2);
});

test('version 1 backup replaces old presets and preserves the language preference', async (t) => {
    const f = fixture(t);
    f.createHistory();
    f.api.setPreference('language', 'en');
    f.control.imported = {
        version: 1,
        exercises: [{ id: 71, name: 'Custom', target_body_part: null }],
        workouts: [{ id: 81, date: '2026-10-01T05:00:00.000Z', note: null }],
        sets: [{ id: 91, workout_id: 81, exercise_id: 71, weight_kg: 0, reps: 8 }],
    };
    await f.api.importDatabase(() => {});
    assert.deepEqual(f.rows('routines'), []);
    assert.deepEqual(f.rows('routine_exercises'), []);
    assert.equal(f.rows('sets')[0].id, 91);
    assert.equal(f.rows('exercises')[0].target_body_part, 'Other');
    assert.equal(f.api.getPreference('language'), 'en');
});

test('legacy zero-rep records survive version 1 restore and version 2 backup roundtrip', async (t) => {
    const f = fixture(t);
    f.control.imported = {
        version: 1,
        exercises: [{ id: 71, name: 'Legacy exercise', target_body_part: 'Chest' }],
        workouts: [{ id: 81, date: '2026-10-01T05:00:00.000Z', note: 'Historical data' }],
        sets: [{ id: 91, workout_id: 81, exercise_id: 71, weight_kg: 60, reps: 0 }],
    };
    await f.api.importDatabase(() => {});
    const restored = f.snapshot();
    assert.equal(restored.sets[0].reps, 0);
    await f.api.exportDatabase();
    assert.equal(f.control.exported.version, 2);
    assert.equal(f.control.exported.sets[0].reps, 0);
    f.api.clearDatabase(() => {});
    f.control.imported = f.control.exported;
    await f.api.importDatabase(() => {});
    assert.deepEqual(f.snapshot(), restored);
});

test('invalid backups leave all current records and preferences untouched', async (t) => {
    const f = fixture(t);
    f.createHistory();
    f.api.setPreference('language', 'ja');
    await f.api.exportDatabase();
    const before = f.snapshot();
    const invalid = [
        (data) => { data.version = 99; },
        (data) => { data.version = null; },
        (data) => { delete data.routines; },
        (data) => { delete data.routine_exercises; },
        (data) => { data.exercises.push(data.exercises[0]); },
        (data) => { data.exercises[0].id = Number.MAX_SAFE_INTEGER + 1; },
        (data) => { data.workouts.push(data.workouts[0]); },
        (data) => { data.sets.push(data.sets[0]); },
        (data) => { data.routines.push(data.routines[0]); },
        (data) => { data.routine_exercises.push(data.routine_exercises[0]); },
        (data) => { data.sets[0].workout_id = 999; },
        (data) => { data.sets[0].exercise_id = 999; },
        (data) => { data.routine_exercises[0].routine_id = 999; },
        (data) => { data.routine_exercises[0].exercise_id = 999; },
        (data) => { data.routine_exercises[0].sort_order = -1; },
        (data) => { data.routine_exercises[1].sort_order = data.routine_exercises[0].sort_order; },
        (data) => { data.routine_exercises[1].exercise_id = data.routine_exercises[0].exercise_id; },
        (data) => { data.sets[0].weight_kg = -5; },
        (data) => { data.sets[0].reps = -1; },
        (data) => { data.sets[0].reps = 2.5; },
        (data) => { data.routines[0].name = '  '; },
        (data) => { data.workouts[0].date = 'not a date'; },
        (data) => { data.workouts[0].date = '2026-02-30'; },
    ];
    for (const mutate of invalid) {
        f.control.imported = structuredClone(f.control.exported);
        mutate(f.control.imported);
        let completed = false;
        await assert.rejects(f.api.importDatabase(() => { completed = true; }), /Invalid backup/);
        assert.equal(completed, false);
        assert.deepEqual(f.snapshot(), before);
    }
});

test('a storage error during import rolls the destructive replacement back', async (t) => {
    const f = fixture(t);
    f.createHistory();
    const before = f.snapshot();
    await f.api.exportDatabase();
    f.control.imported = f.control.exported;
    f.sqlite.exec("CREATE TRIGGER reject_import BEFORE INSERT ON sets BEGIN SELECT RAISE(ABORT, 'storage failure'); END;");
    await assert.rejects(f.api.importDatabase(() => assert.fail('Failed imports cannot complete')), /storage failure/);
    assert.deepEqual(f.snapshot(), before);
});

test('canceling the file picker does not replace data or report an import', async (t) => {
    const f = fixture(t);
    f.createHistory();
    const before = f.snapshot();
    f.control.canceled = true;
    await f.api.importDatabase(() => assert.fail('Canceled imports cannot complete'));
    assert.deepEqual(f.snapshot(), before);
});

test('createWorkout resumes any existing local date, including past dates and UTC boundaries', (t) => {
    const f = fixture(t);
    const past = f.createWorkout('2026-01-01');
    f.createWorkout('2026-10-10');
    assert.equal(f.createWorkout('2025-12-31T15:01:00.000Z'), past);
    assert.equal(f.createWorkout('2026-01-01T14:59:00.000Z'), past);
    assert.equal(f.createWorkout('2026-01-01'), past);
    const next = f.createWorkout('2026-01-01T15:00:00.000Z');
    assert.notEqual(next, past);
    assert.equal(f.rows('workouts').length, 3);
});

test('resuming an old duplicate date preserves separate existing sessions', (t) => {
    const f = fixture(t);
    const first = f.createHistory();
    const second = Number(f.sqlite.prepare('INSERT INTO workouts (date, note) VALUES (?, ?)').run('2026-10-10T08:00:00.000Z', 'Second session').lastInsertRowid);
    f.api.addSet(second, f.exerciseId, 80, 6, () => {});
    const before = f.snapshot();
    assert.equal(f.createWorkout('2026-10-10'), second);
    assert.deepEqual(f.snapshot(), before);
    assert.equal(f.rows('workouts').find((row) => row.id === first).note, '');
});

test('invalid dates do not create a workout', (t) => {
    const f = fixture(t);
    for (const date of ['invalid', '', '2026-02-30']) {
        let error;
        f.api.createWorkout('', date, () => assert.fail('Invalid date saved'), (received) => { error = received; });
        assert.match(error.message, /Invalid workout date/);
    }
    assert.deepEqual(f.rows('workouts'), []);
});

test('addExercise returns the new id, trims its name and normalizes an empty body part', (t) => {
    const f = fixture(t);
    const id = f.result(f.api.addExercise, '  My exercise  ', ' ');
    assert.ok(id > 0);
    assert.deepEqual(f.rows('exercises').find((row) => row.id === id), { id, name: 'My exercise', target_body_part: 'Other' });
    assert.throws(() => f.api.addExercise(' ', 'Chest', () => {}), /name is required/);
});

test('set values reject invalid reps and weights and leave saved values untouched', (t) => {
    const f = fixture(t);
    const workoutId = f.createWorkout();
    f.api.addSet(workoutId, f.exerciseId, 0, 8, () => {});
    const before = f.rows('sets');
    const setId = before[0].id;
    const invalid = [[-1, 10], [NaN, 10], [Infinity, 10], [20, 0], [20, -1], [20, 1.5], [20, Infinity], ['20', 10]];
    for (const [weight, reps] of invalid) {
        let errors = 0;
        const onError = () => { errors++; };
        f.api.addSet(workoutId, f.exerciseId, weight, reps, () => assert.fail('Invalid set inserted'), onError);
        f.api.updateSet(setId, weight, reps, () => assert.fail('Invalid set updated'), onError);
        assert.equal(errors, 2);
        assert.deepEqual(f.rows('sets'), before);
    }
    f.api.updateSet(setId, 22.5, 12, () => {});
    assert.equal(f.rows('sets')[0].weight_kg, 22.5);
    assert.equal(f.rows('sets')[0].reps, 12);
});

test('write failures report errors instead of success, and absent handlers throw', (t) => {
    const f = fixture(t);
    const workoutId = f.createHistory();
    const setId = f.rows('sets')[0].id;
    const before = f.snapshot();
    const fail = () => assert.fail('Storage failure reported as success');
    const operations = [
        (error) => f.api.createWorkout('', '2026-10-09', fail, error),
        (error) => f.api.addExercise('New', 'Chest', fail, error),
        (error) => f.api.addSet(workoutId, f.exerciseId, 20, 10, fail, error),
        (error) => f.api.updateSet(setId, 30, 12, fail, error),
        (error) => f.api.deleteSet(setId, fail, error),
        (error) => f.api.deleteWorkout(workoutId, fail, error),
        (error) => f.api.createRoutineFromWorkout('Another', workoutId, fail, error),
        (error) => f.api.clearDatabase(fail, error),
    ];
    f.control.fail = /INSERT|UPDATE|DELETE/;
    for (const operation of operations) {
        let received;
        operation((error) => { received = error; });
        assert.match(received.message, /storage failure/);
        assert.deepEqual(f.snapshot(), before);
    }
    assert.throws(() => f.api.addSet(workoutId, f.exerciseId, 20, 10, fail), /storage failure/);
});

test('read failures call error handlers without returning misleading empty states', (t) => {
    const f = fixture(t);
    const fail = () => assert.fail('Failed read returned data');
    f.control.fail = /SELECT/;
    const operations = [
        (error) => f.api.getWorkouts(fail, error),
        (error) => f.api.getExercises(fail, error),
        (error) => f.api.getSetsForWorkout(1, fail, error),
        (error) => f.api.getExerciseProgress(1, fail, error),
        (error) => f.api.getPersonalBests(fail, error),
        (error) => f.api.getLatestWorkout(fail, error),
        (error) => f.api.getLastSetForExercise(1, fail, error),
        (error) => f.api.getRoutines(fail, error),
        (error) => f.api.getRoutineExercises(1, fail, error),
    ];
    for (const operation of operations) {
        let received;
        operation((error) => { received = error; });
        assert.match(received.message, /storage failure/);
    }
});

test('progress uses the highest estimated 1RM in each session and retains maximum weight', (t) => {
    const f = fixture(t);
    const workoutId = f.createWorkout();
    f.api.addSet(workoutId, f.exerciseId, 100, 1, () => {});
    f.api.addSet(workoutId, f.exerciseId, 90, 10, () => {});
    const second = Number(f.sqlite.prepare('INSERT INTO workouts (date, note) VALUES (?, ?)').run(f.rows('workouts')[0].date, '').lastInsertRowid);
    f.api.addSet(second, f.exerciseId, 80, 6, () => {});
    const progress = f.result(f.api.getExerciseProgress, f.exerciseId);
    assert.equal(progress.length, 2);
    assert.equal(progress[0].max_weight, 100);
    assert.equal(progress[0].one_rep_max, 120);
    assert.equal(progress[1].one_rep_max, 96);
});

test('reset removes workouts and every preset reference, restores defaults, and preserves preferences', (t) => {
    const f = fixture(t);
    const defaultCount = f.rows('exercises').length;
    f.createHistory();
    f.api.addExercise('Custom exercise', 'Core', () => {});
    f.api.setPreference('language', 'ja');
    let completed = 0;
    f.api.clearDatabase(() => { completed++; });
    assert.equal(completed, 1);
    for (const table of ['sets', 'workouts', 'routines', 'routine_exercises']) assert.deepEqual(f.rows(table), []);
    assert.equal(f.rows('exercises').length, defaultCount);
    assert.equal(f.api.getPreference('language'), 'ja');
    assert.deepEqual(plain(f.sqlite.prepare('PRAGMA foreign_key_check').all()), []);
});

test('reset rolls back existing data if restoring defaults fails', (t) => {
    const f = fixture(t);
    f.createHistory();
    const before = f.snapshot();
    f.sqlite.exec("CREATE TRIGGER reject_defaults BEFORE INSERT ON exercises BEGIN SELECT RAISE(ABORT, 'storage failure'); END;");
    let error;
    f.api.clearDatabase(() => assert.fail('Failed reset completed'), (received) => { error = received; });
    assert.match(error.message, /storage failure/);
    assert.deepEqual(f.snapshot(), before);
});

test('deleting a workout deletes its sets atomically and preserves usable presets', (t) => {
    const f = fixture(t);
    const workoutId = f.createHistory();
    f.api.deleteWorkout(workoutId, () => {});
    assert.deepEqual(f.rows('sets'), []);
    assert.deepEqual(f.rows('workouts'), []);
    assert.equal(f.rows('routines').length, 1);
    assert.equal(f.rows('routine_exercises').length, 2);
    assert.deepEqual(plain(f.sqlite.prepare('PRAGMA foreign_key_check').all()), []);
});

test('initialization and preference failures propagate so the UI can offer retry', (t) => {
    const f = fixture(t, false);
    f.control.openFailure = true;
    assert.throws(() => f.api.initDB(), /could not open/);
    f.control.openFailure = false;
    f.control.fail = /CREATE TABLE/;
    assert.throws(() => f.api.initDB(), /storage failure/);
    f.control.fail = null;
    f.api.initDB();
    assert.equal(f.api.getPreference('language'), null);
    f.api.setPreference('language', 'ja');
    f.api.setPreference('language', 'en');
    assert.equal(f.api.getPreference('language'), 'en');
    f.control.fail = /preferences/;
    assert.throws(() => f.api.setPreference('language', 'ja'), /storage failure/);
    assert.throws(() => f.api.getPreference('language'), /storage failure/);
});
