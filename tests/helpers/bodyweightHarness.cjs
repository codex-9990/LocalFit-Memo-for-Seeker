globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');

function createGuideHarness({ reduceMotion = false, deferPreference = false, failPreference = false } = {}) {
    const state = { loops: [], values: [], listeners: new Map(), activeSubscriptions: 0 };
    let resolvePreference;
    const preference = deferPreference ? new Promise(resolve => { resolvePreference = resolve; })
        : failPreference ? Promise.reject(new Error('Preference unavailable')) : Promise.resolve(reduceMotion);
    const subscribe = (name, handler) => {
        state.listeners.set(name, handler);
        state.activeSubscriptions++;
        return { remove() { state.listeners.delete(name); state.activeSubscriptions--; } };
    };
    class Value {
        constructor(value) { this.value = value; state.values.push(this); }
        setValue(value) { this.value = value; }
        stopAnimation() {}
        interpolate({ outputRange }) {
            return { __getValue: () => outputRange[0] + (outputRange[1] - outputRange[0]) * this.value };
        }
    }
    const Animated = {
        Value, createAnimatedComponent: component => component,
        delay: duration => ({ type: 'delay', duration }),
        timing: (value, options) => ({ type: 'timing', value, options }),
        sequence: steps => ({ steps }),
        loop: sequence => {
            const loop = { sequence, running: false, start() { this.running = true; }, stop() { this.running = false; } };
            state.loops.push(loop);
            return loop;
        },
    };
    const stubs = {
        react: React,
        'react-native': {
            Animated, Easing: { cubic: value => value ** 3, inOut: easing => easing },
            AccessibilityInfo: { addEventListener: subscribe, isReduceMotionEnabled: () => preference },
            AppState: { currentState: 'active', addEventListener: subscribe },
            View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', ScrollView: 'ScrollView',
            Modal: ({ children, ...props }) => React.createElement('Modal', props, children),
            StyleSheet: { create: styles => styles },
        },
        'react-native-svg': { __esModule: true, default: 'svg', Circle: 'circle', G: 'g', Line: 'line', Rect: 'rect' },
        'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 20, left: 0, right: 0 }) },
        '@expo/vector-icons': { Ionicons: 'Icon' },
    };
    const modules = new Map();
    const root = path.resolve(__dirname, '../..');
    function load(filename) {
        if (modules.has(filename)) return modules.get(filename).exports;
        if (filename === path.join(root, 'src/i18n.tsx')) return {
            useLanguage: () => ({ language: 'en', t: (_, english) => english, exerciseLabel: name => name }),
        };
        const module = { exports: {} };
        modules.set(filename, module);
        const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
            fileName: filename,
            compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
        }).outputText;
        const localRequire = name => {
            if (name in stubs) return stubs[name];
            if (!name.startsWith('.')) throw new Error(`Unexpected dependency: ${name}`);
            const base = path.resolve(path.dirname(filename), name);
            const file = ['.ts', '.tsx'].map(extension => base + extension).find(candidate => fs.existsSync(candidate));
            if (!file) throw new Error(`Cannot resolve ${name}`);
            return load(file);
        };
        new Function('require', 'module', 'exports', source)(localRequire, module, module.exports);
        return module.exports;
    }
    const { BodyweightGuide } = load(path.join(root, 'src/components/BodyweightGuide.tsx'));
    const { BodyweightFigure } = load(path.join(root, 'src/components/BodyweightFigure.tsx'));
    const catalog = load(path.join(root, 'src/data/bodyweightGuides.ts'));
    let view;
    const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : node.children.map(text).join('');
    const controls = label => view.root.findAll(node => node.type === 'TouchableOpacity' && (
        node.props.accessibilityLabel === label || text(node) === label
    ));
    const press = label => {
        const matches = controls(label);
        assert.equal(matches.length, 1, `Expected one control '${label}'`);
        assert.notEqual(matches[0].props.disabled, true);
        act(() => matches[0].props.onPress());
    };
    return {
        state, Animated, BodyweightFigure, catalog,
        mount(name = 'Push Up') { act(() => { view = create(React.createElement(BodyweightGuide, { exerciseName: name })); }); },
        replace(name) { act(() => view.update(React.createElement(BodyweightGuide, { exerciseName: name }))); },
        unmount() { if (view) act(() => { view.unmount(); view = null; }); },
        get view() { return view; },
        controls, press,
        async open(name = 'Push Up') {
            press(`Open ${name} movement guide`);
            await act(async () => { await Promise.resolve(); });
        },
        async resolvePreference(value) {
            await act(async () => { resolvePreference(value); await Promise.resolve(); });
        },
        emit(name, value) { act(() => state.listeners.get(name)?.(value)); },
        back() { act(() => view.root.findByType('Modal').props.onRequestClose()); },
    };
}

module.exports = { createGuideHarness };
