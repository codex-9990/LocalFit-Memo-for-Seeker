import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet,
    Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT_SIZE, SPACING } from '../src/constants/theme';
import {
    addExercise, addSet, applyRoutineToWorkout, createRoutineFromWorkout, deleteSet,
    Exercise, getExercises, getLastSetForExercise, getRoutines, getSetsForWorkout,
    Routine, RoutineExercise, updateSet, WorkoutSet,
} from '../src/database/db';
import { useLanguage } from '../src/i18n';
import { parseWorkoutInput } from '../src/utils/workoutInput';
import { dateKeyToLocalNoon, toLocalDateKey } from '../src/utils/date';
import { BodyweightGuide } from '../src/components/BodyweightGuide';

const BODY_PARTS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Other'];
const EMPTY_INPUT = { weight: '', reps: '' };

type ActionButtonProps = {
    label: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
    icon?: React.ComponentProps<typeof Ionicons>['name'];
    disabled?: boolean;
};

function ActionButton({ label, onPress, variant = 'secondary', icon, disabled = false }: ActionButtonProps) {
    const color = variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? COLORS.danger : COLORS.accent;
    return (
        <TouchableOpacity
            accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
            onPress={onPress} disabled={disabled}
            style={[styles.button, variant === 'primary' && styles.primaryButton, disabled && styles.disabled]}
            activeOpacity={0.7}
        >
            {icon && <Ionicons name={icon} size={20} color={color} accessible={false} />}
            <Text style={[styles.buttonText, { color }]}>{label}</Text>
        </TouchableOpacity>
    );
}

function Dialog({ visible, title, onClose, children }: {
    visible: boolean; title: string; onClose: () => void; children: React.ReactNode;
}) {
    const insets = useSafeAreaInsets();
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={[styles.modalOverlay, { paddingTop: Math.max(SPACING.m, insets.top), paddingBottom: Math.max(SPACING.m, insets.bottom) }]}>
                <View style={styles.modalCard} accessibilityViewIsModal onAccessibilityEscape={onClose}>
                    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalContent}>
                        <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
                        {children}
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

