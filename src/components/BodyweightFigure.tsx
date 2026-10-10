import React, { useMemo } from 'react';
import { Animated } from 'react-native';
import Svg, { Circle, G, Line, Rect } from 'react-native-svg';
import { BodyweightGuide, Pose } from '../data/bodyweightGuides';

const MovingLine = Animated.createAnimatedComponent(Line);
const MovingCircle = Animated.createAnimatedComponent(Circle);
const INK = '#16384D';
const BLUE = '#0065B3';
type Joint = keyof Pose;

/** A compact side-view illustration; SVG coordinates animate without React frame updates. */
export function BodyweightFigure({ guide, progress }: { guide: BodyweightGuide; progress: Animated.Value }) {
    const coordinates = useMemo(() => {
        const withFoot = (pose: Pose): Pose => ({
            ...pose,
            toe: guide.scene === 'standing' ? [pose.ankle[0] + 16, 199]
                : guide.name === 'Leg Raise' ? [pose.ankle[0] + 3, pose.ankle[1] - 12]
                    : guide.scene === 'floor' || guide.scene === 'wheel' ? [pose.ankle[0] - 10, 195]
                        : [pose.ankle[0] - 10, pose.ankle[1] + 6],
        });
        const [start, end] = guide.poses.map(withFoot);
        const result: Partial<Record<Joint, readonly [number | Animated.AnimatedInterpolation<number>, number | Animated.AnimatedInterpolation<number>]>> = {};
        (Object.keys(start) as Joint[]).forEach(joint => {
            const from = start[joint];
            const to = end[joint];
            if (!from || !to) return;
            const coordinate = (axis: 0 | 1) => from[axis] === to[axis] ? from[axis] : progress.interpolate<number>({
                inputRange: [0, 1], outputRange: [from[axis], to[axis]], extrapolate: 'clamp',
            });
            result[joint] = [coordinate(0), coordinate(1)];
        });
        return result;
    }, [guide, progress]);

    const limb = (from: Joint, to: Joint, color = INK, thickness = 8) => {
        const first = coordinates[from];
        const second = coordinates[to];
        if (!first || !second) return null;
        return <MovingLine key={`${from}-${to}`} x1={first[0]} y1={first[1]} x2={second[0]} y2={second[1]}
            stroke={color} strokeWidth={thickness} strokeLinecap="round" />;
    };
    const head = coordinates.head!;
    const hand = coordinates.hand!;

    return (
        <Svg viewBox="0 0 320 220" width="100%" height="100%" accessible={false}>
            <Rect x="0" y="0" width="320" height="220" rx="18" fill="#EDF5FA" />
            {guide.scene !== 'bar' ? <Line x1="24" y1="203" x2="296" y2="203" stroke="#A7BECC" strokeWidth="2" /> : null}
            {guide.scene === 'floor' || guide.scene === 'wheel' ? (
                <Rect x="44" y="192" width="242" height="10" rx="3" fill="#B6D5E5" />
            ) : null}
            {guide.scene === 'bar' ? (
                <G stroke="#738999" strokeWidth="6" strokeLinecap="round">
                    <Line x1="92" y1="28" x2="236" y2="28" />
                    <Line x1="92" y1="28" x2="92" y2="199" />
                    <Line x1="236" y1="28" x2="236" y2="199" />
                </G>
            ) : null}
            {guide.scene === 'parallelBars' ? (
                <G stroke="#738999" strokeWidth="6" strokeLinecap="round">
                    <Line x1="104" y1="105" x2="213" y2="105" />
                    <Line x1="112" y1="114" x2="225" y2="114" />
                    <Line x1="112" y1="114" x2="112" y2="199" />
                    <Line x1="225" y1="114" x2="225" y2="199" />
                </G>
            ) : null}
            {limb('shoulder', 'elbowBack', '#7595AC', 7)}
            {limb('elbowBack', 'handBack', '#7595AC', 7)}
            {limb('hip', 'knee', INK, 10)}
            {limb('knee', 'ankle', INK, 9)}
            {limb('ankle', 'toe', INK, 7)}
            {limb('shoulder', 'hip', BLUE, 15)}
            {limb('shoulder', 'head', INK, 8)}
            {limb('shoulder', 'elbow', BLUE, 8)}
            {limb('elbow', 'hand', INK, 8)}
            <MovingCircle cx={head[0]} cy={head[1]} r="11" fill="#E6AE78" stroke={INK} strokeWidth="3" />
            <MovingCircle cx={hand[0]} cy={hand[1]} r="4" fill="#E6AE78" />
            {guide.scene === 'wheel' ? (
                <>
                    <MovingCircle cx={hand[0]} cy="184" r="13" fill="#FFFFFF" stroke={INK} strokeWidth="5" />
                    <MovingCircle cx={hand[0]} cy="184" r="3" fill={BLUE} />
                </>
            ) : null}
        </Svg>
    );
}
