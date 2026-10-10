globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');

const projectRoot = path.resolve(__dirname, '..');

// Exercise the actual screen and hooks; only native rendering, navigation and
// storage are replaced so these interaction regressions can run without a device.
function mountWorkout(t, initialSets = [], { failRead = null } = {}) {
    const state = {
        exercises: [
            { id: 1, name: 'Bench Press', target_body_part: 'Chest' },
            { id: 2, name: 'Squat', target_body_part: 'Legs' },
        ],
        sets: initialSets.map(set => ({ ...set })),
        alerts: [],
        navigations: [],
        deletedWorkouts: [],
        failSave: false,
        failRead,
        guard: null,
    };
    const navigation = {
        goBack: () => {
            const action = { type: 'GO_BACK' };
            if (state.guard?.enabled) state.guard.callback({ data: { action } });
            else state.navigations.push(action);
        },
        dispatch: action => state.navigations.push(action),
    };
    const save = (onSuccess, onError, mutation) => {
        if (state.failSave) {
            onError(new Error('Storage unavailable'));
            return;
        }
        mutation();
        onSuccess();
    };
    const database = {
        getExercises: (callback, onError) => {
            if (state.failRead === 'exercises') onError(new Error('Exercise read failed'));
            else callback([...state.exercises]);
        },
        getSetsForWorkout: (_, callback, onError) => {
            if (state.failRead === 'sets') onError(new Error('Set read failed'));
            else callback(state.sets.map(set => ({
                ...set,
                exercise_name: state.exercises.find(exercise => exercise.id === set.exercise_id)?.name,
            })));
        },
        getLastSetForExercise: (_, callback) => callback(null),
        addSet: (workoutId, exerciseId, weight, reps, callback, onError) => save(callback, onError, () => {
            state.sets.push({
                id: Math.max(0, ...state.sets.map(set => set.id)) + 1,
                workout_id: workoutId, exercise_id: exerciseId, weight_kg: weight, reps,
            });
        }),
        updateSet: (id, weight, reps, callback, onError) => save(callback, onError, () => {
            Object.assign(state.sets.find(set => set.id === id), { weight_kg: weight, reps });
        }),
        deleteSet: (id, callback) => {
            state.sets = state.sets.filter(set => set.id !== id);
            callback();
        },
        deleteWorkout: (id, callback) => {
            state.deletedWorkouts.push(id);
            callback();
        },
        addExercise: (name, bodyPart, callback) => {
            const id = Math.max(...state.exercises.map(exercise => exercise.id)) + 1;
            state.exercises.push({ id, name: name.trim(), target_body_part: bodyPart });
            callback(id);
        },
        getRoutines: callback => callback([]),
    };
    const native = {
        View: 'View', Text: 'Text', TextInput: 'TextInput', TouchableOpacity: 'TouchableOpacity',
        KeyboardAvoidingView: 'KeyboardAvoidingView',
        ScrollView: React.forwardRef((props, ref) => {
            React.useImperativeHandle(ref, () => ({ scrollTo() {} }));
            return React.createElement('ScrollView', props, props.children);
        }),
        Modal: ({ visible, children }) => visible ? React.createElement('Modal', null, children) : null,
        Platform: { OS: 'android' },
        StyleSheet: { create: styles => styles },
        Alert: { alert: (title, message, buttons = [], options) => state.alerts.push({ title, message, buttons, options }) },
    };
    const language = {
        language: 'en',
        t: (_, english) => english,
        bodyPartLabel: part => part || 'Other',
        exerciseLabel: name => name,
    };
    const stubs = {
        react: React,
        'react-native': native,
        'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
        '@expo/vector-icons': { Ionicons: 'Icon' },
        'expo-router': {
            useLocalSearchParams: () => ({ id: '7' }),
            Stack: { Screen: ({ options }) => options.headerRight?.() ?? null },
        },
        '@react-navigation/native': {
            useNavigation: () => navigation,
            usePreventRemove: (enabled, callback) => { state.guard = { enabled, callback }; },
        },
        '../src/database/db': database,
        '../src/i18n': { useLanguage: () => language },
        // The guide's own playback and accessibility behavior is tested separately.
        '../src/components/BodyweightGuide': { BodyweightGuide: () => null },
    };
    const modules = new Map();
    function load(filename) {
        if (modules.has(filename)) return modules.get(filename).exports;
        const module = { exports: {} };
        modules.set(filename, module);
        const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
            fileName: filename,
        }).outputText;
        const localRequire = name => {
            if (name in stubs) return stubs[name];
            if (!name.startsWith('.')) throw new Error(`Unexpected screen dependency: ${name}`);
            const base = path.resolve(path.dirname(filename), name);
            const resolved = ['.ts', '.tsx', '.js'].map(extension => base + extension).find(candidate => fs.existsSync(candidate));
            if (!resolved) throw new Error(`Cannot resolve ${name} from ${filename}`);
            return load(resolved);
        };
        new Function('require', 'module', 'exports', source)(localRequire, module, module.exports);
        return module.exports;
    }
    const WorkoutScreen = load(path.join(projectRoot, 'app/workout.tsx')).default;
    let view;
    act(() => { view = create(React.createElement(WorkoutScreen)); });
    t.after(() => act(() => view.unmount()));
    const text = node => typeof node === 'string' || typeof node === 'number'
        ? String(node) : node.children.map(text).join('');
    const control = (label, type = 'TouchableOpacity') => {
        const candidates = view.root.findAll(node => node.type === type && (
            node.props.accessibilityLabel === label || text(node) === label
        ));
        assert.equal(candidates.length, 1, `Expected one ${type} labeled "${label}", found ${candidates.length}`);
        return candidates[0];
    };
    return {
        state, view, control,
        press(label) {
            const button = control(label);
            assert.notEqual(button.props.disabled, true, `Cannot press disabled button "${label}"`);
            act(() => button.props.onPress());
        },
        input(label, value) { act(() => control(label, 'TextInput').props.onChangeText(value)); },
        answer(label) {
            const alert = state.alerts.at(-1);
            assert.ok(alert, 'Expected an alert');
            const button = alert.buttons.find(button => button.text === label);
            assert.ok(button, `Missing "${label}" in alert "${alert.title}"`);
            act(() => button.onPress?.());
        },
        attemptBack() {
            assert.equal(state.guard.enabled, true, 'Unsaved input must block navigation');
            act(() => state.guard.callback({ data: { action: { type: 'GO_BACK' } } }));
        },
    };
}

