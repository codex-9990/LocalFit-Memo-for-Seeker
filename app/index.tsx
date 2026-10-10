import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import type { CalendarHeaderProps } from 'react-native-calendars/src/calendar/header';
import type { DateData, MarkedDates } from 'react-native-calendars/src/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZE, SHADOWS } from '../src/constants/theme';
import { cleanupEmptyWorkouts, createWorkout, getWorkouts, Workout } from '../src/database/db';
import { useLanguage } from '../src/i18n';
import { dateKeyToLocalNoon, toLocalDateKey } from '../src/utils/date';

LocaleConfig.locales.en = LocaleConfig.locales[''];
LocaleConfig.locales.ja = {
    monthNames: Array.from({ length: 12 }, (_, index) => `${index + 1}月`),
    monthNamesShort: Array.from({ length: 12 }, (_, index) => `${index + 1}月`),
    dayNames: ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'],
    dayNamesShort: ['日', '月', '火', '水', '木', '金', '土'],
    today: '今日',
};

export default function HomeScreen() {
    const { language, t, bodyPartLabel } = useLanguage();
    useLayoutEffect(() => {
        // Calendar announces its visible month in a passive effect.
        LocaleConfig.defaultLocale = language;
    }, [language]);
    const insets = useSafeAreaInsets();
    const [workouts, setWorkouts] = useState<Workout[]>([]);
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [createFailed, setCreateFailed] = useState(false);
    const [creating, setCreating] = useState(false);
    const creatingRef = useRef(false);
    const today = toLocalDateKey(new Date());
    const [selectedDate, setSelectedDate] = useState(today);
    const locale = language === 'ja' ? 'ja-JP' : 'en-US';
    const hasToday = workouts.some(workout => toLocalDateKey(workout.date) === today);
    const selectedWorkout = workouts.find(workout => toLocalDateKey(workout.date) === selectedDate);
    const formatDate = useCallback((value: string) => dateKeyToLocalNoon(value).toLocaleDateString(locale, {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
    }), [locale]);

    const loadWorkouts = useCallback(() => {
        setLoading(true);
        setLoadFailed(false);
        const onError = () => {
            setLoadFailed(true);
            setLoading(false);
        };
        cleanupEmptyWorkouts(() => {
            getWorkouts(result => {
                setWorkouts(result);
                setLoading(false);
            }, onError);
        }, onError);
    }, []);

    useFocusEffect(useCallback(() => {
        creatingRef.current = false;
        setCreating(false);
        loadWorkouts();
    }, [loadWorkouts]));

    const openWorkout = (date: string) => {
        if (creatingRef.current || date > toLocalDateKey(new Date())) return;
        creatingRef.current = true;
        setCreating(true);
        setCreateFailed(false);
        // The database resumes an existing record for this local day.
        createWorkout('', date === today ? null : dateKeyToLocalNoon(date).toISOString(), id => {
            router.push({ pathname: '/workout', params: { id, date } });
        }, () => {
            creatingRef.current = false;
            setCreating(false);
            setCreateFailed(true);
        });
    };

    const markedDates: MarkedDates = {};
    workouts.forEach(workout => {
        markedDates[toLocalDateKey(workout.date)] = { marked: true, dotColor: COLORS.accent };
    });
    markedDates[selectedDate] = { ...markedDates[selectedDate], selected: true };

    const renderCalendarHeader = useCallback(({ month, addMonth }: CalendarHeaderProps) => {
        const monthDate = month ? new Date(month.getFullYear(), month.getMonth(), 1) : new Date();
        const atCurrentMonth = toLocalDateKey(monthDate).slice(0, 7) >= today.slice(0, 7);
        return (
            <View>
                <View style={styles.calendarHeader}>
                    <TouchableOpacity
                        style={styles.monthButton}
                        onPress={() => addMonth?.(-1)}
                        accessibilityRole="button"
                        accessibilityLabel={t('前の月', 'Previous month')}
                    >
                        <Ionicons name="chevron-back" size={24} color={COLORS.accent} />
                    </TouchableOpacity>
                    <Text accessibilityRole="header" style={styles.monthTitle}>
                        {monthDate.toLocaleDateString(locale, { year: 'numeric', month: 'long' })}
                    </Text>
                    <TouchableOpacity
                        style={styles.monthButton}
                        onPress={() => addMonth?.(1)}
                        disabled={atCurrentMonth}
                        accessibilityRole="button"
                        accessibilityLabel={t('次の月', 'Next month')}
                        accessibilityState={{ disabled: atCurrentMonth }}
                    >
                        <Ionicons name="chevron-forward" size={24} color={atCurrentMonth ? COLORS.textSecondary : COLORS.accent} />
                    </TouchableOpacity>
                </View>
                <View style={styles.weekdays} accessible={false} importantForAccessibility="no-hide-descendants">
                    {t('日,月,火,水,木,金,土', 'Sun,Mon,Tue,Wed,Thu,Fri,Sat').split(',').map(day => (
                        <Text key={day} style={styles.weekday}>{day}</Text>
                    ))}
                </View>
            </View>
        );
    }, [locale, t, today]);

    const renderCalendarDay = useCallback(({ date, marking }: { date?: DateData; marking?: { marked?: boolean; selected?: boolean } }) => {
        if (!date) return <View />;
        const disabled = date.dateString > today;
        const selected = !!marking?.selected;
        return (
            <TouchableOpacity
                style={[styles.calendarDay, selected && styles.selectedDay]}
                disabled={disabled}
                onPress={() => setSelectedDate(date.dateString)}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled }}
                accessibilityLabel={`${formatDate(date.dateString)}${marking?.marked ? t('、記録あり', ', workout recorded') : ''}`}
            >
                <Text style={[styles.dayText, disabled && styles.disabledDayText, selected && styles.selectedDayText]}>{date.day}</Text>
                {marking?.marked && <View style={[styles.dayDot, selected && styles.selectedDot]} />}
            </TouchableOpacity>
        );
    }, [formatDate, t, today]);

    const renderItem = ({ item }: { item: Workout }) => {
        const label = formatDate(toLocalDateKey(item.date));
        const parts = item.bodyParts?.split(',').map(part => bodyPartLabel(part.trim())).join(' · ');
        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => router.push({ pathname: '/workout', params: { id: item.id, date: toLocalDateKey(item.date) } })}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={[label, parts, item.note].filter(Boolean).join(', ')}
                accessibilityHint={t('この日の記録を開きます', 'Opens the workout for this date')}
            >
                <View style={styles.cardHeader}>
                    <Text style={styles.dateText}>{label}</Text>
                    <Ionicons name="chevron-forward" size={22} color={COLORS.textSecondary} />
                </View>
                <Text style={styles.bodyParts}>{parts || t('記録あり', 'Workout recorded')}</Text>
                {item.note ? <Text style={styles.noteText}>{item.note}</Text> : null}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'LocalFit Memo', headerRight: () => null }} />
            <FlatList
                data={viewMode === 'list' && !loadFailed ? workouts : []}
                renderItem={renderItem}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, SPACING.m) + SPACING.l }]}
                refreshing={loading}
                onRefresh={loadWorkouts}
                ListHeaderComponent={
                    <View>
                        <View style={styles.intro}>
                            <Text accessibilityRole="header" style={styles.title}>{t('今日のトレーニング', 'Your training today')}</Text>
                            <Text style={styles.subtitle}>{t('自分のペースで、1セットずつ。', 'At your pace, one set at a time.')}</Text>
                            <TouchableOpacity
                                style={[styles.primaryButton, creating && styles.busyButton]}
                                onPress={() => openWorkout(today)}
                                disabled={creating}
                                accessibilityRole="button"
                                accessibilityState={{ disabled: creating, busy: creating }}
                            >
                                {creating ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="add-circle-outline" size={24} color="#FFFFFF" />}
                                <Text style={styles.primaryButtonText}>
                                    {creating ? t('記録を開いています…', 'Opening workout…') : hasToday ? t('今日の記録を続ける', 'Continue today’s workout') : t('今日の記録を始める', 'Log today’s workout')}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={() => { setViewMode('calendar'); setSelectedDate(today); }}
                                accessibilityRole="button"
                                accessibilityHint={t('カレンダーで日付を選べます', 'Shows a calendar to select a date')}
                            >
                                <Ionicons name="calendar-outline" size={22} color={COLORS.accent} />
                                <Text style={styles.secondaryButtonText}>{t('日付を選んで記録する', 'Log a different date')}</Text>
                            </TouchableOpacity>
                            {createFailed && (
                                <Text style={styles.errorText} accessibilityRole="alert" accessibilityLiveRegion="polite">
                                    {t('記録を開けませんでした。もう一度ボタンを押してください。', 'Could not open the workout. Please try the button again.')}
                                </Text>
                            )}
                        </View>

                        <View style={styles.navigationRow}>
                            <TouchableOpacity style={styles.navigationButton} onPress={() => router.push('/stats')} accessibilityRole="button">
                                <Ionicons name="trending-up-outline" size={24} color={COLORS.accent} />
                                <Text style={styles.navigationLabel}>{t('成長を見る', 'Progress')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.navigationButton} onPress={() => router.push('/settings')} accessibilityRole="button">
                                <Ionicons name="settings-outline" size={24} color={COLORS.accent} />
                                <Text style={styles.navigationLabel}>{t('設定・バックアップ', 'Settings & backup')}</Text>
                            </TouchableOpacity>
                        </View>

                        <Text accessibilityRole="header" style={styles.sectionTitle}>{t('トレーニングの記録', 'Workout history')}</Text>
                        <View style={styles.modeRow}>
                            {(['list', 'calendar'] as const).map(mode => (
                                <TouchableOpacity
                                    key={mode}
                                    style={[styles.modeButton, viewMode === mode && styles.modeButtonSelected]}
                                    onPress={() => setViewMode(mode)}
                                    accessibilityRole="tab"
                                    accessibilityState={{ selected: viewMode === mode }}
                                >
                                    <Ionicons name={mode === 'list' ? 'list-outline' : 'calendar-outline'} size={20} color={viewMode === mode ? '#FFFFFF' : COLORS.textSecondary} />
                                    <Text style={[styles.modeText, viewMode === mode && styles.modeTextSelected]}>
                                        {mode === 'list' ? t('一覧', 'List') : t('カレンダー', 'Calendar')}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {loadFailed && (
                            <View style={styles.messageCard}>
                                <Text style={styles.errorText} accessibilityRole="alert">{t('履歴を読み込めませんでした。', 'Could not load workout history.')}</Text>
                                <TouchableOpacity style={styles.secondaryButton} onPress={loadWorkouts} accessibilityRole="button">
                                    <Text style={styles.secondaryButtonText}>{t('もう一度読み込む', 'Try again')}</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {viewMode === 'calendar' && (
                            <View style={styles.calendarCard}>
                                <Text style={styles.calendarHelp}>{t('日付を選び、下のボタンで記録を開きます。', 'Select a date, then open its workout below.')}</Text>
                                <Calendar
                                    key={language}
                                    current={selectedDate}
                                    initialDate={`${selectedDate.slice(0, 7)}-01`}
                                    maxDate={today}
                                    hideExtraDays
                                    disableAllTouchEventsForDisabledDays
                                    markedDates={loadFailed ? { [selectedDate]: { selected: true } } : markedDates}
                                    customHeader={renderCalendarHeader}
                                    dayComponent={renderCalendarDay}
                                    theme={{ calendarBackground: COLORS.surface, backgroundColor: COLORS.surface, textDayFontSize: FONT_SIZE.m }}
                                />
                                <Text style={styles.calendarHelp}>{t('● は記録がある日です。', '● marks a day with a workout.')}</Text>
                                <View style={styles.selectedDateCard}>
                                    <Text style={styles.selectedDateLabel} accessibilityLiveRegion="polite">{formatDate(selectedDate)}</Text>
                                    <TouchableOpacity
                                        style={[styles.primaryButton, creating && styles.busyButton]}
                                        disabled={creating}
                                        onPress={() => openWorkout(selectedDate)}
                                        accessibilityRole="button"
                                        accessibilityState={{ disabled: creating, busy: creating }}
                                    >
                                        <Text style={styles.primaryButtonText}>{selectedWorkout ? t('この日の記録を開く', 'Open this workout') : t('この日に記録する', 'Log this date')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                }
                ListEmptyComponent={viewMode === 'list' && !loading && !loadFailed ? (
                    <View style={styles.messageCard}>
                        <Ionicons name="barbell-outline" size={40} color={COLORS.accent} />
                        <Text style={styles.emptyTitle}>{t('最初の1セットから始めましょう', 'Start with your first set')}</Text>
                        <Text style={styles.emptyStep}>{t('1.「今日の記録を始める」を押す', '1. Tap “Log today’s workout”')}</Text>
                        <Text style={styles.emptyStep}>{t('2. 種目を選び、重量と回数を入力する', '2. Choose an exercise, then enter weight and reps')}</Text>
                        <Text style={styles.emptyStep}>{t('3.「セットを保存」を押す', '3. Tap “Save set”')}</Text>
                        <Text style={styles.emptyHint}>{t('記録したトレーニングはここに表示されます。', 'Your workouts will appear here.')}</Text>
                    </View>
                ) : loading ? <ActivityIndicator style={styles.loadingIndicator} color={COLORS.accent} accessibilityLabel={t('履歴を読み込み中', 'Loading workout history')} /> : null}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    content: { padding: SPACING.m, flexGrow: 1 },
    intro: { backgroundColor: COLORS.surface, padding: SPACING.m, borderRadius: 20, borderColor: COLORS.border, borderWidth: 1 },
    title: { color: COLORS.text, fontSize: FONT_SIZE.xl, fontWeight: '700' },
    subtitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.m, marginTop: SPACING.s, marginBottom: SPACING.m },
    primaryButton: { minHeight: 56, paddingVertical: SPACING.m, paddingHorizontal: SPACING.m, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: SPACING.s, borderRadius: 12, backgroundColor: COLORS.accent },
    busyButton: { opacity: 0.75 },
    primaryButtonText: { fontSize: FONT_SIZE.m, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', flexShrink: 1 },
    secondaryButton: { minHeight: 52, paddingVertical: 12, paddingHorizontal: SPACING.s, marginTop: SPACING.s, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: SPACING.s, borderRadius: 12, borderWidth: 1, borderColor: COLORS.accent },
    secondaryButtonText: { fontSize: FONT_SIZE.m, fontWeight: '600', color: COLORS.accent, flexShrink: 1, textAlign: 'center' },
    navigationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.s, marginVertical: SPACING.m },
    navigationButton: { minHeight: 56, flexGrow: 1, flexBasis: 135, backgroundColor: COLORS.surface, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.s, borderWidth: 1, borderColor: COLORS.border },
    navigationLabel: { color: COLORS.text, fontSize: FONT_SIZE.m, fontWeight: '600', flexShrink: 1 },
    sectionTitle: { color: COLORS.text, fontSize: FONT_SIZE.l, fontWeight: '700', marginTop: SPACING.s, marginBottom: SPACING.m },
    modeRow: { flexDirection: 'row', gap: SPACING.s, marginBottom: SPACING.m },
    modeButton: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: SPACING.s, gap: SPACING.s, borderRadius: 12, borderColor: COLORS.border, borderWidth: 1, backgroundColor: COLORS.surface },
    modeButtonSelected: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
    modeText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.m, fontWeight: '600', flexShrink: 1 },
    modeTextSelected: { color: '#FFFFFF' },
    card: { backgroundColor: COLORS.surface, borderRadius: 16, padding: SPACING.m, marginBottom: SPACING.m, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.small },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.s },
    dateText: { color: COLORS.text, fontSize: FONT_SIZE.l, fontWeight: '700', flex: 1 },
    bodyParts: { color: COLORS.accent, fontSize: FONT_SIZE.m, marginTop: SPACING.s, fontWeight: '600' },
    noteText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.s, marginTop: SPACING.s },
    messageCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: SPACING.l, marginBottom: SPACING.m, borderColor: COLORS.border, borderWidth: 1 },
    emptyTitle: { color: COLORS.text, fontSize: FONT_SIZE.l, fontWeight: '700', marginTop: SPACING.m, marginBottom: SPACING.s },
    emptyStep: { color: COLORS.text, fontSize: FONT_SIZE.m, marginTop: SPACING.s },
    emptyHint: { color: COLORS.textSecondary, fontSize: FONT_SIZE.s, marginTop: SPACING.m },
    errorText: { color: COLORS.danger, fontSize: FONT_SIZE.m, marginTop: SPACING.s },
    loadingIndicator: { margin: SPACING.l },
    calendarCard: { backgroundColor: COLORS.surface, borderRadius: 16, overflow: 'hidden', borderColor: COLORS.border, borderWidth: 1 },
    calendarHelp: { fontSize: FONT_SIZE.s, color: COLORS.textSecondary, padding: SPACING.m },
    calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    monthButton: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
    monthTitle: { color: COLORS.text, fontSize: FONT_SIZE.l, fontWeight: '700', flex: 1, textAlign: 'center' },
    weekdays: { flexDirection: 'row', marginVertical: SPACING.s },
    weekday: { flex: 1, textAlign: 'center', color: COLORS.textSecondary, fontSize: FONT_SIZE.s },
    calendarDay: { minHeight: 48, width: '100%', paddingVertical: SPACING.s, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
    selectedDay: { backgroundColor: COLORS.accent },
    dayText: { fontSize: FONT_SIZE.m, color: COLORS.text },
    disabledDayText: { color: COLORS.textSecondary, opacity: 0.6 },
    selectedDayText: { color: '#FFFFFF', fontWeight: '700' },
    dayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.accent, marginTop: 3 },
    selectedDot: { backgroundColor: '#FFFFFF' },
    selectedDateCard: { padding: SPACING.m, borderTopWidth: 1, borderTopColor: COLORS.border },
    selectedDateLabel: { fontSize: FONT_SIZE.m, color: COLORS.text, fontWeight: '600', textAlign: 'center', marginBottom: SPACING.m },
});
