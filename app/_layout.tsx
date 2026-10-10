import React, { useCallback, useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZE } from '../src/constants/theme';
import { initDB } from '../src/database/db';
import { getDeviceLanguage, LanguageProvider, useLanguage } from '../src/i18n';

const navigationTheme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        background: COLORS.background,
        card: COLORS.surface,
        text: COLORS.text,
        border: COLORS.border,
        primary: COLORS.accent,
    },
};

function AppNavigator() {
    const { t } = useLanguage();
    return (
        <ThemeProvider value={navigationTheme}>
            <StatusBar style="dark" backgroundColor={COLORS.background} />
            <Stack screenOptions={{
                headerStyle: { backgroundColor: COLORS.surface },
                headerTintColor: COLORS.accent,
                headerShadowVisible: false,
                headerTitleStyle: { fontWeight: 'bold', color: COLORS.text },
                headerBackTitle: t('戻る', 'Back'),
                contentStyle: { backgroundColor: COLORS.background },
            }}>
                <Stack.Screen name="index" options={{ title: 'LocalFit Memo' }} />
                <Stack.Screen name="workout" options={{ title: t('トレーニングの記録', 'Log workout') }} />
                <Stack.Screen name="stats" options={{ title: t('記録と成長', 'Records & progress') }} />
                <Stack.Screen name="settings" options={{ title: t('設定', 'Settings') }} />
            </Stack>
        </ThemeProvider>
    );
}

export default function Layout() {
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const prepare = useCallback(() => {
        setStatus('loading');
        try {
            initDB();
            setStatus('ready');
        } catch (error) {
            console.error('Unable to open workout data:', error);
            setStatus('error');
        }
    }, []);

    useEffect(prepare, [prepare]);

    const japanese = getDeviceLanguage() === 'ja';
    return (
        <SafeAreaProvider>
            {status === 'ready' ? (
                <LanguageProvider><AppNavigator /></LanguageProvider>
            ) : (
                <View style={styles.status}>
                    {status === 'loading' ? (
                        <ActivityIndicator size="large" color={COLORS.accent}
                            accessibilityLabel={japanese ? '記録を読み込み中' : 'Loading your records'} />
                    ) : (
                        <>
                            <Text style={styles.title} accessibilityRole="header">
                                {japanese ? '記録を開けませんでした' : 'Could not open your records'}
                            </Text>
                            <Text style={styles.description}>
                                {japanese ? '記録は削除していません。もう一度お試しください。' : 'Your records have not been deleted. Please try again.'}
                            </Text>
                            <TouchableOpacity style={styles.button} onPress={prepare} accessibilityRole="button">
                                <Text style={styles.buttonText}>{japanese ? '再試行' : 'Try again'}</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            )}
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    status: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', padding: SPACING.l, gap: SPACING.m },
    title: { color: COLORS.text, fontSize: FONT_SIZE.xl, fontWeight: '700', textAlign: 'center' },
    description: { color: COLORS.textSecondary, fontSize: FONT_SIZE.m, textAlign: 'center', lineHeight: 25 },
    button: { minHeight: 48, padding: SPACING.m, borderRadius: 12, backgroundColor: COLORS.accent, alignItems: 'center' },
    buttonText: { color: COLORS.surface, fontSize: FONT_SIZE.m, fontWeight: '700' },
});
