const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/utils/workoutInput.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const inputModule = { exports: {} };
vm.runInNewContext(compiled, { exports: inputModule.exports, module: inputModule });
const { parseWorkoutInput } = inputModule.exports;

test('bodyweight, fractional weights and surrounding whitespace retain their intended values', () => {
    for (const [weightText, repsText, weight, reps] of [
        ['0', '1', 0, 1],
        [' 42.5 ', ' 12 ', 42.5, 12],
        ['.5', '1', 0.5, 1],
        ['1.', '10', 1, 10],
    ]) {
        const actual = parseWorkoutInput(weightText, repsText);
        assert.equal(actual.ok, true, `${weightText} / ${repsText}`);
        assert.equal(actual.weight, weight);
        assert.equal(actual.reps, reps);
    }
});

test('missing fields are distinguished from invalid numbers', () => {
    for (const [weight, reps] of [['', '1'], ['0', ''], ['  ', '  ']]) {
        const actual = parseWorkoutInput(weight, reps);
        assert.equal(actual.ok, false);
        assert.equal(actual.reason, 'missing');
    }
});

test('pasted suffixes, fractional reps and invalid numeric values are rejected without truncation', () => {
    for (const [weight, reps] of [
        ['42kg', '10'], ['40', '3.5'], ['40', '10x'],
        ['-1', '1'], ['40', '0'], ['40', '-1'],
        ['Infinity', '5'], ['NaN', '5'], ['1e3', '5'], ['.', '5'],
        ['40', '9007199254740993'],
    ]) {
        const actual = parseWorkoutInput(weight, reps);
        assert.equal(actual.ok, false, `${weight} / ${reps}`);
        assert.equal(actual.reason, 'invalid');
    }
});