function enterSet(screen, weight = '40', reps = '8') {
    screen.press('Bench Press');
    screen.input('Weight in kilograms', weight);
    screen.input('Repetitions', reps);
}

test('saving retains values for another set without treating them as unsaved input', t => {
    const screen = mountWorkout(t);
    enterSet(screen);
    screen.press('Save set');

    assert.deepEqual(screen.state.sets, [
        { id: 1, workout_id: 7, exercise_id: 1, weight_kg: 40, reps: 8 },
    ]);
    assert.equal(screen.control('Weight in kilograms', 'TextInput').props.value, '40');
    assert.equal(screen.control('Repetitions', 'TextInput').props.value, '8');
    assert.equal(screen.state.guard.enabled, false);

    screen.press('Record another identical set');
    assert.equal(screen.state.sets.length, 2);
    screen.press('Finish');
    assert.equal(screen.state.navigations.length, 1);
    assert.equal(screen.state.alerts.length, 0);
    assert.deepEqual(screen.state.deletedWorkouts, []);
});

test('Finish lets the user cancel or save the pending set before leaving', t => {
    const screen = mountWorkout(t);
    enterSet(screen, '52.5', '10');
    screen.press('Finish');
    screen.answer('Cancel');

    assert.equal(screen.state.sets.length, 0);
    assert.equal(screen.state.navigations.length, 0);
    assert.equal(screen.control('Weight in kilograms', 'TextInput').props.value, '52.5');
    assert.equal(screen.control('Repetitions', 'TextInput').props.value, '10');

    screen.press('Finish');
    screen.answer('Save and continue');
    assert.deepEqual(screen.state.sets, [
        { id: 1, workout_id: 7, exercise_id: 1, weight_kg: 52.5, reps: 10 },
    ]);
    assert.equal(screen.state.navigations.length, 1);
    assert.deepEqual(screen.state.deletedWorkouts, []);
});

test('system back can discard only the draft while preserving saved sets', t => {
    const saved = { id: 4, workout_id: 7, exercise_id: 2, weight_kg: 60, reps: 5 };
    const screen = mountWorkout(t, [saved]);
    enterSet(screen);
    screen.attemptBack();
    screen.answer('Discard');

    assert.deepEqual(screen.state.sets, [saved]);
    assert.deepEqual(screen.state.navigations, [{ type: 'GO_BACK' }]);
    assert.deepEqual(screen.state.deletedWorkouts, []);
});

test('a failed save cannot dismiss the draft or complete navigation', t => {
    const screen = mountWorkout(t);
    enterSet(screen);
    screen.state.failSave = true;
    screen.attemptBack();
    screen.answer('Save and continue');

    assert.equal(screen.state.sets.length, 0);
    assert.equal(screen.state.navigations.length, 0);
    assert.equal(screen.state.guard.enabled, true);
    assert.equal(screen.control('Weight in kilograms', 'TextInput').props.value, '40');
    assert.equal(screen.control('Repetitions', 'TextInput').props.value, '8');

    screen.state.failSave = false;
    screen.press('Save set');
    assert.equal(screen.state.sets.length, 1);
    assert.equal(screen.state.guard.enabled, false);
});

