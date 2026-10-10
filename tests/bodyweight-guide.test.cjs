const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createGuideHarness } = require('./helpers/bodyweightHarness.cjs');

function fixture(t, options) {
    const guide = createGuideHarness(options);
    t.after(() => guide.unmount());
    return guide;
}

test('only explicitly supported bodyweight variations offer a movement guide', t => {
    const guide = fixture(t);
    for (const name of ['Bench Press', 'Squat', 'Lunges', 'My custom exercise']) {
        guide.mount(name);
        assert.equal(guide.view.toJSON(), null);
        guide.unmount();
    }
    for (const name of ['Push Up', 'Bodyweight Squat', 'Pull Up', 'Dips', 'Crunch', 'Plank', 'Leg Raise', 'Ab Wheel']) {
        guide.mount(name);
        assert.equal(guide.controls(`Open ${name} movement guide`).length, 1);
        guide.unmount();
    }
});

test('opening a guide does not autoplay; start/end positions and play/stop are explicit', async t => {
    const guide = fixture(t);
    guide.mount();
    await guide.open();
    assert.equal(guide.state.loops.length, 0);
    guide.press('End position');
    assert.equal(guide.state.values[0].value, 1);
    guide.press('Start position');
    assert.equal(guide.state.values[0].value, 0);
    guide.press('Play movement');
    assert.equal(guide.state.loops.at(-1).running, true);
    guide.press('Stop');
    assert.equal(guide.state.loops.at(-1).running, false);
    assert.equal(guide.state.values[0].value, 0);
});

test('a reduced-motion preference keeps guides usable as still positions without starting animation', async t => {
    const guide = fixture(t, { reduceMotion: true });
    guide.mount();
    await guide.open();
    assert.equal(guide.controls('Play movement').length, 0);
    guide.press('End position');
    assert.equal(guide.state.values[0].value, 1);
    assert.equal(guide.state.loops.length, 0);
});

test('enabling reduced motion during playback immediately stops it and never resumes automatically', async t => {
    const guide = fixture(t);
    guide.mount();
    await guide.open();
    guide.press('Play movement');
    guide.emit('reduceMotionChanged', true);
    assert.equal(guide.state.loops.at(-1).running, false);
    assert.equal(guide.controls('Play movement').length, 0);
    guide.emit('reduceMotionChanged', false);
    assert.equal(guide.controls('Play movement').length, 1);
    assert.equal(guide.state.loops.at(-1).running, false);
});

test('a later preference lookup cannot override a newer OS accessibility event', async t => {
    const guide = fixture(t, { deferPreference: true });
    guide.mount();
    await guide.open();
    assert.equal(guide.controls('Play movement').length, 0);
    guide.emit('reduceMotionChanged', true);
    await guide.resolvePreference(false);
    assert.equal(guide.controls('Play movement').length, 0);
    assert.equal(guide.state.loops.length, 0);
});

test('backgrounding, closing and changing exercises stop playback and clean up subscriptions', async t => {
    const guide = fixture(t);
    guide.mount();
    await guide.open();
    guide.press('Play movement');
    guide.emit('change', 'background');
    assert.equal(guide.state.loops.at(-1).running, false);
    guide.emit('change', 'active');
    assert.equal(guide.state.loops.at(-1).running, false);
    guide.press('Play movement');
    guide.back();
    assert.equal(guide.state.loops.at(-1).running, false);
    assert.equal(guide.state.activeSubscriptions, 0);
    await guide.open();
    guide.press('Play movement');
    guide.replace('Bench Press');
    assert.equal(guide.state.loops.at(-1).running, false);
    assert.equal(guide.state.activeSubscriptions, 0);
    assert.equal(guide.view.toJSON(), null);
});

test('plank is explained as a static hold rather than a repeated moving exercise', async t => {
    const guide = fixture(t);
    guide.mount('Plank');
    await guide.open('Plank');
    assert.equal(guide.controls('Play movement').length, 0);
    assert.equal(guide.controls('End position').length, 0);
    assert.equal(guide.state.loops.length, 0);
    assert.match(JSON.stringify(guide.view.toJSON()), /static hold/);
});

test('an unavailable accessibility preference falls back to still illustrations', async t => {
    const guide = fixture(t, { failPreference: true });
    guide.mount();
    await guide.open();
    guide.press('End position');
    assert.equal(guide.controls('Play movement').length, 0);
    assert.equal(guide.state.loops.length, 0);
});
