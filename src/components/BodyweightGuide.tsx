import React, { useEffect, useRef, useState } from 'react';
import {
    AccessibilityInfo, Animated, AppState, Easing, Modal, ScrollView,
    StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BodyweightGuide as Guide, getBodyweightGuide } from '../data/bodyweightGuides';
import { COLORS, FONT_SIZE, SPACING } from '../constants/theme';
import { useLanguage } from '../i18n';
import { BodyweightFigure } from './BodyweightFigure';

function GuideDialog({ guide, onClose }: { guide: Guide; onClose: () => void }) {
    const { t, exerciseLabel } = useLanguage();
    const insets = useSafeAreaInsets();
    const progress = useRef(new Animated.Value(0)).current;
    const [playing, setPlaying] = useState(false);
    const [phase, setPhase] = useState<0 | 1>(0);
    // Do not animate while the OS accessibility preference is still unknown.
    const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

    useEffect(() => {
        let alive = true;
        let preferenceChanged = false;
        const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
            preferenceChanged = true;
            setReduceMotion(value);
            if (value) setPlaying(false);
        });
        AccessibilityInfo.isReduceMotionEnabled().then(value => {
            if (alive && !preferenceChanged) setReduceMotion(value);
        }).catch(() => {
            if (alive && !preferenceChanged) setReduceMotion(true);
        });
        const appSubscription = AppState.addEventListener('change', state => {
            if (state !== 'active') setPlaying(false);
        });
        return () => {
            alive = false;
            subscription.remove();
            appSubscription.remove();
        };
    }, []);

    useEffect(() => {
        if (!playing || reduceMotion !== false || guide.hold) {
            progress.setValue(phase);
            return;
        }
        progress.setValue(0);
        const options = { duration: 1500, easing: Easing.inOut(Easing.cubic), useNativeDriver: false };
        const animation = Animated.loop(Animated.sequence([
            Animated.delay(500),
            Animated.timing(progress, { ...options, toValue: 1 }),
            Animated.delay(500),
            Animated.timing(progress, { ...options, toValue: 0 }),
        ]));
        animation.start();
        return () => {
            animation.stop();
            progress.stopAnimation();
        };
    }, [guide, phase, playing, progress, reduceMotion]);

    const selectPhase = (next: 0 | 1) => {
        setPlaying(false);
        setPhase(next);
    };
    const phaseLabel = playing ? t('動作の見本', 'Movement example') : t(...guide.phases[phase]);

    return (
        <Modal visible transparent animationType="none" onRequestClose={onClose}>
            <View style={[styles.overlay, { paddingTop: insets.top + SPACING.m, paddingBottom: insets.bottom + SPACING.m }]}>
                <View style={styles.dialog} accessibilityViewIsModal onAccessibilityEscape={onClose}>
                    <View style={styles.header}>
                        <View style={styles.titleGroup}>
                            <Text style={styles.eyebrow}>{t('自重の動作ガイド', 'Bodyweight guide')}</Text>
                            <Text style={styles.title} accessibilityRole="header">{exerciseLabel(guide.name)}</Text>
                        </View>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityRole="button">
                            <Text style={styles.actionText}>{t('閉じる', 'Close')}</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={styles.content}>
                        <Text style={styles.description}>{t('使うもの', 'Equipment')}: {t(...guide.equipment)}</Text>
                        <Text style={styles.description}>{t('主に使う部位', 'Main muscles')}: {t(...guide.muscles)}</Text>
                        <View style={styles.figure} accessible accessibilityRole="image"
                            accessibilityLabel={`${exerciseLabel(guide.name)}: ${phaseLabel}. ${t(...guide.cue)}`}>
                            <BodyweightFigure guide={guide} progress={progress} />
                        </View>
                        <Text style={styles.phaseLabel}>{phaseLabel}</Text>
                        {!guide.hold ? (
                            <>
                                <View style={styles.phaseButtons}>
                                    {([0, 1] as const).map(next => (
                                        <TouchableOpacity key={next} onPress={() => selectPhase(next)} accessibilityRole="button"
                                            accessibilityState={{ selected: !playing && phase === next }}
                                            style={[styles.phaseButton, !playing && phase === next && styles.selectedPhase]}>
                                            <Text style={[styles.actionText, !playing && phase === next && styles.selectedText]}>
                                                {next === 0 ? t('開始姿勢', 'Start position') : t('動かした姿勢', 'End position')}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                {reduceMotion === false ? (
                                    <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: playing }}
                                        onPress={() => { setPhase(0); setPlaying(current => !current); }} style={styles.playButton}>
                                        <Ionicons name={playing ? 'stop-circle-outline' : 'play-circle-outline'} size={24} color="#FFFFFF" accessible={false} />
                                        <Text style={styles.playText}>{playing ? t('停止', 'Stop') : t('動きを再生', 'Play movement')}</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <Text style={styles.motionNote}>
                                        {reduceMotion === null
                                            ? t('開始姿勢と動かした姿勢を切り替えて確認できます。', 'Switch between the start and end positions to view the movement.')
                                            : t('動きを減らす設定に合わせて、静止画で表示しています。', 'Showing still positions to respect your reduced-motion setting.')}
                                    </Text>
                                )}
                            </>
                        ) : null}
                        <Text style={styles.sectionTitle} accessibilityRole="header">{t('動きのポイント', 'How to move')}</Text>
                        {guide.steps.map((step, index) => (
                            <View key={index} style={styles.step}>
                                <Text style={styles.stepNumber}>{index + 1}</Text>
                                <Text style={[styles.description, styles.stepText]}>{t(...step)}</Text>
                            </View>
                        ))}
                        <View style={styles.cue}><Text style={styles.cueText}>{t(...guide.cue)}</Text></View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

function GuideLauncher({ guide }: { guide: Guide }) {
    const { t, exerciseLabel } = useLanguage();
    const [open, setOpen] = useState(false);
    return (
        <>
            <TouchableOpacity style={styles.launcher} accessibilityRole="button"
                accessibilityLabel={t(`${exerciseLabel(guide.name)}の動作ガイドを開く`, `Open ${exerciseLabel(guide.name)} movement guide`)}
                onPress={() => setOpen(true)}>
                <Ionicons name="body-outline" size={24} color={COLORS.accent} accessible={false} />
                <View style={styles.titleGroup}>
                    <Text style={styles.actionText}>{t('動きを確認する', 'See how to move')}</Text>
                    <Text style={styles.description}>{t('自重の動作ガイド・オフライン対応', 'Bodyweight guide · available offline')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.accent} accessible={false} />
            </TouchableOpacity>
            {open ? <GuideDialog guide={guide} onClose={() => setOpen(false)} /> : null}
        </>
    );
}

export function BodyweightGuide({ exerciseName }: { exerciseName: string }) {
    const guide = getBodyweightGuide(exerciseName);
    return guide ? <GuideLauncher key={guide.name} guide={guide} /> : null;
}

const styles = StyleSheet.create({
    launcher: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: SPACING.s, padding: 12, borderRadius: 12, backgroundColor: '#EAF3FF', borderWidth: 1, borderColor: '#B6D1F3' },
    titleGroup: { flex: 1, gap: 4 },
    overlay: { flex: 1, justifyContent: 'center', paddingHorizontal: SPACING.m, backgroundColor: 'rgba(0,0,0,0.5)' },
    dialog: { width: '100%', maxWidth: 600, alignSelf: 'center', maxHeight: '100%', backgroundColor: COLORS.surface, borderRadius: 20, overflow: 'hidden', flexShrink: 1 },
    header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.s, padding: SPACING.m, borderBottomWidth: 1, borderColor: COLORS.border },
    eyebrow: { color: COLORS.textSecondary, fontSize: FONT_SIZE.s },
    title: { color: COLORS.text, fontSize: FONT_SIZE.l, fontWeight: '700' },
    closeButton: { minHeight: 48, minWidth: 64, justifyContent: 'center', alignItems: 'center', padding: SPACING.s },
    content: { padding: SPACING.m, gap: SPACING.s },
    description: { color: COLORS.textSecondary, fontSize: FONT_SIZE.m, lineHeight: 24 },
    figure: { width: '100%', aspectRatio: 320 / 220, marginTop: SPACING.s },
    phaseLabel: { color: COLORS.text, fontSize: FONT_SIZE.m, fontWeight: '600', textAlign: 'center' },
    phaseButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.s, marginTop: SPACING.s },
    phaseButton: { flexBasis: 120, flexGrow: 1, minHeight: 48, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
    selectedPhase: { backgroundColor: COLORS.accent },
    selectedText: { color: '#FFFFFF' },
    actionText: { color: COLORS.accent, fontSize: FONT_SIZE.m, fontWeight: '600', textAlign: 'center' },
    playButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, gap: SPACING.s, borderRadius: 10, backgroundColor: COLORS.accent },
    playText: { color: '#FFFFFF', fontSize: FONT_SIZE.m, fontWeight: '700', flexShrink: 1 },
    motionNote: { color: COLORS.textSecondary, fontSize: FONT_SIZE.s, lineHeight: 22, padding: SPACING.s },
    sectionTitle: { color: COLORS.text, fontSize: FONT_SIZE.l, fontWeight: '700', marginTop: SPACING.m },
    step: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.s, paddingVertical: 4 },
    stepNumber: { color: COLORS.accent, fontSize: FONT_SIZE.m, fontWeight: '700', lineHeight: 24, minWidth: 20 },
    stepText: { flex: 1, color: COLORS.text },
    cue: { backgroundColor: COLORS.background, borderRadius: 12, padding: SPACING.m, marginTop: SPACING.s },
    cueText: { color: COLORS.text, fontSize: FONT_SIZE.m, lineHeight: 24, fontWeight: '500' },
});
