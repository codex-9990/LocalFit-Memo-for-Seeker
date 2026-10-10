import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Modal,
    ScrollView, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { COLORS, SPACING, FONT_SIZE, SHADOWS } from '../src/constants/theme';
import { getPersonalBests, getExerciseProgress, ExerciseProgress, PersonalBest } from '../src/database/db';
import { useLanguage } from '../src/i18n';
import { toLocalDateKey } from '../src/utils/date';

export default function StatsScreen() {
    const { t, exerciseLabel } = useLanguage();
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const [stats, setStats] = useState<PersonalBest[]>([]);
    const [recordsLoading, setRecordsLoading] = useState(true);
    const [recordsError, setRecordsError] = useState(false);
    const [selectedExercise, setSelectedExercise] = useState<{ name: string; id: number } | null>(null);
    const [chartData, setChartData] = useState<ExerciseProgress[]>([]);
    const [chartLoading, setChartLoading] = useState(false);
    const [chartError, setChartError] = useState(false);

    const loadRecords = useCallback(() => {
        setRecordsLoading(true);
        setRecordsError(false);
        getPersonalBests((records) => {
            setStats(records);
            setRecordsLoading(false);
        }, () => {
            setRecordsError(true);
            setRecordsLoading(false);
        });
    }, []);

    useFocusEffect(loadRecords);

    const openChart = (name: string, id: number) => {
        setSelectedExercise({ name, id });
        setChartData([]);
        setChartError(false);
        setChartLoading(true);
        getExerciseProgress(id, (data) => {
            setChartData(data);
            setChartLoading(false);
        }, () => {
            setChartError(true);
            setChartLoading(false);
        });
    };

    const closeChart = () => setSelectedExercise(null);
    const recentData = chartData.slice(-6);
    const chartWidth = Math.max(160, Math.min(width - SPACING.m * 2, 560) - SPACING.m * 2);
    const dateLabel = (date: string) => {
        const [year, month, day] = toLocalDateKey(date).split('-');
        return t(`${year}年${Number(month)}月${Number(day)}日`, `${Number(month)}/${Number(day)}/${year}`);
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{
                title: t('自己ベスト', 'Personal records'),
                headerLeft: () => (
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backButton}
                        accessibilityRole="button"
                        accessibilityLabel={t('戻る', 'Go back')}
                    >
                        <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                    </TouchableOpacity>
                ),
                headerShadowVisible: false,
                headerStyle: { backgroundColor: COLORS.background },
                headerTintColor: COLORS.text,
            }} />

            {recordsLoading ? (
                <View style={styles.stateContainer}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                    <Text style={styles.description} accessibilityLiveRegion="polite">
                        {t('記録を読み込み中…', 'Loading records…')}
                    </Text>
                </View>
            ) : recordsError ? (
                <View style={styles.stateContainer}>
                    <Text style={styles.stateTitle} accessibilityRole="alert">
                        {t('記録を読み込めませんでした', 'Could not load your records')}
                    </Text>
                    <Text style={styles.description}>{t('もう一度お試しください。', 'Please try again.')}</Text>
                    <TouchableOpacity style={styles.primaryButton} onPress={loadRecords} accessibilityRole="button">
                        <Text style={styles.primaryButtonText}>{t('再読み込み', 'Try again')}</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={stats}
                    keyExtractor={(item) => String(item.exerciseId)}
                    contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + SPACING.l }]}
                    ListHeaderComponent={stats.length > 0 ? (
                        <Text style={styles.listDescription}>
                            {t('種目ごとの最大重量と、そのときの回数です。種目を押すと推移を確認できます。',
                                'Your heaviest set for each exercise, with its reps. Select an exercise to see your progress.')}
                        </Text>
                    ) : null}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.card}
                            onPress={() => openChart(item.exerciseName, item.exerciseId)}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={t(
                                `${exerciseLabel(item.exerciseName)}、${item.maxWeight}キログラム、${item.bestReps}回。推移を見る`,
                                `${exerciseLabel(item.exerciseName)}, ${item.maxWeight} kilograms, ${item.bestReps} reps. View progress`,
                            )}
                        >
                            <View style={styles.iconContainer}>
                                <Ionicons name="trophy" size={24} color={COLORS.accent} />
                            </View>
                            <View style={styles.info}>
                                <Text style={styles.exerciseName}>{exerciseLabel(item.exerciseName)}</Text>
                                <Text style={styles.recordValue}>
                                    {item.maxWeight} <Text style={styles.recordDetail}>kg × {item.bestReps} {t('回', 'reps')}</Text>
                                </Text>
                                <Text style={styles.tapPrompt}>{t('推移を見る', 'View progress')}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View style={styles.stateContainer}>
                            <Ionicons name="barbell-outline" size={48} color={COLORS.accent} />
                            <Text style={styles.stateTitle}>{t('最初の記録をつけましょう', 'Log your first workout')}</Text>
                            <Text style={styles.description}>
                                {t('重量と回数を保存すると、ここに自己ベストが表示されます。',
                                    'Save a set with its weight and reps to see your personal records here.')}
                            </Text>
                            <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/')} accessibilityRole="button">
                                <Text style={styles.primaryButtonText}>{t('ホームで記録を始める', 'Go home to start logging')}</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}

            <Modal visible={selectedExercise !== null} transparent animationType="slide" onRequestClose={closeChart}>
                <View style={[styles.modalOverlay, {
                    paddingTop: insets.top + SPACING.m,
                    paddingBottom: insets.bottom + SPACING.m,
                }]}>
                    <View style={styles.modalCard} accessibilityViewIsModal onAccessibilityEscape={closeChart}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle} accessibilityRole="header">
                                {selectedExercise ? exerciseLabel(selectedExercise.name) : ''}
                            </Text>
                            <TouchableOpacity style={styles.closeButton} onPress={closeChart} accessibilityRole="button">
                                <Text style={styles.closeButtonText}>{t('閉じる', 'Close')}</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView contentContainerStyle={styles.modalBody}>
                            {chartLoading ? (
                                <View style={styles.chartState}>
                                    <ActivityIndicator size="large" color={COLORS.accent} />
                                    <Text style={styles.description} accessibilityLiveRegion="polite">
                                        {t('推移を読み込み中…', 'Loading progress…')}
                                    </Text>
                                </View>
                            ) : chartError ? (
                                <View style={styles.chartState}>
                                    <Text style={styles.stateTitle} accessibilityRole="alert">
                                        {t('推移を読み込めませんでした', 'Could not load your progress')}
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.primaryButton}
                                        accessibilityRole="button"
                                        onPress={() => {
                                            if (selectedExercise) openChart(selectedExercise.name, selectedExercise.id);
                                        }}
                                    >
                                        <Text style={styles.primaryButtonText}>{t('再読み込み', 'Try again')}</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <>
                                    <Text style={styles.sectionTitle} accessibilityRole="header">
                                        {t('直近6回の推移', 'Progress over your last 6 sessions')}
                                    </Text>
                                    <Text style={styles.listDescription}>
                                        {t('各回の最も高い推定1RMを表示します（最大6回）。',
                                            'Best estimated 1RM per session, for up to 6 sessions.')}
                                    </Text>
                                    {recentData.length < 2 ? (
                                        <View style={styles.chartState}>
                                            <Ionicons name="stats-chart" size={40} color={COLORS.accent} />
                                            <Text style={styles.description}>
                                                {t('この種目を2回以上のトレーニングで記録すると、グラフが表示されます。',
                                                    'Log this exercise in at least 2 sessions to see a chart.')}
                                            </Text>
                                        </View>
                                    ) : (
                                        <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                                            <LineChart
                                                data={{
                                                    labels: recentData.map((entry) => {
                                                        const [, month, day] = toLocalDateKey(entry.date).split('-');
                                                        return `${Number(month)}/${Number(day)}`;
                                                    }),
                                                    datasets: [{ data: recentData.map((entry) => entry.one_rep_max) }],
                                                }}
                                                width={chartWidth}
                                                height={220}
                                                yAxisSuffix="kg"
                                                chartConfig={{
                                                    backgroundColor: COLORS.surface,
                                                    backgroundGradientFrom: COLORS.surface,
                                                    backgroundGradientTo: COLORS.surface,
                                                    decimalPlaces: 0,
                                                    color: () => COLORS.accent,
                                                    labelColor: () => COLORS.textSecondary,
                                                    propsForDots: { r: '4', strokeWidth: '2', stroke: COLORS.accent },
                                                }}
                                                style={styles.chart}
                                            />
                                        </View>
                                    )}
                                    <View style={styles.explanationBox}>
                                        <Text style={styles.sectionTitle}>{t('推定1RMとは？', 'What is estimated 1RM?')}</Text>
                                        <Text style={styles.explanationText}>
                                            {t('記録した重量と回数から、1回だけ持ち上げられる重さの目安を計算しています。実際の限界重量を保証するものではありません。',
                                                'An estimate of the weight you could lift once, based on your logged weight and reps. It does not guarantee your actual maximum.')}
                                        </Text>
                                        <Text style={styles.formula}>
                                            {t('計算式：重量 ×（1 ＋ 回数 ÷ 30）', 'Formula: weight × (1 + reps ÷ 30)')}
                                        </Text>
                                    </View>
                                    {recentData.length > 0 ? (
                                        <View style={styles.valuesList}>
                                            <Text style={styles.sectionTitle} accessibilityRole="header">
                                                {t('日付ごとの推定1RM', 'Estimated 1RM by date')}
                                            </Text>
                                            {recentData.map((entry, index) => (
                                                <View
                                                    key={`${entry.date}-${index}`}
                                                    style={styles.valueRow}
                                                    accessible
                                                    accessibilityLabel={t(
                                                        `${dateLabel(entry.date)}、推定1RM ${entry.one_rep_max}キログラム`,
                                                        `${dateLabel(entry.date)}, estimated 1RM ${entry.one_rep_max} kilograms`,
                                                    )}
                                                >
                                                    <Text style={styles.valueDate}>{dateLabel(entry.date)}</Text>
                                                    <Text style={styles.valueNumber}>{entry.one_rep_max} kg</Text>
                                                </View>
                                            ))}
                                        </View>
                                    ) : null}
                                </>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    backButton: { minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: SPACING.m, flexGrow: 1 },
    listDescription: { color: COLORS.textSecondary, fontSize: FONT_SIZE.s, lineHeight: 22, marginBottom: SPACING.m },
    card: {
        backgroundColor: COLORS.surface, borderRadius: 12, padding: SPACING.m,
        marginBottom: SPACING.m, flexDirection: 'row', alignItems: 'center',
        borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.small,
    },
    iconContainer: {
        width: 48, height: 48, borderRadius: 24, backgroundColor: '#E3F2FD',
        justifyContent: 'center', alignItems: 'center', marginRight: SPACING.m,
    },
    info: { flex: 1 },
    exerciseName: { fontSize: FONT_SIZE.m, color: COLORS.text, marginBottom: SPACING.xs, fontWeight: '600' },
    recordValue: { fontSize: FONT_SIZE.l, fontWeight: 'bold', color: COLORS.text },
    recordDetail: { fontSize: FONT_SIZE.m, color: COLORS.textSecondary, fontWeight: 'normal' },
    tapPrompt: { fontSize: FONT_SIZE.s, color: COLORS.accent, marginTop: SPACING.s, fontWeight: '500' },
    stateContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.l, gap: SPACING.m },
    stateTitle: { color: COLORS.text, fontSize: FONT_SIZE.l, fontWeight: '600', textAlign: 'center' },
    description: { color: COLORS.textSecondary, fontSize: FONT_SIZE.m, lineHeight: 24, textAlign: 'center' },
    primaryButton: {
        minHeight: 48, minWidth: 48, paddingHorizontal: SPACING.l, paddingVertical: SPACING.m,
        backgroundColor: COLORS.accent, borderRadius: 8, justifyContent: 'center', alignItems: 'center',
    },
    primaryButtonText: { color: '#FFFFFF', fontSize: FONT_SIZE.m, fontWeight: '600', textAlign: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.m },
    modalCard: { backgroundColor: COLORS.surface, borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '100%', flexShrink: 1 },
    modalHeader: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.s, padding: SPACING.m,
        borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    modalTitle: { fontSize: FONT_SIZE.l, fontWeight: 'bold', color: COLORS.text, flex: 1 },
    closeButton: { minWidth: 48, minHeight: 48, paddingHorizontal: SPACING.s, justifyContent: 'center', alignItems: 'center' },
    closeButtonText: { color: COLORS.accent, fontSize: FONT_SIZE.m, fontWeight: '600' },
    modalBody: { padding: SPACING.m },
    chartState: { paddingVertical: SPACING.l, alignItems: 'center', gap: SPACING.m },
    chart: { marginVertical: SPACING.s, borderRadius: 12 },
    sectionTitle: { fontSize: FONT_SIZE.m, color: COLORS.text, fontWeight: '600', marginBottom: SPACING.s },
    explanationBox: { marginTop: SPACING.m, padding: SPACING.m, backgroundColor: COLORS.background, borderRadius: 8 },
    explanationText: { fontSize: FONT_SIZE.s, color: COLORS.textSecondary, lineHeight: 22 },
    formula: { fontSize: FONT_SIZE.s, color: COLORS.textSecondary, lineHeight: 22, marginTop: SPACING.s },
    valuesList: { marginTop: SPACING.l },
    valueRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: SPACING.s, paddingVertical: SPACING.s, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    valueDate: { fontSize: FONT_SIZE.m, color: COLORS.text },
    valueNumber: { fontSize: FONT_SIZE.m, color: COLORS.text, fontWeight: '600' },
});
