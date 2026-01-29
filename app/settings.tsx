import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { COLORS, SPACING, FONT_SIZE } from '../src/constants/theme';
import { exportDatabase, importDatabase, clearDatabase } from '../src/database/db';
import { router } from 'expo-router';

export default function SettingsScreen() {
    const handleExport = async () => {
        try {
            await exportDatabase();
            Alert.alert('Success', 'Database exported successfully.');
        } catch (e: any) {
            Alert.alert('Error', 'Export failed: ' + e.message);
        }
    };

    const handleImport = () => {
        Alert.alert(
            'Overwrite Warning',
            'Importing will replace all current data. Are you sure?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Import',
                    style: 'destructive',
                    onPress: async () => {
                        await importDatabase(() => {
                            Alert.alert('Success', 'Database restored. App will restart data.');
                            router.replace('/');
                        });
                    }
                }
            ]
        );
    };

    const handleWipe = () => {
        Alert.alert(
            'DANGER ZONE',
            'This will permanently delete ALL workouts and sets. This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'DELETE EVERYTHING',
                    style: 'destructive',
                    onPress: () => {
                        clearDatabase(() => {
                            Alert.alert('Wiped', 'Database cleared.');
                            router.replace('/');
                        });
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.header}>DATA MANAGEMENT</Text>

            <View style={styles.card}>
                <Text style={styles.description}>
                    Your data is stored locally on this device. You can export it to a JSON file for backup or transfer.
                </Text>

                <TouchableOpacity style={styles.button} onPress={handleExport}>
                    <Text style={styles.buttonText}>EXPORT DATA (JSON)</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.buttonSecondary} onPress={handleImport}>
                    <Text style={styles.buttonTextSecondary}>IMPORT DATA</Text>
                </TouchableOpacity>
            </View>

            <View style={[styles.card, styles.dangerZone]}>
                <Text style={[styles.header, { color: COLORS.danger, marginTop: 0 }]}>DANGER ZONE</Text>
                <Text style={styles.description}>
                    Clear all workout history and sets.
                </Text>
                <TouchableOpacity style={styles.buttonDanger} onPress={handleWipe}>
                    <Text style={styles.buttonTextDanger}>WIPE ALL DATA</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>Iron Vault v1.0.0</Text>
                <Text style={styles.footerText}>Offline-First. Zero-Knowledge.</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        padding: SPACING.m,
    },
    header: {
        color: COLORS.text,
        fontSize: FONT_SIZE.m,
        fontWeight: 'bold',
        marginBottom: SPACING.m,
        letterSpacing: 1,
    },
    card: {
        backgroundColor: COLORS.surface,
        padding: SPACING.l,
        borderRadius: 8,
        marginBottom: SPACING.l,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    description: {
        color: COLORS.textSecondary,
        marginBottom: SPACING.l,
        lineHeight: 20,
    },
    button: {
        backgroundColor: COLORS.accent,
        padding: SPACING.m,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: SPACING.m,
    },
    buttonText: {
        color: COLORS.background,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    buttonSecondary: {
        backgroundColor: 'transparent',
        padding: SPACING.m,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.text,
    },
    buttonTextSecondary: {
        color: COLORS.text,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    dangerZone: {
        borderColor: COLORS.danger,
        borderWidth: 1,
        marginTop: SPACING.xl,
    },
    buttonDanger: {
        backgroundColor: '#FFF0F0',
        padding: SPACING.m,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.danger,
    },
    buttonTextDanger: {
        color: COLORS.danger,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    footer: {
        marginTop: 'auto',
        alignItems: 'center',
    },
    footerText: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.xs,
    }

});
