import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZE } from '../src/constants/theme';
import { exportDatabase, importDatabase, clearDatabase } from '../src/database/db';
import { useLanguage } from '../src/i18n';

type Operation = 'export' | 'import' | 'wipe' | 'language';

export default function SettingsScreen() {
    const { language, setLanguage, t } = useLanguage();
    const insets = useSafeAreaInsets();
    const [operation, setOperation] = useState<Operation | null>(null);
    const operationInProgress = useRef(false);
    const busy = operation !== null;

    const beginOperation = (nextOperation: Operation) => {
        if (operationInProgress.current) return false;
        operationInProgress.current = true;
        setOperation(nextOperation);
        return true;
    };

    const finishOperation = () => {
        operationInProgress.current = false;
        setOperation(null);
    };

    const handleLanguageChange = async (nextLanguage: 'ja' | 'en') => {
        if (nextLanguage === language || !beginOperation('language')) return;
        try {
            await setLanguage(nextLanguage);
        } catch {
            Alert.alert(t('言語を変更できませんでした', 'Could not change language'), t('もう一度お試しください。', 'Please try again.'));
        } finally {
            finishOperation();
        }
    };

    const handleExport = async () => {
        if (!beginOperation('export')) return;
        try {
            await exportDatabase();
        } catch {
            Alert.alert(
                t('バックアップを共有できませんでした', 'Could not share your backup'),
                t('端末の空き容量を確認して、もう一度お試しください。', 'Check your device storage and try again.'),
            );
        } finally {
            finishOperation();
        }
    };

    const handleImport = () => {
        if (operationInProgress.current) return;
        Alert.alert(
            t('バックアップから復元しますか？', 'Restore a backup?'),
            t('現在のトレーニング記録・種目・メニューは、選んだバックアップの内容にすべて置き換わります。この操作は元に戻せません。必要な場合は先にバックアップを作成してください。',
                'Your current workouts, exercises, and presets will all be replaced by the selected backup. This cannot be undone. Create a backup first if you want to keep your current data.'),
            [
                { text: t('キャンセル', 'Cancel'), style: 'cancel' },
                {
                    text: t('ファイルを選んで復元', 'Choose a backup to restore'),
                    style: 'destructive',
                    onPress: async () => {
                        if (!beginOperation('import')) return;
                        try {
                            await importDatabase(() => {
                                Alert.alert(t('復元しました', 'Backup restored'), t('バックアップの記録を読み込みました。', 'Your backup data is ready.'));
                                router.replace('/');
                            });
                        } catch {
                            Alert.alert(
                                t('復元できませんでした', 'Could not restore the backup'),
                                t('LocalFit Memoで作成したバックアップファイルを選んでください。ファイルを確認して、もう一度お試しください。',
                                    'Choose a backup file created by LocalFit Memo. Check the file and try again.'),
                            );
                        } finally {
                            finishOperation();
                        }
                    },
                },
            ],
        );
    };

    const handleWipe = () => {
        if (operationInProgress.current) return;
        Alert.alert(
            t('すべてのデータを削除しますか？', 'Delete all data?'),
            t('トレーニング記録・追加した種目・保存したメニューをすべて削除します。この操作は元に戻せません。必要な場合は先にバックアップを作成してください。',
                'This deletes all workouts, custom exercises, and saved presets. This cannot be undone. Create a backup first if you want to keep your data.'),
            [
                { text: t('キャンセル', 'Cancel'), style: 'cancel' },
                {
                    text: t('すべて削除する', 'Delete all data'),
                    style: 'destructive',
                    onPress: () => {
                        if (!beginOperation('wipe')) return;
                        clearDatabase(() => {
                            finishOperation();
                            Alert.alert(t('削除しました', 'Data deleted'), t('トレーニング記録とメニューを削除しました。', 'Your workouts and presets have been deleted.'));
                            router.replace('/');
                        }, () => {
                            finishOperation();
                            Alert.alert(t('削除できませんでした', 'Could not delete data'), t('もう一度お試しください。', 'Please try again.'));
                        });
                    },
                },
            ],
        );
    };

    const progressLabel = operation === 'export'
        ? t('バックアップを準備中…', 'Preparing your backup…')
        : operation === 'import'
            ? t('バックアップを読み込み中…', 'Restoring your backup…')
            : operation === 'wipe'
                ? t('データを削除中…', 'Deleting data…')
                : t('言語を変更中…', 'Changing language…');

    return (
        <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.l }]}>
            <Stack.Screen options={{ title: t('設定', 'Settings') }} />
            <View style={styles.card}>
                <Text style={styles.header} accessibilityRole="header">{t('表示言語', 'Language')}</Text>
                <View style={styles.languageOptions} accessibilityRole="radiogroup">
                    <TouchableOpacity
                        style={[styles.languageButton, language === 'ja' && styles.selectedLanguage, busy && styles.disabled]}
                        onPress={() => { void handleLanguageChange('ja'); }}
                        disabled={busy}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: language === 'ja', disabled: busy }}
                        accessibilityLabel={t('日本語', 'Japanese')}
                    >
                        <Text style={[styles.languageText, language === 'ja' && styles.selectedLanguageText]}>
                            {language === 'ja' ? '✓ 日本語' : '日本語'}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.languageButton, language === 'en' && styles.selectedLanguage, busy && styles.disabled]}
                        onPress={() => { void handleLanguageChange('en'); }}
                        disabled={busy}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: language === 'en', disabled: busy }}
                        accessibilityLabel={t('英語', 'English')}
                    >
                        <Text style={[styles.languageText, language === 'en' && styles.selectedLanguageText]}>
                            {language === 'en' ? '✓ English' : 'English'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {busy ? (
                <View style={styles.progress} accessibilityLiveRegion="polite" accessible accessibilityLabel={progressLabel}>
                    <ActivityIndicator color={COLORS.accent} />
                    <Text style={styles.progressText}>{progressLabel}</Text>
                </View>
            ) : null}

            <View style={styles.card}>
                <Text style={styles.header} accessibilityRole="header">{t('バックアップと復元', 'Backup and restore')}</Text>
                <Text style={styles.description}>
                    {t('記録はこの端末だけに保存され、自動でクラウドに保存されません。機種変更やアプリ削除の前に、バックアップを端末の外へ保存してください。',
                        'Your data stays on this device and is not backed up to the cloud automatically. Save a backup outside this device before changing phones or uninstalling the app.')}
                </Text>
                <Text style={styles.description}>
                    {t('トレーニング記録・種目・メニューを1つのファイルにまとめます。共有画面で保存先を選び、保存先にファイルがあることを確認してください。',
                        'Workouts, exercises, and presets are included in one file. Choose a destination in the share sheet, then check that the file is there.')}
                </Text>
                <TouchableOpacity
                    style={[styles.button, busy && styles.disabled]}
                    onPress={handleExport}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: busy, busy: operation === 'export' }}
                >
                    <Text style={styles.buttonText}>{t('バックアップを作成・共有', 'Create and share a backup')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.buttonSecondary, busy && styles.disabled]}
                    onPress={handleImport}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: busy, busy: operation === 'import' }}
                >
                    <Text style={styles.buttonTextSecondary}>{t('バックアップから復元', 'Restore from a backup')}</Text>
                </TouchableOpacity>
            </View>

            <View style={[styles.card, styles.dangerZone]}>
                <Text style={[styles.header, styles.dangerText]} accessibilityRole="header">{t('データの削除', 'Delete data')}</Text>
                <Text style={styles.description}>
                    {t('すべてのトレーニング記録と保存したメニューを削除します。削除後は元に戻せません。',
                        'Remove all workouts and saved presets. Deleted data cannot be recovered without a backup.')}
                </Text>
                <TouchableOpacity
                    style={[styles.buttonDanger, busy && styles.disabled]}
                    onPress={handleWipe}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: busy, busy: operation === 'wipe' }}
                >
                    <Text style={styles.buttonTextDanger}>{t('すべてのデータを削除', 'Delete all data')}</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>LocalFit Memo v1.0.0</Text>
                <Text style={styles.footerText}>{t('オフラインで使えます。アカウントは不要です。', 'Works offline. No account needed.')}</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    content: { padding: SPACING.m },
    card: { backgroundColor: COLORS.surface, padding: SPACING.m, borderRadius: 12, marginBottom: SPACING.l, borderWidth: 1, borderColor: COLORS.border },
    header: { color: COLORS.text, fontSize: FONT_SIZE.l, fontWeight: '600', marginBottom: SPACING.m },
    description: { color: COLORS.textSecondary, fontSize: FONT_SIZE.m, marginBottom: SPACING.l, lineHeight: 24 },
    languageOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.s },
    languageButton: { minHeight: 48, minWidth: 120, flexGrow: 1, paddingHorizontal: SPACING.m, paddingVertical: SPACING.m, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    selectedLanguage: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
    languageText: { color: COLORS.text, fontSize: FONT_SIZE.m, fontWeight: '600' },
    selectedLanguageText: { color: '#FFFFFF' },
    progress: { flexDirection: 'row', alignItems: 'center', gap: SPACING.m, marginBottom: SPACING.l, paddingHorizontal: SPACING.s },
    progressText: { flex: 1, color: COLORS.text, fontSize: FONT_SIZE.m, lineHeight: 24 },
    button: { minHeight: 48, backgroundColor: COLORS.accent, padding: SPACING.m, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.m },
    buttonText: { color: '#FFFFFF', fontSize: FONT_SIZE.m, fontWeight: '600', textAlign: 'center' },
    buttonSecondary: { minHeight: 48, padding: SPACING.m, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.accent },
    buttonTextSecondary: { color: COLORS.accent, fontSize: FONT_SIZE.m, fontWeight: '600', textAlign: 'center' },
    dangerZone: { borderColor: COLORS.danger },
    dangerText: { color: COLORS.danger },
    buttonDanger: { minHeight: 48, backgroundColor: '#FFF0F0', padding: SPACING.m, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.danger },
    buttonTextDanger: { color: COLORS.danger, fontSize: FONT_SIZE.m, fontWeight: '600', textAlign: 'center' },
    disabled: { opacity: 0.55 },
    footer: { alignItems: 'center', gap: SPACING.s },
    footerText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.s, lineHeight: 22, textAlign: 'center' },
});
