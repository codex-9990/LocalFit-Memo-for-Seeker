import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { getPreference, setPreference } from './database/db';

export type Language = 'ja' | 'en';

const bodyParts: Record<string, string> = {
    All: 'すべて', Chest: '胸', Back: '背中', Legs: '脚', Shoulders: '肩',
    Arms: '腕', Biceps: '上腕二頭筋', Triceps: '上腕三頭筋', Core: '体幹', Other: 'その他',
};

const exerciseNames: Record<string, string> = {
    'Push Up': '腕立て伏せ', 'Bodyweight Squat': '自重スクワット',
    'Bench Press': 'ベンチプレス', 'Incline Bench Press': 'インクラインベンチプレス',
    'Dumbbell Press': 'ダンベルプレス', 'Cable Fly': 'ケーブルフライ',
    Deadlift: 'デッドリフト', 'Pull Up': '懸垂', 'Lat Pulldown': 'ラットプルダウン',
    'Bent Over Row': 'ベントオーバーロウ', 'Seated Cable Row': 'シーテッドケーブルロウ',
    Squat: 'スクワット', 'Leg Press': 'レッグプレス', Lunges: 'ランジ',
    'Leg Extension': 'レッグエクステンション', 'Leg Curl': 'レッグカール',
    'Calf Raise': 'カーフレイズ', 'Overhead Press': 'オーバーヘッドプレス',
    'Dumbbell Shoulder Press': 'ダンベルショルダープレス', 'Lateral Raise': 'サイドレイズ',
    'Front Raise': 'フロントレイズ', 'Face Pull': 'フェイスプル',
    'Barbell Curl': 'バーベルカール', 'Dumbbell Curl': 'ダンベルカール',
    'Tricep Extension': 'トライセプスエクステンション', Skullcrusher: 'スカルクラッシャー',
    Dips: 'ディップス', Crunch: 'クランチ', Plank: 'プランク',
    'Leg Raise': 'レッグレイズ', 'Ab Wheel': '腹筋ローラー',
};

export const getDeviceLanguage = (): Language => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith('ja') ? 'ja' : 'en';
    } catch {
        return 'ja';
    }
};

type LanguageContextValue = {
    language: Language;
    setLanguage: (language: Language) => void;
    t: (japanese: string, english: string) => string;
    bodyPartLabel: (part: string) => string;
    exerciseLabel: (name: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, updateLanguage] = useState<Language>(() => {
        try {
            const saved = getPreference('language');
            return saved === 'ja' || saved === 'en' ? saved : getDeviceLanguage();
        } catch {
            return getDeviceLanguage();
        }
    });

    const setLanguage = useCallback((next: Language) => {
        setPreference('language', next);
        updateLanguage(next);
    }, []);

    const value = useMemo<LanguageContextValue>(() => ({
        language,
        setLanguage,
        t: (japanese, english) => language === 'ja' ? japanese : english,
        bodyPartLabel: (part) => {
            const normalized = part || 'Other';
            return language === 'ja' ? (bodyParts[normalized] ?? normalized) : normalized;
        },
        exerciseLabel: (name) => language === 'ja' ? (exerciseNames[name] ?? name) : name,
    }), [language, setLanguage]);

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) throw new Error('useLanguage must be used inside LanguageProvider.');
    return context;
}
