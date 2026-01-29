import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Modal, TextInput } from 'react-native';
import { Link, useFocusEffect, router, Stack } from 'expo-router';
import { COLORS, SPACING, FONT_SIZE, SHADOWS } from '../src/constants/theme';
import { getWorkouts, Workout, createWorkout, cleanupEmptyWorkouts, getLatestWorkout } from '../src/database/db';
import { Ionicons } from '@expo/vector-icons';

export default function HomeScreen() {
    const [workouts, setWorkouts] = useState<Workout[]>([]);

    // Past Workout Modal
    const [isDateModalVisible, setDateModalVisible] = useState(false);
    const [year, setYear] = useState('');
    const [month, setMonth] = useState('');
    const [day, setDay] = useState('');

    useFocusEffect(
        useCallback(() => {
            cleanupEmptyWorkouts(() => {
                getWorkouts(setWorkouts);
            });
        }, [])
    );

    const handleNewWorkout = () => {
        getLatestWorkout((latestWorkout) => {
            const today = new Date().toDateString();
            if (latestWorkout && new Date(latestWorkout.date).toDateString() === today) {
                // Resume today's workout
                router.push({ pathname: '/workout', params: { id: latestWorkout.id } });
            } else {
                // Start fresh for TODAY
                createWorkout('', null, (id) => {
                    router.push({ pathname: '/workout', params: { id } });
                });
            }
        });
    };

    const handleCreatePastWorkout = () => {
        const y = parseInt(year);
        const m = parseInt(month) - 1; // Month is 0-indexed
        const d = parseInt(day);

        const date = new Date(y, m, d);

        // Basic validation
        if (isNaN(date.getTime()) || date.getFullYear() !== y || date.getMonth() !== m || date.getDate() !== d) {
            alert('Invalid Date');
            return;
        }

        createWorkout('', date.toISOString(), (id) => {
            setDateModalVisible(false);
            setYear('');
            setMonth('');
            setDay('');
            router.push({ pathname: '/workout', params: { id } });
        });
    };

    const openDateModal = () => {
        const now = new Date();
        setYear(now.getFullYear().toString());
        setMonth((now.getMonth() + 1).toString());
        setDay((now.getDate() - 1).toString()); // Default to yesterday
        setDateModalVisible(true);
    };

    const renderItem = ({ item }: { item: Workout }) => {
        const dateObj = new Date(item.date);
        const dateStr = dateObj.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });
        const timeStr = dateObj.toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
        });

        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => router.push({ pathname: '/workout', params: { id: item.id } })}
                activeOpacity={0.7}
            >
                <View style={styles.cardHeader}>
                    <View>
                        <Text style={styles.dateText}>{dateStr}</Text>
                        <Text style={styles.timeText}>{timeStr}</Text>
                    </View>
                    <View style={styles.volumeBadge}>
                        <Text style={styles.volumeLabel}>VOLUME</Text>
                        <Text style={styles.volumeText}>
                            {item.totalVolume ? `${Math.round(item.totalVolume).toLocaleString()} kg` : '-'}
                        </Text>
                    </View>
                </View>

                {item.exerciseNames ? (
                    <View style={styles.exercisesContainer}>
                        <Text style={styles.exercisesText} numberOfLines={2}>
                            {item.exerciseNames.split(',').join(' • ')}
                        </Text>
                    </View>
                ) : null}

                {item.note ? (
                    <View style={styles.noteContainer}>
                        <Ionicons name="document-text-outline" size={14} color={COLORS.textSecondary} style={{ marginRight: 4 }} />
                        <Text style={styles.noteText} numberOfLines={1}>{item.note}</Text>
                    </View>
                ) : null}

                <View style={styles.chevron}>
                    <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    headerRight: () => (
                        <View style={{ flexDirection: 'row', gap: 16 }}>
                            <Link href="/stats" asChild>
                                <TouchableOpacity>
                                    <Ionicons name="trophy-outline" size={24} color={COLORS.accent} />
                                </TouchableOpacity>
                            </Link>
                            <Link href="/settings" asChild>
                                <TouchableOpacity>
                                    <Ionicons name="settings-outline" size={24} color={COLORS.accent} />
                                </TouchableOpacity>
                            </Link>
                        </View>
                    ),
                }}
            />

            <FlatList
                data={workouts}
                renderItem={renderItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="barbell-outline" size={64} color={COLORS.border} />
                        <Text style={styles.emptyText}>No workouts yet.</Text>
                        <Text style={styles.emptySubText}>Tap the + button to start training!</Text>
                    </View>
                }
            />

            {/* Floating Action Button */}
            <TouchableOpacity
                style={styles.fab}
                onPress={handleNewWorkout}
                onLongPress={openDateModal}
                activeOpacity={0.8}
            >
                <Ionicons name="add" size={32} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Past Date Modal */}
            <Modal visible={isDateModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Log Past Workout</Text>
                        <Text style={styles.modalSubtitle}>Enter date (YYYY / MM / DD)</Text>

                        <View style={styles.dateInputRow}>
                            <TextInput
                                style={[styles.dateInput, { flex: 2 }]}
                                placeholder="YYYY"
                                value={year}
                                onChangeText={setYear}
                                keyboardType="number-pad"
                                maxLength={4}
                            />
                            <Text style={styles.slash}>/</Text>
                            <TextInput
                                style={[styles.dateInput, { flex: 1 }]}
                                placeholder="MM"
                                value={month}
                                onChangeText={setMonth}
                                keyboardType="number-pad"
                                maxLength={2}
                            />
                            <Text style={styles.slash}>/</Text>
                            <TextInput
                                style={[styles.dateInput, { flex: 1 }]}
                                placeholder="DD"
                                value={day}
                                onChangeText={setDay}
                                keyboardType="number-pad"
                                maxLength={2}
                            />
                        </View>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setDateModalVisible(false)} style={styles.modalBtnCancel}>
                                <Text style={styles.modalBtnTextCancel}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleCreatePastWorkout} style={styles.modalBtnSave}>
                                <Text style={styles.modalBtnTextSave}>Create</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View >
            </Modal >
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    listContent: {
        padding: SPACING.m,
        paddingBottom: 100, // Space for FAB
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: SPACING.m,
        marginBottom: SPACING.m,
        ...SHADOWS.small,
        borderWidth: 1,
        borderColor: COLORS.border,
        position: 'relative',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.s,
    },
    dateText: {
        fontSize: FONT_SIZE.l,
        fontWeight: '700',
        color: COLORS.text,
    },
    timeText: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    volumeBadge: {
        alignItems: 'flex-end',
    },
    volumeLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.textSecondary,
        letterSpacing: 0.5,
    },
    volumeText: {
        fontSize: FONT_SIZE.m,
        fontWeight: '700',
        color: COLORS.accent,
    },
    noteContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: SPACING.s,
        backgroundColor: COLORS.background,
        padding: SPACING.s,
        borderRadius: 8,
    },
    noteText: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.s,
        flex: 1,
    },
    exercisesContainer: {
        marginTop: SPACING.s,
    },
    exercisesText: {
        fontSize: FONT_SIZE.s,
        color: COLORS.text,
        fontWeight: '500',
        lineHeight: 20,
    },
    chevron: {
        position: 'absolute',
        right: SPACING.s,
        top: '50%',
        marginTop: -10, // Half of icon size
        opacity: 0.3,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
    },
    emptyText: {
        fontSize: FONT_SIZE.l,
        fontWeight: '700',
        color: COLORS.textSecondary,
        marginTop: SPACING.m,
    },
    emptySubText: {
        fontSize: FONT_SIZE.s,
        color: COLORS.textSecondary,
        marginTop: SPACING.s,
    },
    fab: {
        position: 'absolute',
        bottom: SPACING.xl,
        right: SPACING.xl,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: COLORS.accent,
        justifyContent: 'center',
        alignItems: 'center',
        ...SHADOWS.medium,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.l,
    },
    modalCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: SPACING.l,
        width: '100%',
        maxWidth: 340,
        ...SHADOWS.medium,
    },
    modalTitle: {
        fontSize: FONT_SIZE.l,
        fontWeight: 'bold',
        color: COLORS.text,
        textAlign: 'center',
        marginBottom: 4,
    },
    modalSubtitle: {
        fontSize: FONT_SIZE.s,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: SPACING.l,
    },
    dateInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: SPACING.l,
    },
    dateInput: {
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        padding: 12,
        fontSize: FONT_SIZE.m,
        textAlign: 'center',
        fontWeight: 'bold',
        color: COLORS.text,
    },
    slash: {
        fontSize: FONT_SIZE.l,
        color: COLORS.textSecondary,
        fontWeight: 'bold',
    },
    modalButtons: {
        flexDirection: 'row',
        gap: SPACING.m,
    },
    modalBtnCancel: {
        flex: 1,
        padding: 14,
        alignItems: 'center',
        borderRadius: 8,
        backgroundColor: COLORS.background,
    },
    modalBtnSave: {
        flex: 1,
        padding: 14,
        alignItems: 'center',
        borderRadius: 8,
        backgroundColor: COLORS.accent,
    },
    modalBtnTextCancel: {
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    modalBtnTextSave: {
        fontWeight: 'bold',
        color: '#FFF',
    },
});
