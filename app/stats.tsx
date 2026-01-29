import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, Dimensions, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { COLORS, SPACING, FONT_SIZE, SHADOWS } from '../src/constants/theme';
import { getPersonalBests, getExerciseProgress, ExerciseProgress, getExercises, Exercise } from '../src/database/db';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';

export default function StatsScreen() {
    const [stats, setStats] = useState<{ exerciseName: string; maxWeight: number; bestReps: number; exerciseId: number }[]>([]);

    // Chart State
    const [selectedExercise, setSelectedExercise] = useState<{ name: string; id: number } | null>(null);
    const [chartData, setChartData] = useState<ExerciseProgress[]>([]);
    const [loading, setLoading] = useState(false);
    const [exercisesMap, setExercisesMap] = useState<Record<string, number>>({});

    useEffect(() => {
        // Fetch stats
        getPersonalBests((data) => {
            // We need exercise IDs to fetch progress. `getPersonalBests` currently returns names.
            // Let's fetch all exercises to map names to IDs.
            getExercises((allExercises) => {
                const map: Record<string, number> = {};
                allExercises.forEach(e => map[e.name] = e.id);
                setExercisesMap(map);

                // Add ID to stats
                const statsWithIds = data.map(d => ({
                    ...d,
                    exerciseId: map[d.exerciseName] || 0
                }));
                setStats(statsWithIds);
            });
        });
    }, []);

    const handleOpenChart = (exerciseName: string, exerciseId: number) => {
        if (!exerciseId) return;
        setSelectedExercise({ name: exerciseName, id: exerciseId });
        setLoading(true);
        getExerciseProgress(exerciseId, (data) => {
            setChartData(data);
            setLoading(false);
        });
    };

    const renderChart = () => {
        if (loading) return <ActivityIndicator size="large" color={COLORS.accent} />;
        if (chartData.length < 2) {
            return (
                <View style={styles.noDataContainer}>
                    <Ionicons name="stats-chart" size={48} color={COLORS.border} />
                    <Text style={styles.noDataText}>Not enough data to chart.</Text>
                    <Text style={styles.noDataSubText}>Log at least 2 sessions to see your progress!</Text>
                </View>
            );
        }

        const labels = chartData.map(d => {
            const date = new Date(d.date);
            return `${date.getMonth() + 1}/${date.getDate()}`;
        });

        // Take at most 6 labels to avoid clutter
        const recentLabels = labels.slice(-6);
        const recentData = chartData.slice(-6).map(d => d.one_rep_max);

        return (
            <View>
                <LineChart
                    data={{
                        labels: recentLabels,
                        datasets: [{ data: recentData }]
                    }}
                    width={Dimensions.get('window').width - 64} // from react-native
                    height={220}
                    yAxisSuffix="kg"
                    chartConfig={{
                        backgroundColor: COLORS.surface,
                        backgroundGradientFrom: COLORS.surface,
                        backgroundGradientTo: COLORS.surface,
                        decimalPlaces: 0,
                        color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
                        labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                        style: { borderRadius: 16 },
                        propsForDots: {
                            r: "4",
                            strokeWidth: "2",
                            stroke: COLORS.accent
                        }
                    }}
                    bezier
                    style={{
                        marginVertical: 8,
                        borderRadius: 16
                    }}
                />
                <View style={styles.explanationBox}>
                    <Text style={styles.explanationTitle}>Estimated 1 Rep Max</Text>
                    <Text style={styles.explanationText}>
                        Theoretical max strength calculated by the Epley Formula:
                        {'\n'}Weight × (1 + Reps/30)
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: 'Personal Records',
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 10 }}>
                            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                        </TouchableOpacity>
                    ),
                    headerShadowVisible: false,
                    headerStyle: { backgroundColor: COLORS.background },
                    headerTintColor: COLORS.text,
                }}
            />

            <FlatList
                data={stats}
                keyExtractor={(item) => item.exerciseName}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.card}
                        onPress={() => handleOpenChart(item.exerciseName, item.exerciseId)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.iconContainer}>
                            <Ionicons name="trophy" size={24} color={COLORS.accent} />
                        </View>
                        <View style={styles.info}>
                            <Text style={styles.exerciseName}>{item.exerciseName}</Text>
                            <Text style={styles.recordValue}>
                                {item.maxWeight} <Text style={styles.unit}>kg</Text>
                                <Text style={styles.recordSubValue}> × {item.bestReps}</Text>
                            </Text>
                            <Text style={styles.tapPrompt}>Tap to view progress</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No records yet. Start lifting!</Text>
                    </View>
                }
            />

            {/* Chart Modal */}
            <Modal visible={!!selectedExercise} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{selectedExercise?.name}</Text>
                            <TouchableOpacity onPress={() => setSelectedExercise(null)}>
                                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        {renderChart()}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    listContent: {
        padding: SPACING.m,
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        padding: SPACING.m,
        marginBottom: SPACING.m,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.small,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#E3F2FD', // Light Blue
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.m,
    },
    info: {
        flex: 1,
    },
    exerciseName: {
        fontSize: FONT_SIZE.s,
        color: COLORS.textSecondary,
        marginBottom: 4,
        fontWeight: '600',
    },
    recordValue: {
        fontSize: FONT_SIZE.l,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    unit: {
        fontSize: FONT_SIZE.s,
        color: COLORS.textSecondary,
        fontWeight: 'normal',
    },
    recordSubValue: {
        fontSize: FONT_SIZE.m,
        color: COLORS.textSecondary,
        fontWeight: 'normal',
    },
    tapPrompt: {
        fontSize: 10,
        color: COLORS.accent,
        marginTop: 4,
        fontWeight: '500',
    },
    emptyContainer: {
        marginTop: 100,
        alignItems: 'center',
    },
    emptyText: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.m,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: SPACING.m,
    },
    modalCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: SPACING.l,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.l,
    },
    modalTitle: {
        fontSize: FONT_SIZE.l,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    noDataContainer: {
        alignItems: 'center',
        padding: SPACING.xl,
    },
    noDataText: {
        marginTop: SPACING.m,
        fontSize: FONT_SIZE.m,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    noDataSubText: {
        fontSize: FONT_SIZE.s,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: 4,
    },
    explanationBox: {
        marginTop: SPACING.m,
        padding: SPACING.m,
        backgroundColor: '#F5F5F5',
        borderRadius: 8,
    },
    explanationTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 4,
    },
    explanationText: {
        fontSize: 10,
        color: COLORS.textSecondary,
        lineHeight: 14,
    },
});
