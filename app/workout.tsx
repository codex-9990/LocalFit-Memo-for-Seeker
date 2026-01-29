import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert, Modal, FlatList, LayoutAnimation, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { COLORS, SPACING, FONT_SIZE, SHADOWS } from '../src/constants/theme';
import {
    getExercises, addExercise, addSet, updateSet, deleteSet, getSetsForWorkout, deleteWorkout,
    createRoutineFromWorkout, getRoutines, applyRoutineToWorkout, Routine,
    Exercise, WorkoutSet, getLastSetForExercise
} from '../src/database/db';
import { Ionicons } from '@expo/vector-icons';

export default function WorkoutScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const workoutId = id ? parseInt(id, 10) : 0;

    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]); // Displayed list
    const [sets, setSets] = useState<WorkoutSet[]>([]);
    const [lastSet, setLastSet] = useState<WorkoutSet | null>(null);
    const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null);
    const [weight, setWeight] = useState('');
    const [reps, setReps] = useState('');
    const [editingSetId, setEditingSetId] = useState<number | null>(null);

    // Filters
    const [searchText, setSearchText] = useState('');
    const [selectedBodyPart, setSelectedBodyPart] = useState('All');
    const bodyParts = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Other'];

    // Routine State
    const [isSaveRoutineModalVisible, setIsSaveRoutineModalVisible] = useState(false);
    const [routineName, setRoutineName] = useState('');
    const [isLoadRoutineModalVisible, setIsLoadRoutineModalVisible] = useState(false);
    const [routines, setRoutines] = useState<Routine[]>([]);

    const loadRoutines = () => {
        getRoutines(setRoutines);
    };

    // Modal state for adding new exercise
    const [isModalVisible, setModalVisible] = useState(false);
    const [newExerciseName, setNewExerciseName] = useState('');

    const refreshData = useCallback(() => {
        if (!workoutId) return;
        getExercises((data) => {
            setExercises(data);
            setFilteredExercises(data);
        });
        getSetsForWorkout(workoutId, setSets);
    }, [workoutId]);

    useEffect(() => {
        // Filter Logic
        let result = exercises;

        if (selectedBodyPart !== 'All') {
            result = result.filter(ex => ex.target_body_part === selectedBodyPart);
        }

        if (searchText) {
            result = result.filter(ex => ex.name.toLowerCase().includes(searchText.toLowerCase()));
        }

        setFilteredExercises(result);
    }, [searchText, selectedBodyPart, exercises]);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    useEffect(() => {
        if (selectedExerciseId) {
            getLastSetForExercise(selectedExerciseId, (set) => {
                setLastSet(set);
            });
        } else {
            setLastSet(null);
        }
    }, [selectedExerciseId]);

    const handleAddSet = () => {
        if (!selectedExerciseId) {
            Alert.alert('Select Exercise', 'Please choose an exercise first.');
            return;
        }
        if (!weight || !reps) {
            Alert.alert('Missing Input', 'Enter weight and reps.');
            return;
        }

        if (editingSetId) {
            updateSet(editingSetId, parseFloat(weight), parseInt(reps, 10), () => {
                setEditingSetId(null);
                setWeight('');
                setReps('');
                refreshData();
            });
        } else {
            addSet(workoutId, selectedExerciseId, parseFloat(weight), parseInt(reps, 10), () => {
                refreshData();
            });
        }
    };

    const handleEditSet = (item: WorkoutSet) => {
        setEditingSetId(item.id);
        setWeight(item.weight_kg.toString());
        setReps(item.reps.toString());
        setSelectedExerciseId(item.exercise_id);
    };

    const cancelEdit = () => {
        setEditingSetId(null);
        setWeight('');
        setReps('');
    };

    const handleDeleteSet = () => {
        if (!editingSetId) return;

        Alert.alert(
            "Delete Set",
            "Are you sure you want to delete this set?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                        deleteSet(editingSetId, () => {
                            setEditingSetId(null);
                            setWeight('');
                            setReps('');
                            refreshData();
                        });
                    }
                }
            ]
        );
    };

    const handleAddNewExercise = () => {
        if (!newExerciseName.trim()) return;
        addExercise(newExerciseName, '', () => {
            setModalVisible(false);
            setNewExerciseName('');
            refreshData();
        });
    };

    const handleSaveRoutine = () => {
        if (!routineName.trim()) {
            Alert.alert('Error', 'Please enter a routine name');
            return;
        }
        createRoutineFromWorkout(routineName, workoutId, () => {
            setIsSaveRoutineModalVisible(false);
            setRoutineName('');
            Alert.alert('Saved', 'Routine saved successfully.');
        });
    };

    const handleLoadRoutine = (routineId: number) => {
        applyRoutineToWorkout(workoutId, routineId, () => {
            setIsLoadRoutineModalVisible(false);
            refreshData();
        });
    };

    const handleFinish = () => {
        if (sets.length === 0) {
            deleteWorkout(workoutId, () => {
                router.back();
            });
        } else {
            router.back();
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
            <Stack.Screen
                options={{
                    title: 'Current Session',
                    headerRight: () => (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                            {sets.length === 0 ? (
                                <TouchableOpacity onPress={() => { loadRoutines(); setIsLoadRoutineModalVisible(true); }}>
                                    <Ionicons name="albums-outline" size={24} color={COLORS.accent} />
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity onPress={() => setIsSaveRoutineModalVisible(true)}>
                                    <Ionicons name="save-outline" size={24} color={COLORS.accent} />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={handleFinish}>
                                <Text style={styles.finishText}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    )
                }}
            />

            {/* Top Section: Inputs */}
            <View style={styles.inputContainer}>
                {/* Exercise Selector */}
                <View style={styles.exerciseSelector}>
                    {/* Search Bar */}
                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={20} color={COLORS.textSecondary} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search exercises..."
                            value={searchText}
                            onChangeText={setSearchText}
                            placeholderTextColor={COLORS.textSecondary}
                        />
                        {searchText.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchText('')}>
                                <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Filter Chips */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ paddingRight: SPACING.m }}>
                        {bodyParts.map(bp => (
                            <TouchableOpacity
                                key={bp}
                                style={[styles.filterChip, selectedBodyPart === bp && styles.activeFilterChip]}
                                onPress={() => setSelectedBodyPart(bp)}
                            >
                                <Text style={[styles.filterChipText, selectedBodyPart === bp && styles.activeFilterChipText]}>{bp}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <Text style={styles.label}>SELECT EXERCISE</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                        <TouchableOpacity style={[styles.chip, styles.addChip]} onPress={() => setModalVisible(true)}>
                            <Ionicons name="add" size={16} color={COLORS.textSecondary} />
                            <Text style={[styles.chipText, { marginLeft: 4 }]}>New</Text>
                        </TouchableOpacity>
                        {filteredExercises.map(ex => (
                            <TouchableOpacity
                                key={ex.id}
                                style={[styles.chip, selectedExerciseId === ex.id && styles.activeChip]}
                                onPress={() => setSelectedExerciseId(ex.id)}
                            >
                                <Text style={[styles.chipText, selectedExerciseId === ex.id && styles.activeChipText]}>
                                    {ex.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Last Log Display */}
                {lastSet && (
                    <View style={styles.lastLogContainer}>
                        <Text style={styles.lastLogText}>
                            Last: {lastSet.weight_kg}kg x {lastSet.reps} ({new Date(lastSet.date!).toLocaleDateString()})
                        </Text>
                    </View>
                )}

                {/* Weight & Reps */}
                <View style={styles.row}>
                    <View style={styles.inputWrapper}>
                        <Text style={styles.label}>WEIGHT (KG)</Text>
                        <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            value={weight}
                            onChangeText={setWeight}
                            placeholder="0"
                            placeholderTextColor={COLORS.textSecondary}
                        />
                    </View>
                    <View style={styles.inputWrapper}>
                        <Text style={styles.label}>REPS</Text>
                        <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            value={reps}
                            onChangeText={setReps}
                            placeholder="0"
                            placeholderTextColor={COLORS.textSecondary}
                        />
                    </View>

                    {/* Cancel & Delete Buttons */}
                    {editingSetId && (
                        <View style={styles.editActions}>
                            <TouchableOpacity style={styles.actionButton} onPress={handleDeleteSet}>
                                <Ionicons name="trash-outline" size={24} color={COLORS.danger} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionButton} onPress={cancelEdit}>
                                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.addButton, editingSetId && styles.editButton]}
                        onPress={handleAddSet}
                    >
                        <Ionicons
                            name={editingSetId ? "pencil" : "checkmark"}
                            size={24}
                            color="#FFF"
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Bottom Section: List */}
            <View style={styles.listContainer}>
                <View style={styles.listHeader}>
                    <Text style={styles.listTitle}>SESSION LOG</Text>
                    <Text style={styles.listCount}>{sets.length} sets</Text>
                </View>

                <FlatList
                    data={sets}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item, index }) => (
                        <TouchableOpacity
                            style={[styles.setItem, editingSetId === item.id && styles.editingItem]}
                            onPress={() => handleEditSet(item)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.setLeft}>
                                <Text style={styles.setExercise}>{item.exercise_name}</Text>
                                <Text style={styles.setIndex}>Set {sets.length - index}</Text>
                            </View>
                            <View style={styles.setRight}>
                                <Text style={styles.statsValue}>{item.weight_kg} <Text style={styles.statsUnit}>kg</Text></Text>
                                <Text style={styles.statsX}>x</Text>
                                <Text style={styles.statsValue}>{item.reps} <Text style={styles.statsUnit}>reps</Text></Text>
                            </View>

                            {editingSetId === item.id && (
                                <View style={styles.editingBadge}>
                                    <Text style={styles.editingText}>EDITING</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    )}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="clipboard-outline" size={48} color={COLORS.border} />
                            <Text style={styles.emptyText}>Add your first set above.</Text>
                        </View>
                    }
                />
            </View>

            {/* New Exercise Modal */}
            <Modal visible={isModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Add Exercise</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Exercise Name (e.g. Bench Press)"
                            value={newExerciseName}
                            onChangeText={setNewExerciseName}
                            autoFocus
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalBtnCancel}>
                                <Text style={styles.modalBtnTextCancel}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleAddNewExercise} style={styles.modalBtnSave}>
                                <Text style={styles.modalBtnTextSave}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            {/* Save Routine Modal */}
            <Modal visible={isSaveRoutineModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Save Preset</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Routine Name (e.g. Chest Day A)"
                            value={routineName}
                            onChangeText={setRoutineName}
                            autoFocus
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setIsSaveRoutineModalVisible(false)} style={styles.modalBtnCancel}>
                                <Text style={styles.modalBtnTextCancel}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSaveRoutine} style={styles.modalBtnSave}>
                                <Text style={styles.modalBtnTextSave}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Load Routine Modal */}
            <Modal visible={isLoadRoutineModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { maxHeight: '80%' }]}>
                        <Text style={styles.modalTitle}>Load Preset</Text>
                        <FlatList
                            data={routines}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.routineItem}
                                    onPress={() => handleLoadRoutine(item.id)}
                                >
                                    <Text style={styles.routineName}>{item.name}</Text>
                                    <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={<Text style={{ textAlign: 'center', color: COLORS.textSecondary }}>No saved presets.</Text>}
                        />
                        <View style={[styles.modalButtons, { marginTop: SPACING.m }]}>
                            <TouchableOpacity onPress={() => setIsLoadRoutineModalVisible(false)} style={styles.modalBtnCancel}>
                                <Text style={styles.modalBtnTextCancel}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    finishText: {
        color: COLORS.accent,
        fontSize: FONT_SIZE.m,
        fontWeight: 'bold',
    },
    inputContainer: {
        backgroundColor: COLORS.surface,
        padding: SPACING.m,
        borderBottomWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.small,
        zIndex: 10,
    },
    label: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.textSecondary,
        marginBottom: SPACING.s,
        letterSpacing: 0.5,
    },
    exerciseSelector: {
        marginBottom: SPACING.m,
    },
    lastLogContainer: {
        marginBottom: SPACING.m,
        paddingHorizontal: SPACING.s,
    },
    lastLogText: {
        fontSize: FONT_SIZE.s,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    chipScroll: {
        paddingRight: SPACING.m,
    },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: COLORS.background,
        marginRight: SPACING.s,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    activeChip: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
    },
    chipText: {
        fontSize: FONT_SIZE.s,
        color: COLORS.text,
        fontWeight: '500',
    },
    activeChipText: {
        color: '#FFF',
    },
    addChip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderStyle: 'dashed',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: SPACING.m,
    },
    inputWrapper: {
        flex: 1,
    },
    input: {
        backgroundColor: COLORS.background,
        height: 50,
        borderRadius: 12,
        paddingHorizontal: SPACING.m,
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.text,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    addButton: {
        width: 50,
        height: 50,
        borderRadius: 12,
        backgroundColor: COLORS.accent,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 0, // Align with input
    },
    listContainer: {
        flex: 1,
    },
    listHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.m,
        paddingBottom: SPACING.s,
    },
    listTitle: {
        fontSize: FONT_SIZE.xs,
        fontWeight: '700',
        color: COLORS.textSecondary,
        letterSpacing: 1,
    },
    listCount: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.textSecondary,
    },
    listContent: {
        paddingHorizontal: SPACING.m,
        paddingBottom: 40,
    },
    setItem: {
        backgroundColor: COLORS.surface,
        padding: SPACING.m,
        borderRadius: 12,
        marginBottom: SPACING.s,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    setLeft: {
        flex: 1,
    },
    setExercise: {
        fontSize: FONT_SIZE.m,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 2,
    },
    setIndex: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.textSecondary,
    },
    setRight: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    statsValue: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
    },
    statsUnit: {
        fontSize: 12,
        fontWeight: '500',
        color: COLORS.textSecondary,
    },
    statsX: {
        marginHorizontal: 6,
        color: COLORS.textSecondary,
        fontSize: 14,
    },
    emptyContainer: {
        marginTop: 60,
        alignItems: 'center',
        opacity: 0.6,
    },
    emptyText: {
        marginTop: SPACING.m,
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.s,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: SPACING.l,
    },
    modalCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: SPACING.l,
    },
    modalTitle: {
        fontSize: FONT_SIZE.l,
        fontWeight: 'bold',
        marginBottom: SPACING.l,
        textAlign: 'center',
    },
    modalInput: {
        backgroundColor: COLORS.background,
        padding: SPACING.m,
        borderRadius: 8,
        fontSize: FONT_SIZE.m,
        marginBottom: SPACING.l,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: SPACING.m,
    },
    modalBtnCancel: {
        flex: 1,
        padding: SPACING.m,
        alignItems: 'center',
    },
    modalBtnSave: {
        flex: 1,
        backgroundColor: COLORS.accent,
        padding: SPACING.m,
        borderRadius: 8,
        alignItems: 'center',
    },
    modalBtnTextCancel: {
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    modalBtnTextSave: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    editActions: {
        flexDirection: 'row',
        marginRight: SPACING.s,
    },
    actionButton: {
        width: 50,
        height: 50,
        borderRadius: 12,
        backgroundColor: COLORS.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: SPACING.xs,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    editButton: {
        backgroundColor: COLORS.success,
    },
    editingItem: {
        borderColor: COLORS.accent,
        backgroundColor: '#E3F2FD',
        borderWidth: 2,
    },
    editingBadge: {
        position: 'absolute',
        top: -10,
        right: 10,
        backgroundColor: COLORS.accent,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    editingText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    routineItem: {
        padding: SPACING.m,
        borderBottomWidth: 1,
        borderColor: COLORS.border,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    routineName: {
        fontSize: FONT_SIZE.m,
        fontWeight: '500',
        color: COLORS.text,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: 8,
        paddingHorizontal: SPACING.s,
        marginBottom: SPACING.s,
        borderWidth: 1,
        borderColor: COLORS.border,
        height: 40,
    },
    searchInput: {
        flex: 1,
        marginLeft: SPACING.s,
        fontSize: FONT_SIZE.m,
        color: COLORS.text,
    },
    filterScroll: {
        marginBottom: SPACING.m,
    },
    filterChip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: COLORS.background,
        marginRight: 6,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    activeFilterChip: {
        backgroundColor: COLORS.text,
        borderColor: COLORS.text,
    },
    filterChipText: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.textSecondary,
    },
    activeFilterChipText: {
        color: COLORS.background,
        fontWeight: 'bold',
    },
});
