import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, DefaultTheme } from '@react-navigation/native';
import { COLORS } from '../src/constants/theme';
import { initDB } from '../src/database/db';
import { View, ActivityIndicator } from 'react-native';

export default function Layout() {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const prepare = async () => {
            try {
                initDB();
            } catch (e) {
                console.warn(e);
            } finally {
                setIsReady(true);
            }
        };
        prepare();
    }, []);

    const customLightTheme = {
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

    if (!isReady) {
        return (
            <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

    return (
        <ThemeProvider value={customLightTheme}>
            <StatusBar style="dark" backgroundColor={COLORS.background} />
            <Stack
                screenOptions={{
                    headerStyle: {
                        backgroundColor: COLORS.surface,
                    },
                    headerTintColor: COLORS.text,
                    headerShadowVisible: false,
                    headerTitleStyle: {
                        fontWeight: 'bold',
                        color: COLORS.text,
                    },
                    contentStyle: {
                        backgroundColor: COLORS.background,
                    },
                }}
            >
                <Stack.Screen name="index" options={{ title: 'LocalFit Memo' }} />
                <Stack.Screen name="workout" options={{ title: 'Current Session' }} />
                <Stack.Screen name="settings" options={{ title: 'Settings' }} />
            </Stack>
        </ThemeProvider>
    );
}