export default function WorkoutScreen() {
    const { id, date } = useLocalSearchParams<{ id: string; date?: string }>();
    const workoutId = Number(id);
    const sessionDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? dateKeyToLocalNoon(date) : null;
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { language, t, bodyPartLabel, exerciseLabel } = useLanguage();
    const scrollRef = useRef<ScrollView>(null);
    const inputOffset = useRef(0);
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [sets, setSets] = useState<WorkoutSet[]>([]);
    const [plannedExercises, setPlannedExercises] = useState<RoutineExercise[]>([]);
    const [lastSet, setLastSet] = useState<WorkoutSet | null>(null);
    const [lastSetLoadError, setLastSetLoadError] = useState(false);
    const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null);
    const [weight, setWeight] = useState('');
    const [reps, setReps] = useState('');
    const [savedInput, setSavedInput] = useState(EMPTY_INPUT);
    const [editingSetId, setEditingSetId] = useState<number | null>(null);
    const [searchText, setSearchText] = useState('');
    const [selectedBodyPart, setSelectedBodyPart] = useState('All');
    const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
    const [isExerciseModalVisible, setExerciseModalVisible] = useState(false);
    const [newExerciseName, setNewExerciseName] = useState('');
    const [newExerciseBodyPart, setNewExerciseBodyPart] = useState('Other');
    const [isSaveRoutineModalVisible, setSaveRoutineModalVisible] = useState(false);
    const [routineName, setRoutineName] = useState('');
    const [isLoadRoutineModalVisible, setLoadRoutineModalVisible] = useState(false);
    const [routines, setRoutines] = useState<Routine[]>([]);
    const [routineLoadError, setRoutineLoadError] = useState(false);

    const hasUnsavedInput = weight.trim() !== savedInput.weight || reps.trim() !== savedInput.reps;
    const canRepeatSavedSet = !editingSetId && !hasUnsavedInput && savedInput.weight !== '' && savedInput.reps !== '';
    const selectedExercise = exercises.find(exercise => exercise.id === selectedExerciseId);
    const query = searchText.trim().toLocaleLowerCase();
    const filteredExercises = exercises.filter(exercise => {
        const part = exercise.target_body_part || 'Other';
        const matchesPart = selectedBodyPart === 'All' ||
            (selectedBodyPart === 'Arms' ? ['Arms', 'Biceps', 'Triceps'].includes(part) : part === selectedBodyPart);
        return matchesPart && (!query || exercise.name.toLocaleLowerCase().includes(query) ||
            exerciseLabel(exercise.name).toLocaleLowerCase().includes(query));
    });

    const refreshData = useCallback(() => {
        if (!Number.isSafeInteger(workoutId) || workoutId <= 0) {
            setLoadState('error');
            return;
        }
        setLoadState('loading');
        getExercises(data => {
            setExercises(data);
            getSetsForWorkout(workoutId, workoutSets => {
                setSets(workoutSets);
                setPlannedExercises(current => current.filter(planned => !workoutSets.some(set => set.exercise_id === planned.exercise_id)));
                setLoadState('ready');
            }, () => setLoadState('error'));
        }, () => setLoadState('error'));
    }, [workoutId]);

    const loadLastSet = useCallback(() => {
        setLastSetLoadError(false);
        if (selectedExerciseId) {
            getLastSetForExercise(selectedExerciseId, setLastSet, () => {
                setLastSet(null);
                setLastSetLoadError(true);
            });
        } else setLastSet(null);
    }, [selectedExerciseId]);

    useEffect(() => { refreshData(); }, [refreshData]);
    useEffect(loadLastSet, [loadLastSet, sets]);

    const clearInput = () => {
        setEditingSetId(null);
        setWeight('');
        setReps('');
        setSavedInput(EMPTY_INPUT);
    };

    const scrollToInput = () => scrollRef.current?.scrollTo({ y: Math.max(0, inputOffset.current - SPACING.m), animated: true });

    const reportWriteError = (_error: unknown) => {
        const message = t('保存できませんでした。入力は残っています。もう一度お試しください。', 'Could not save. Your input is still here. Please try again.');
        setFeedback({ text: message, error: true });
        Alert.alert(t('保存できませんでした', 'Could not save'), message);
    };

    const saveSet = (afterSave?: () => void) => {
        if (loadState !== 'ready') {
            Alert.alert(t('記録を読み込めません', 'Session unavailable'), t('読み込みを再試行してから保存してください。', 'Retry loading the session before saving.'));
            return;
        }
        if (!selectedExerciseId) {
            Alert.alert(t('種目を選択してください', 'Choose an exercise'), t('記録する種目を先に選んでください。', 'Choose the exercise you want to record first.'));
            return;
        }
        const input = parseWorkoutInput(weight, reps);
        if (!input.ok) {
            Alert.alert(
                t('入力を確認してください', 'Check your input'),
                input.reason === 'missing'
                    ? t('重量と回数を入力してください。自重の種目は重量を0にできます。', 'Enter weight and reps. Use 0 kg for a bodyweight exercise.')
                    : t('重量は0以上の数値、回数は1以上の整数で入力してください。', 'Weight must be 0 or more. Reps must be a whole number of at least 1.'),
            );
            return;
        }
        const onSaved = () => {
            if (editingSetId) clearInput();
            else {
                const retained = { weight: String(input.weight), reps: String(input.reps) };
                setWeight(retained.weight);
                setReps(retained.reps);
                setSavedInput(retained);
            }
            setFeedback({ text: editingSetId ? t('変更を保存しました。', 'Changes saved.') : t('セットを保存しました。', 'Set saved.'), error: false });
            refreshData();
            afterSave?.();
        };
        if (editingSetId) updateSet(editingSetId, input.weight, input.reps, onSaved, reportWriteError);
        else addSet(workoutId, selectedExerciseId, input.weight, input.reps, onSaved, reportWriteError);
    };

    const protectInput = (action: () => void) => {
        if (!hasUnsavedInput) {
            action();
            return;
        }
        Alert.alert(t('未保存の入力があります', 'You have unsaved input'), t('保存して続けるか、入力を破棄してください。', 'Save your input before continuing, or discard it.'), [
            { text: t('戻る', 'Cancel'), style: 'cancel' },
            { text: t('破棄して続ける', 'Discard'), style: 'destructive', onPress: () => { clearInput(); action(); } },
            { text: t('保存して続ける', 'Save and continue'), onPress: () => saveSet(action) },
        ]);
    };

    // Covers header back, Android back, gestures and Finish. Empty sessions are
    // removed by Home's database cleanup, which checks for actual saved sets.
    usePreventRemove(hasUnsavedInput, ({ data }) => protectInput(() => navigation.dispatch(data.action)));

    const selectExercise = (exerciseId: number) => {
        if (exerciseId === selectedExerciseId && !editingSetId) return;
        // Values entered before the first selection have not been assigned to a
        // different exercise, so they can safely stay in the form.
        if (selectedExerciseId === null) {
            setSelectedExerciseId(exerciseId);
            setFeedback(null);
            scrollToInput();
            return;
        }
        protectInput(() => {
            clearInput();
            setSelectedExerciseId(exerciseId);
            setFeedback(null);
            scrollToInput();
        });
    };

    const editSet = (item: WorkoutSet) => {
        if (editingSetId === item.id) {
            scrollToInput();
            return;
        }
        protectInput(() => {
            const input = { weight: String(item.weight_kg), reps: String(item.reps) };
            setEditingSetId(item.id);
            setSelectedExerciseId(item.exercise_id);
            setWeight(input.weight);
            setReps(input.reps);
            setSavedInput(input);
            setFeedback(null);
            scrollToInput();
        });
    };

    const handleDeleteSet = () => {
        if (!editingSetId || loadState !== 'ready') return;
        Alert.alert(t('セットを削除しますか？', 'Delete this set?'), t('この操作は取り消せません。', 'This cannot be undone.'), [
            { text: t('キャンセル', 'Cancel'), style: 'cancel' },
            { text: t('削除', 'Delete'), style: 'destructive', onPress: () => {
                deleteSet(editingSetId, () => {
                    clearInput();
                    refreshData();
                    setFeedback({ text: t('セットを削除しました。', 'Set deleted.'), error: false });
                }, () => Alert.alert(t('削除できませんでした', 'Could not delete'), t('記録は削除されていません。もう一度お試しください。', 'Your set was not deleted. Please try again.')));
            } },
        ]);
    };

    const handleAddExercise = () => {
        const name = newExerciseName.trim();
        if (!name) {
            Alert.alert(t('種目名を入力してください', 'Enter an exercise name'));
            return;
        }
        addExercise(name, newExerciseBodyPart, exerciseId => {
            clearInput();
            setSelectedExerciseId(exerciseId);
            setSelectedBodyPart('All');
            setSearchText('');
            setNewExerciseName('');
            setExerciseModalVisible(false);
            refreshData();
            setFeedback({ text: t('種目を追加しました。重量と回数を入力できます。', 'Exercise added. Enter weight and reps to record a set.'), error: false });
            scrollToInput();
        }, reportWriteError);
    };

    const handleSaveRoutine = () => {
        if (!routineName.trim()) {
            Alert.alert(t('メニュー名を入力してください', 'Enter a preset name'));
            return;
        }
        createRoutineFromWorkout(routineName.trim(), workoutId, () => {
            setSaveRoutineModalVisible(false);
            setRoutineName('');
            setFeedback({ text: t('メニューを保存しました。次回の記録で読み込めます。', 'Preset saved. Load it when you start your next session.'), error: false });
        }, reportWriteError);
    };

    const loadRoutines = () => {
        setRoutineLoadError(false);
        getRoutines(setRoutines, () => setRoutineLoadError(true));
    };

    const handleLoadRoutine = (routineId: number) => {
        applyRoutineToWorkout(workoutId, routineId, planned => {
            clearInput();
            setPlannedExercises(planned);
            setSelectedExerciseId(planned[0]?.exercise_id ?? null);
            setSelectedBodyPart('All');
            setSearchText('');
            setLoadRoutineModalVisible(false);
            setFeedback({ text: planned.length
                ? t('メニューを読み込みました。実施したセットを記録してください。', 'Preset loaded. Record each set as you complete it.')
                : t('このメニューには種目がありません。', 'This preset has no exercises.'), error: false });
            refreshData();
            scrollToInput();
        }, () => Alert.alert(t('メニューを読み込めませんでした', 'Could not load preset'), t('保存済みの記録は変更していません。もう一度お試しください。', 'Your saved sets have not been changed. Please try again.')));
    };

    const openNewExercise = () => protectInput(() => {
        setNewExerciseBodyPart(selectedBodyPart === 'All' ? 'Other' : selectedBodyPart);
        setExerciseModalVisible(true);
    });

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <Stack.Screen options={{
                title: t('トレーニングを記録', 'Record workout'),
                headerRight: () => <ActionButton label={t('終了', 'Finish')} onPress={() => navigation.goBack()} />,
            }} />
            <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
                contentContainerStyle={[styles.content, { paddingBottom: Math.max(48, insets.bottom + SPACING.l) }]}>
                {sessionDate && Number.isFinite(sessionDate.getTime()) ? (
                    <Text style={styles.description}>
                        {t('記録日', 'Workout date')}: {sessionDate.toLocaleDateString(language === 'ja' ? 'ja-JP' : 'en-US', {
                            year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
                        })}
                    </Text>
                ) : null}
                {loadState === 'error' && (
                    <View style={styles.card}>
                        <Text accessibilityRole="alert" style={styles.errorText}>{t('記録を読み込めませんでした。入力を残したまま再試行できます。', 'Could not load your records. Retry without losing your input.')}</Text>
                        <ActionButton label={t('再読み込み', 'Retry loading')} onPress={refreshData} />
                    </View>
                )}
                <View style={styles.card}>
                    <View style={styles.sectionHeading}>
                        <Text accessibilityRole="header" style={styles.sectionTitle}>{t('1. 種目を選ぶ', '1. Choose an exercise')}</Text>
                        <ActionButton label={t('種目を追加', 'New exercise')} icon="add" onPress={openNewExercise} disabled={loadState !== 'ready'} />
                    </View>
                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={20} color={COLORS.textSecondary} accessible={false} />
                        <TextInput style={styles.searchInput} accessibilityLabel={t('種目を検索', 'Search exercises')}
                            placeholder={t('種目名で検索', 'Search by exercise name')} placeholderTextColor={COLORS.textSecondary}
                            value={searchText} onChangeText={setSearchText} returnKeyType="search" autoCorrect={false} />
                        {!!searchText && <ActionButton label={t('クリア', 'Clear')} onPress={() => setSearchText('')} />}
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chipRow}>
                        {['All', ...BODY_PARTS].map(part => (
                            <TouchableOpacity key={part} accessibilityRole="button" accessibilityLabel={bodyPartLabel(part)}
                                accessibilityState={{ selected: selectedBodyPart === part }}
                                style={[styles.chip, selectedBodyPart === part && styles.selectedChip]} onPress={() => setSelectedBodyPart(part)}>
                                <Text style={[styles.chipText, selectedBodyPart === part && styles.selectedChipText]}>{bodyPartLabel(part)}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    {filteredExercises.length ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chipRow}>
                            {filteredExercises.map(exercise => (
                                <TouchableOpacity key={exercise.id} accessibilityRole="button" accessibilityLabel={exerciseLabel(exercise.name)}
                                    accessibilityState={{ selected: selectedExerciseId === exercise.id }}
                                    style={[styles.chip, selectedExerciseId === exercise.id && styles.selectedChip]} onPress={() => selectExercise(exercise.id)}>
                                    <Text style={[styles.chipText, selectedExerciseId === exercise.id && styles.selectedChipText]}>{exerciseLabel(exercise.name)}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.description}>{t('一致する種目がありません。検索や部位を変更するか、新しい種目を追加してください。', 'No matching exercises. Change your search or body part, or add a new exercise.')}</Text>
                            <ActionButton label={t('絞り込みを解除', 'Clear filters')} onPress={() => { setSearchText(''); setSelectedBodyPart('All'); }} />
                        </View>
                    )}
                    <Text style={styles.selection}>{selectedExercise
                        ? `${t('選択中', 'Selected')}: ${exerciseLabel(selectedExercise.name)}`
                        : t('上の一覧から種目を選んでください', 'Choose an exercise above')}</Text>
                    {selectedExercise ? <BodyweightGuide key={selectedExercise.id} exerciseName={selectedExercise.name} /> : null}
                </View>

                <View style={styles.card} onLayout={event => { inputOffset.current = event.nativeEvent.layout.y; }}>
                    <Text accessibilityRole="header" style={styles.sectionTitle}>{editingSetId ? t('セットを編集中', 'Editing a set') : t('2. 重量と回数を記録', '2. Record weight and reps')}</Text>
                    {lastSetLoadError && !editingSetId && (
                        <View style={styles.previousRecord}>
                            <Text accessibilityRole="alert" style={styles.errorText}>{t('前の記録を読み込めませんでした。数値を入力して記録することはできます。', 'Could not load previous values. You can still enter values to record a set.')}</Text>
                            <ActionButton label={t('前の記録を再読み込み', 'Retry previous record')} onPress={loadLastSet} />
                        </View>
                    )}
                    {!!lastSet && !editingSetId && (
                        <View style={styles.previousRecord}>
                            <Text style={styles.description}>
                                {t('最新の記録', 'Latest record')}: {lastSet.weight_kg} kg × {lastSet.reps} {t('回', 'reps')}
                                {lastSet.date ? ` (${dateKeyToLocalNoon(toLocalDateKey(lastSet.date)).toLocaleDateString(language === 'ja' ? 'ja-JP' : 'en-US')})` : ''}
                            </Text>
                            <ActionButton label={t('前の数値を使う', 'Use previous values')} onPress={() => protectInput(() => {
                                setWeight(String(lastSet.weight_kg)); setReps(String(lastSet.reps)); setSavedInput(EMPTY_INPUT); setFeedback(null);
                            })} />
                        </View>
                    )}
                    <View style={styles.inputRow}>
                        <View style={styles.inputColumn}>
                            <Text style={styles.label}>{t('重量 (kg)', 'Weight (kg)')}</Text>
                            <TextInput style={styles.input} accessibilityLabel={t('重量、キログラム', 'Weight in kilograms')}
                                keyboardType="decimal-pad" value={weight} onChangeText={value => { setWeight(value); setFeedback(null); }}
                                placeholder="0" placeholderTextColor={COLORS.textSecondary} />
                        </View>
                        <View style={styles.inputColumn}>
                            <Text style={styles.label}>{t('回数', 'Reps')}</Text>
                            <TextInput style={styles.input} accessibilityLabel={t('回数', 'Repetitions')}
                                keyboardType="number-pad" value={reps} onChangeText={value => { setReps(value); setFeedback(null); }}
                                placeholder={t('例: 10', 'e.g. 10')} placeholderTextColor={COLORS.textSecondary} />
                        </View>
                    </View>
                    <Text style={styles.description}>{t('自重の種目は重量を0にできます。', 'Use 0 kg for bodyweight exercises.')}</Text>
                    <ActionButton variant="primary" icon="checkmark" disabled={loadState !== 'ready'}
                        label={editingSetId ? t('変更を保存', 'Save changes') : canRepeatSavedSet ? t('同じ内容でもう1セット記録', 'Record another identical set') : t('セットを保存', 'Save set')}
                        onPress={() => saveSet()} />
                    {editingSetId ? (
                        <View style={styles.wrappingActions}>
                            <ActionButton label={t('編集をやめる', 'Cancel editing')} onPress={() => protectInput(clearInput)} />
                            <ActionButton label={t('セットを削除', 'Delete set')} variant="danger" onPress={handleDeleteSet} disabled={loadState !== 'ready'} />
                        </View>
                    ) : <Text style={styles.description}>{t('セットごとに保存されます。記録が終わったら右上の「終了」を押してください。', 'Each set is saved immediately. Tap Finish when your session is complete.')}</Text>}
                    {feedback && <Text accessibilityLiveRegion="polite" style={[styles.feedback, feedback.error && styles.errorText]}>{feedback.text}</Text>}
                </View>

                <View style={styles.card}>
                    <Text accessibilityRole="header" style={styles.sectionTitle}>{t('保存済みの記録', 'Saved sets')} · {sets.length} {t('セット', 'sets')}</Text>
                    {sets.length > 0 ? (
                        <>
                            <Text style={styles.description}>{t('記録をタップすると編集・削除できます。', 'Tap a set to edit or delete it.')}</Text>
                            {sets.map(item => {
                                const setNumber = sets.filter(set => set.exercise_id === item.exercise_id && set.id <= item.id).length;
                                return (
                                    <TouchableOpacity key={item.id} accessibilityRole="button"
                                        accessibilityLabel={`${exerciseLabel(item.exercise_name || '')}, ${setNumber} ${t('セット目', 'set')}, ${item.weight_kg} kg, ${item.reps} ${t('回、編集する', 'reps, edit')}`}
                                        accessibilityState={{ selected: editingSetId === item.id }}
                                        style={[styles.setItem, editingSetId === item.id && styles.selectedPlanItem]} onPress={() => editSet(item)}>
                                        <View style={styles.flex}>
                                            <Text style={styles.itemTitle}>{exerciseLabel(item.exercise_name || '')}</Text>
                                            <Text style={styles.description}>{setNumber} {t('セット目', 'set')}{editingSetId === item.id ? ` · ${t('編集中', 'Editing')}` : ''}</Text>
                                        </View>
                                        <Text style={styles.setValue}>{item.weight_kg} kg × {item.reps}</Text>
                                        <Ionicons name="pencil-outline" size={20} color={COLORS.accent} accessible={false} />
                                    </TouchableOpacity>
                                );
                            })}
                        </>
                    ) : <Text style={styles.description}>{t('まだ保存されたセットはありません。種目・重量・回数を入力し、「セットを保存」を押してください。', 'No saved sets yet. Choose an exercise, enter weight and reps, then tap Save set.')}</Text>}
                </View>

                <View style={styles.card}>
                    <Text accessibilityRole="header" style={styles.sectionTitle}>{t('メニュー', 'Presets')}</Text>
                    <Text style={styles.description}>{t('種目と順番を保存し、次回の記録で呼び出せます。重量と回数は毎回入力します。', 'Save your exercises and their order for next time. Enter weight and reps for each session.')}</Text>
                    <View style={styles.wrappingActions}>
                        {sets.length === 0 && <ActionButton label={t('メニューを読み込む', 'Load preset')} icon="albums-outline" disabled={loadState !== 'ready'} onPress={() => protectInput(() => {
                            loadRoutines(); setLoadRoutineModalVisible(true);
                        })} />}
                        {sets.length > 0 && <ActionButton label={t('この種目一覧を保存', 'Save exercises as preset')} icon="save-outline" disabled={loadState !== 'ready'} onPress={() => protectInput(() => setSaveRoutineModalVisible(true))} />}
                    </View>
                    {plannedExercises.length > 0 && (
                        <View style={styles.plan}>
                            <Text style={styles.label}>{t('まだ記録していない種目', 'Exercises not yet recorded')}</Text>
                            {plannedExercises.map(exercise => (
                                <TouchableOpacity key={exercise.exercise_id} accessibilityRole="button" accessibilityLabel={exerciseLabel(exercise.exercise_name)}
                                    accessibilityState={{ selected: selectedExerciseId === exercise.exercise_id }}
                                    style={[styles.planItem, selectedExerciseId === exercise.exercise_id && styles.selectedPlanItem]} onPress={() => selectExercise(exercise.exercise_id)}>
                                    <View style={styles.flex}>
                                        <Text style={styles.itemTitle}>{exerciseLabel(exercise.exercise_name)}</Text>
                                        <Text style={styles.description}>{bodyPartLabel(exercise.target_body_part || 'Other')}</Text>
                                    </View>
                                    <Ionicons name={selectedExerciseId === exercise.exercise_id ? 'radio-button-on' : 'radio-button-off'} size={24} color={COLORS.accent} accessible={false} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            </ScrollView>

            <Dialog visible={isExerciseModalVisible} title={t('種目を追加', 'New exercise')} onClose={() => setExerciseModalVisible(false)}>
                <Text style={styles.label}>{t('種目名', 'Exercise name')}</Text>
                <TextInput style={styles.input} accessibilityLabel={t('種目名', 'Exercise name')}
                    placeholder={t('例: ベンチプレス', 'e.g. Bench press')} placeholderTextColor={COLORS.textSecondary}
                    value={newExerciseName} onChangeText={setNewExerciseName} autoFocus />
                <Text style={styles.label}>{t('部位', 'Body part')}</Text>
                <View style={styles.wrappingActions}>
                    {BODY_PARTS.map(part => (
                        <TouchableOpacity key={part} accessibilityRole="button" accessibilityLabel={bodyPartLabel(part)}
                            accessibilityState={{ selected: newExerciseBodyPart === part }}
                            style={[styles.chip, newExerciseBodyPart === part && styles.selectedChip]} onPress={() => setNewExerciseBodyPart(part)}>
                            <Text style={[styles.chipText, newExerciseBodyPart === part && styles.selectedChipText]}>{bodyPartLabel(part)}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <ActionButton label={t('追加して選択', 'Add and select')} variant="primary" onPress={handleAddExercise} disabled={loadState !== 'ready'} />
                <ActionButton label={t('キャンセル', 'Cancel')} onPress={() => setExerciseModalVisible(false)} />
            </Dialog>

            <Dialog visible={isSaveRoutineModalVisible} title={t('メニューを保存', 'Save preset')} onClose={() => setSaveRoutineModalVisible(false)}>
                <Text style={styles.description}>{t('保存済みの種目と順番をメニューにします。', 'Save the exercises in your recorded sets and their order.')}</Text>
                <TextInput style={styles.input} accessibilityLabel={t('メニュー名', 'Preset name')}
                    placeholder={t('例: 胸の日 A', 'e.g. Chest day A')} placeholderTextColor={COLORS.textSecondary}
                    value={routineName} onChangeText={setRoutineName} autoFocus />
                <ActionButton label={t('メニューを保存', 'Save preset')} variant="primary" onPress={handleSaveRoutine} disabled={loadState !== 'ready'} />
                <ActionButton label={t('キャンセル', 'Cancel')} onPress={() => setSaveRoutineModalVisible(false)} />
            </Dialog>

            <Dialog visible={isLoadRoutineModalVisible} title={t('メニューを読み込む', 'Load preset')} onClose={() => setLoadRoutineModalVisible(false)}>
                {routineLoadError ? (
                    <>
                        <Text accessibilityRole="alert" style={styles.errorText}>{t('メニューを読み込めませんでした。もう一度お試しください。', 'Could not load presets. Please try again.')}</Text>
                        <ActionButton label={t('メニューを再読み込み', 'Retry loading presets')} onPress={loadRoutines} />
                    </>
                ) : routines.length ? routines.map(routine => (
                    <ActionButton key={routine.id} label={routine.name} onPress={() => handleLoadRoutine(routine.id)} />
                )) : <Text style={styles.description}>{t('保存したメニューはありません。セットを記録したあと「この種目一覧を保存」から作成できます。', 'No presets yet. Record a set, then choose Save exercises as preset to create one.')}</Text>}
                <ActionButton label={t('閉じる', 'Close')} onPress={() => setLoadRoutineModalVisible(false)} />
            </Dialog>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    content: { padding: SPACING.m, paddingBottom: 48, gap: SPACING.m },
    card: { backgroundColor: COLORS.surface, padding: SPACING.m, borderRadius: 16, gap: SPACING.m },
    sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: SPACING.s },
    sectionTitle: { fontSize: FONT_SIZE.l, fontWeight: '700', color: COLORS.text, flexShrink: 1 },
    description: { fontSize: FONT_SIZE.s, lineHeight: 21, color: COLORS.textSecondary },
    label: { fontSize: FONT_SIZE.s, fontWeight: '600', color: COLORS.text },
    button: { minHeight: 48, minWidth: 48, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.s, flexShrink: 1 },
    primaryButton: { backgroundColor: COLORS.accent },
    disabled: { opacity: 0.45 },
    buttonText: { fontSize: FONT_SIZE.m, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
    wrappingActions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.s },
    searchBar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingLeft: SPACING.m, borderRadius: 10, backgroundColor: COLORS.background, gap: SPACING.s },
    searchInput: { flex: 1, minHeight: 48, color: COLORS.text, fontSize: FONT_SIZE.m, paddingVertical: SPACING.s },
    chipRow: { gap: SPACING.s, paddingVertical: 2, paddingRight: SPACING.s },
    chip: { minHeight: 48, minWidth: 48, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
    selectedChip: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
    chipText: { fontSize: FONT_SIZE.s, color: COLORS.text, fontWeight: '500' },
    selectedChipText: { color: '#FFFFFF', fontWeight: '700' },
    selection: { fontSize: FONT_SIZE.m, color: COLORS.text, fontWeight: '600' },
    emptyState: { gap: SPACING.s },
    previousRecord: { backgroundColor: COLORS.background, padding: SPACING.s, borderRadius: 10, gap: SPACING.xs },
    inputRow: { flexDirection: 'row', gap: SPACING.m },
    inputColumn: { flex: 1, minWidth: 0, gap: SPACING.s },
    input: { minHeight: 52, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, fontSize: FONT_SIZE.l, color: COLORS.text, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
    feedback: { fontSize: FONT_SIZE.s, lineHeight: 21, color: COLORS.text, fontWeight: '600' },
    errorText: { color: COLORS.danger },
    plan: { gap: SPACING.s },
    planItem: { minHeight: 48, padding: 12, flexDirection: 'row', alignItems: 'center', gap: SPACING.s, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10 },
    selectedPlanItem: { borderColor: COLORS.accent, backgroundColor: COLORS.background },
    itemTitle: { fontSize: FONT_SIZE.m, fontWeight: '600', color: COLORS.text },
    flex: { flex: 1 },
    setItem: { minHeight: 64, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SPACING.s },
    setValue: { fontSize: FONT_SIZE.m, fontWeight: '600', color: COLORS.text },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: SPACING.m },
    modalCard: { backgroundColor: COLORS.surface, borderRadius: 16, maxHeight: '90%' },
    modalContent: { padding: SPACING.l, gap: SPACING.m },
});