test('changing exercises requires a decision before clearing the draft', t => {
    const screen = mountWorkout(t);
    enterSet(screen);
    screen.press('Squat');
    screen.answer('Cancel');
    assert.equal(screen.control('Weight in kilograms', 'TextInput').props.value, '40');
    assert.equal(screen.state.sets.length, 0);

    screen.press('Squat');
    screen.answer('Save and continue');
    assert.equal(screen.state.sets[0].exercise_id, 1);
    assert.equal(screen.control('Weight in kilograms', 'TextInput').props.value, '');
    assert.equal(screen.control('Repetitions', 'TextInput').props.value, '');
    screen.input('Weight in kilograms', '70');
    screen.input('Repetitions', '5');
    screen.press('Save set');
    assert.deepEqual(screen.state.sets.map(({ exercise_id, weight_kg, reps }) => ({ exercise_id, weight_kg, reps })), [
        { exercise_id: 1, weight_kg: 40, reps: 8 },
        { exercise_id: 2, weight_kg: 70, reps: 5 },
    ]);
});

test('switching from an existing set to another exercise cannot overwrite the original set', t => {
    const saved = { id: 4, workout_id: 7, exercise_id: 1, weight_kg: 40, reps: 8 };
    const screen = mountWorkout(t, [saved]);
    screen.press('Bench Press, 1 set, 40 kg, 8 reps, edit');
    assert.equal(screen.control('Weight in kilograms', 'TextInput').props.value, '40');
    assert.equal(screen.state.guard.enabled, false);
    screen.press('Squat');

    assert.equal(screen.state.alerts.length, 0);
    assert.equal(screen.control('Weight in kilograms', 'TextInput').props.value, '');
    assert.equal(screen.control('Repetitions', 'TextInput').props.value, '');
    screen.input('Weight in kilograms', '70');
    screen.input('Repetitions', '5');
    screen.press('Save set');

    assert.deepEqual(screen.state.sets, [
        saved,
        { id: 5, workout_id: 7, exercise_id: 2, weight_kg: 70, reps: 5 },
    ]);
});

test('adding an exercise chooses its body part, clears filters and selects it for immediate recording', t => {
    const screen = mountWorkout(t);
    screen.press('Legs');
    screen.input('Search exercises', 'not found');
    screen.press('New exercise');
    screen.input('Exercise name', 'Cable Rotation');
    const modal = screen.view.root.findByType('Modal');
    const bodyPart = modal.findAllByType('TouchableOpacity').find(node => node.props.accessibilityLabel === 'Core');
    assert.ok(bodyPart, 'The add-exercise dialog must offer a body part selection');
    act(() => bodyPart.props.onPress());
    screen.press('Add and select');

    assert.deepEqual(screen.state.exercises.at(-1), { id: 3, name: 'Cable Rotation', target_body_part: 'Core' });
    assert.equal(screen.control('Search exercises', 'TextInput').props.value, '');
    assert.equal(screen.control('All').props.accessibilityState.selected, true);
    assert.equal(screen.control('Cable Rotation').props.accessibilityState.selected, true);

    screen.input('Weight in kilograms', '10');
    screen.input('Repetitions', '12');
    screen.press('Save set');
    assert.deepEqual(screen.state.sets, [
        { id: 1, workout_id: 7, exercise_id: 3, weight_kg: 10, reps: 12 },
    ]);
});

test('typing values before choosing the first exercise preserves the draft and allows saving', t => {
    const screen = mountWorkout(t);
    screen.input('Weight in kilograms', '25');
    screen.input('Repetitions', '12');
    screen.press('Bench Press');

    assert.equal(screen.state.alerts.length, 0);
    assert.equal(screen.control('Weight in kilograms', 'TextInput').props.value, '25');
    assert.equal(screen.control('Repetitions', 'TextInput').props.value, '12');
    assert.equal(screen.state.guard.enabled, true);
    screen.press('Save set');
    assert.deepEqual(screen.state.sets, [
        { id: 1, workout_id: 7, exercise_id: 1, weight_kg: 25, reps: 12 },
    ]);
});

for (const failRead of ['exercises', 'sets']) {
    test(`a failed ${failRead} read blocks saving and retry preserves both existing records and the draft`, t => {
        const saved = { id: 4, workout_id: 7, exercise_id: 2, weight_kg: 60, reps: 5 };
        const screen = mountWorkout(t, [saved], { failRead });
        assert.equal(screen.control('Save set').props.disabled, true);
        screen.control('Retry loading');
        screen.input('Weight in kilograms', '25');
        screen.input('Repetitions', '12');
        screen.press('Finish');
        screen.answer('Save and continue');

        assert.deepEqual(screen.state.sets, [saved]);
        assert.deepEqual(screen.state.deletedWorkouts, []);
        assert.equal(screen.state.navigations.length, 0);
        assert.equal(screen.state.alerts.at(-1).title, 'Session unavailable');
        assert.equal(screen.control('Weight in kilograms', 'TextInput').props.value, '25');
        assert.equal(screen.control('Repetitions', 'TextInput').props.value, '12');

        screen.state.failRead = null;
        screen.press('Retry loading');
        assert.equal(screen.control('Save set').props.disabled, false);
        screen.control('Squat, 1 set, 60 kg, 5 reps, edit');
        screen.press('Bench Press');
        screen.press('Save set');
        assert.deepEqual(screen.state.sets, [
            saved,
            { id: 5, workout_id: 7, exercise_id: 1, weight_kg: 25, reps: 12 },
        ]);
    });
}
