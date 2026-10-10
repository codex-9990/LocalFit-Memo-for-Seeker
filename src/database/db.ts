import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

// Open inside initDB so startup failures can be shown and retried by the app.
let db: SQLite.SQLiteDatabase;

export interface Exercise {
    id: number;
    name: string;
    target_body_part: string;
}

export interface Workout {
    id: number;
    date: string;
    note: string;
    totalVolume?: number;
    exerciseNames?: string;
    bodyParts?: string;
}

export interface WorkoutSet {
    id: number;
    workout_id: number;
    exercise_id: number;
    weight_kg: number;
    reps: number;
    exercise_name?: string;
    date?: string; // Added for getLastSetForExercise join result
}

export interface ExerciseProgress {
    date: string;
    max_weight: number;
    one_rep_max: number;
}

export interface PersonalBest {
    exerciseId: number;
    exerciseName: string;
    maxWeight: number;
    bestReps: number;
}

export interface RoutineExercise {
    exercise_id: number;
    exercise_name: string;
    target_body_part: string;
}

type BackupExercise = {
    id: number;
    name: string;
    target_body_part: string | null;
};

type BackupWorkout = {
    id: number;
    date: string;
    note: string | null;
};

type BackupSet = {
    id: number;
    workout_id: number;
    exercise_id: number;
    weight_kg: number;
    reps: number;
};

type BackupRoutine = { id: number; name: string };
type BackupRoutineExercise = { id: number; routine_id: number; exercise_id: number; sort_order: number };
type ErrorCallback = (error: unknown) => void;

const reportError = (operation: string, error: unknown, onError?: ErrorCallback) => {
    console.error(`${operation} error:`, error);
    if (onError) onError(error);
    else throw error;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isPositiveInteger = (value: unknown): value is number => {
    return Number.isSafeInteger(value) && (value as number) > 0;
};

const isNonNegativeNumber = (value: unknown): value is number => {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
};

const isNonNegativeInteger = (value: unknown): value is number => {
    return Number.isSafeInteger(value) && (value as number) >= 0;
};

const assertUniqueIds = (items: { id: number }[], label: string) => {
    const seen = new Set<number>();

    items.forEach((item) => {
        if (seen.has(item.id)) {
            throw new Error(`Invalid backup: duplicate ${label} id ${item.id}.`);
        }
        seen.add(item.id);
    });
};

const validateBackupData = (data: unknown) => {
    if (!isRecord(data)) {
        throw new Error('Invalid backup: root must be an object.');
    }

    // Backups created before versioning contained the same three arrays as v1.
    const version = data.version === undefined ? 1 : data.version;
    if (version !== 1 && version !== 2) {
        throw new Error('Invalid backup: unsupported version.');
    }

    if (!Array.isArray(data.exercises) || !Array.isArray(data.workouts) || !Array.isArray(data.sets)) {
        throw new Error('Invalid backup: exercises, workouts, and sets arrays are required.');
    }

    const exercises: BackupExercise[] = data.exercises.map((item, index) => {
        if (!isRecord(item) || !isPositiveInteger(item.id) || typeof item.name !== 'string' || !item.name.trim()) {
            throw new Error(`Invalid backup: exercise at index ${index} is malformed.`);
        }

        if (item.target_body_part != null && typeof item.target_body_part !== 'string') {
            throw new Error(`Invalid backup: exercise target body part at index ${index} is malformed.`);
        }

        return {
            id: item.id,
            name: item.name.trim(),
            target_body_part: item.target_body_part ?? null,
        };
    });

    const workouts: BackupWorkout[] = data.workouts.map((item, index) => {
        if (!isRecord(item) || !isPositiveInteger(item.id) || typeof item.date !== 'string' || Number.isNaN(new Date(item.date).getTime())) {
            throw new Error(`Invalid backup: workout at index ${index} is malformed.`);
        }
        try {
            parseWorkoutDate(item.date);
        } catch {
            throw new Error(`Invalid backup: workout date at index ${index} is malformed.`);
        }

        if (item.note != null && typeof item.note !== 'string') {
            throw new Error(`Invalid backup: workout note at index ${index} is malformed.`);
        }

        return {
            id: item.id,
            date: item.date,
            note: item.note ?? null,
        };
    });

    const exerciseIds = new Set(exercises.map((exercise) => exercise.id));
    const workoutIds = new Set(workouts.map((workout) => workout.id));

    const sets: BackupSet[] = data.sets.map((item, index) => {
        if (!isRecord(item) || !isPositiveInteger(item.id) || !isPositiveInteger(item.workout_id) || !isPositiveInteger(item.exercise_id)) {
            throw new Error(`Invalid backup: set at index ${index} is malformed.`);
        }

        // Earlier releases allowed zero reps. Preserve those historical rows when
        // restoring a backup, while new and edited sets require positive reps.
        if (!isNonNegativeNumber(item.weight_kg) || !isNonNegativeInteger(item.reps)) {
            throw new Error(`Invalid backup: set numbers at index ${index} are malformed.`);
        }

        if (!workoutIds.has(item.workout_id)) {
            throw new Error(`Invalid backup: set ${item.id} references missing workout ${item.workout_id}.`);
        }

        if (!exerciseIds.has(item.exercise_id)) {
            throw new Error(`Invalid backup: set ${item.id} references missing exercise ${item.exercise_id}.`);
        }

        return {
            id: item.id,
            workout_id: item.workout_id,
            exercise_id: item.exercise_id,
            weight_kg: item.weight_kg,
            reps: item.reps,
        };
    });

    assertUniqueIds(exercises, 'exercise');
    assertUniqueIds(workouts, 'workout');
    assertUniqueIds(sets, 'set');

    if (version === 2 && (!Array.isArray(data.routines) || !Array.isArray(data.routine_exercises))) {
        throw new Error('Invalid backup: routines and routine_exercises arrays are required.');
    }
    const routines: BackupRoutine[] = (version === 2 ? data.routines as unknown[] : []).map((item, index) => {
        if (!isRecord(item) || !isPositiveInteger(item.id) || typeof item.name !== 'string' || !item.name.trim()) {
            throw new Error(`Invalid backup: routine at index ${index} is malformed.`);
        }
        return { id: item.id, name: item.name.trim() };
    });
    assertUniqueIds(routines, 'routine');
    const routineIds = new Set(routines.map((routine) => routine.id));
    const routineExercises: BackupRoutineExercise[] = (version === 2 ? data.routine_exercises as unknown[] : []).map((item, index) => {
        if (!isRecord(item) || !isPositiveInteger(item.id) || !isPositiveInteger(item.routine_id) || !isPositiveInteger(item.exercise_id) || !isNonNegativeInteger(item.sort_order)) {
            throw new Error(`Invalid backup: routine exercise at index ${index} is malformed.`);
        }
        if (!routineIds.has(item.routine_id) || !exerciseIds.has(item.exercise_id)) {
            throw new Error(`Invalid backup: routine exercise ${item.id} references missing data.`);
        }
        return { id: item.id, routine_id: item.routine_id, exercise_id: item.exercise_id, sort_order: item.sort_order };
    });
    assertUniqueIds(routineExercises, 'routine exercise');
    const positions = new Set<string>();
    const routineExerciseKeys = new Set<string>();
    for (const item of routineExercises) {
        const position = `${item.routine_id}:${item.sort_order}`;
        const exerciseKey = `${item.routine_id}:${item.exercise_id}`;
        if (positions.has(position) || routineExerciseKeys.has(exerciseKey)) {
            throw new Error('Invalid backup: duplicate exercise or position in routine.');
        }
        positions.add(position);
        routineExerciseKeys.add(exerciseKey);
    }

    return { exercises, workouts, sets, routines, routineExercises };
};

const seedStandardExercises = () => {
    // Standard Gym Exercises List
    const standardExercises = [
        // Chest
        ['Push Up', 'Chest'],
        ['Bench Press', 'Chest'],
        ['Incline Bench Press', 'Chest'],
        ['Dumbbell Press', 'Chest'],
        ['Cable Fly', 'Chest'],
        // Back
        ['Deadlift', 'Back'],
        ['Pull Up', 'Back'],
        ['Lat Pulldown', 'Back'],
        ['Bent Over Row', 'Back'],
        ['Seated Cable Row', 'Back'],
        // Legs
        ['Bodyweight Squat', 'Legs'],
        ['Squat', 'Legs'],
        ['Leg Press', 'Legs'],
        ['Lunges', 'Legs'],
        ['Leg Extension', 'Legs'],
        ['Leg Curl', 'Legs'],
        ['Calf Raise', 'Legs'],
        // Shoulders
        ['Overhead Press', 'Shoulders'],
        ['Dumbbell Shoulder Press', 'Shoulders'],
        ['Lateral Raise', 'Shoulders'],
        ['Front Raise', 'Shoulders'],
        ['Face Pull', 'Shoulders'],
        // Arms
        ['Barbell Curl', 'Arms'],
        ['Dumbbell Curl', 'Arms'],
        ['Tricep Extension', 'Arms'],
        ['Skullcrusher', 'Arms'],
        ['Dips', 'Arms'],
        // Core
        ['Crunch', 'Core'],
        ['Plank', 'Core'],
        ['Leg Raise', 'Core'],
        ['Ab Wheel', 'Core']
    ];

    standardExercises.forEach(([name, bodyPart]) => {
        // Check if exists to avoid duplicates for existing users
        const result = db.getFirstSync<{ count: number }>(
            'SELECT count(*) as count FROM exercises WHERE name = ?',
            [name]
        );

        if (result && result.count === 0) {
            db.runSync('INSERT INTO exercises (name, target_body_part) VALUES (?, ?)', [name, bodyPart]);
        }
    });
};

export const initDB = () => {
    try {
        db ??= SQLite.openDatabaseSync('ironvault.db');
        db.execSync('PRAGMA foreign_keys = ON;');
        db.execSync(`
      CREATE TABLE IF NOT EXISTS exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        target_body_part TEXT
      );
      CREATE TABLE IF NOT EXISTS workouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        note TEXT
      );
      CREATE TABLE IF NOT EXISTS sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_id INTEGER,
        exercise_id INTEGER,
        weight_kg REAL,
        reps INTEGER,
        FOREIGN KEY (workout_id) REFERENCES workouts (id),
        FOREIGN KEY (exercise_id) REFERENCES exercises (id)
      );
      CREATE TABLE IF NOT EXISTS routines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS routine_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        routine_id INTEGER,
        exercise_id INTEGER,
        sort_order INTEGER,
        FOREIGN KEY (routine_id) REFERENCES routines (id),
        FOREIGN KEY (exercise_id) REFERENCES exercises (id)
      );
      CREATE TABLE IF NOT EXISTS preferences (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);

        db.execSync(`
            UPDATE exercises
            SET target_body_part = 'Arms'
            WHERE target_body_part IN ('Biceps', 'Triceps');
            UPDATE exercises
            SET target_body_part = 'Other'
            WHERE target_body_part IS NULL OR TRIM(target_body_part) = '';
        `);

        db.withTransactionSync(seedStandardExercises);
    } catch (error) {
        console.error('initDB error:', error);
        throw error;
    }
};

export const getPreference = (key: string): string | null => {
    return db.getFirstSync<{ value: string }>('SELECT value FROM preferences WHERE key = ?', [key])?.value ?? null;
};

export const setPreference = (key: string, value: string): void => {
    db.runSync('INSERT INTO preferences (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
};


export const getWorkouts = (callback: (workouts: Workout[]) => void, onError?: ErrorCallback) => {
    try {
        const workouts = db.getAllSync<Workout>(`
      SELECT w.*, 
             SUM(s.weight_kg * s.reps) as totalVolume,
             GROUP_CONCAT(DISTINCT e.name) as exerciseNames,
             GROUP_CONCAT(DISTINCT e.target_body_part) as bodyParts
      FROM workouts w 
      LEFT JOIN sets s ON w.id = s.workout_id 
      LEFT JOIN exercises e ON s.exercise_id = e.id
      GROUP BY w.id 
      ORDER BY w.date DESC
    `);
        callback(workouts);
    } catch (error) {
        console.error('getWorkouts error:', error);
        if (onError) onError(error);
        else callback([]);
    }
};

const parseWorkoutDate = (date: string): Date => {
    // A calendar date means local midnight, not the UTC midnight Date normally uses.
    const calendarDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    const parsed = calendarDate
        ? new Date(Number(calendarDate[1]), Number(calendarDate[2]) - 1, Number(calendarDate[3]))
        : new Date(date);
    if (!Number.isFinite(parsed.getTime()) || (calendarDate && (
        parsed.getFullYear() !== Number(calendarDate[1]) ||
        parsed.getMonth() !== Number(calendarDate[2]) - 1 ||
        parsed.getDate() !== Number(calendarDate[3])
    ))) {
        throw new Error('Invalid workout date.');
    }
    return parsed;
};

const localDateKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export const createWorkout = (note: string = '', date: string | null = null, callback: (id: number) => void, onError?: ErrorCallback) => {
    try {
        const workoutDate = date === null ? new Date() : parseWorkoutDate(date);
        const requestedDay = localDateKey(workoutDate);
        let workoutId = 0;
        db.withTransactionSync(() => {
            // Older backups can contain multiple sessions on one date. Resume one without
            // merging or deleting any existing session, including records from past dates.
            const workouts = db.getAllSync<Workout>('SELECT * FROM workouts ORDER BY id DESC');
            const existing = workouts.find((workout) => localDateKey(parseWorkoutDate(workout.date)) === requestedDay);
            workoutId = existing?.id ?? db.runSync('INSERT INTO workouts (date, note) VALUES (?, ?)', [workoutDate.toISOString(), note]).lastInsertRowId;
        });
        callback(workoutId);
    } catch (error) {
        reportError('createWorkout', error, onError);
    }
};

export const getLatestWorkout = (callback: (workout: Workout | null) => void, onError?: ErrorCallback) => {
    try {
        const workout = db.getFirstSync<Workout>('SELECT * FROM workouts ORDER BY date DESC LIMIT 1');
        callback(workout);
    } catch (error) {
        console.error('getLatestWorkout error:', error);
        if (onError) onError(error);
        else callback(null);
    }
};

export const deleteWorkout = (id: number, callback: () => void, onError?: ErrorCallback) => {
    try {
        db.withTransactionSync(() => {
            db.runSync('DELETE FROM sets WHERE workout_id = ?', [id]);
            db.runSync('DELETE FROM workouts WHERE id = ?', [id]);
        });
        callback();
    } catch (error) {
        reportError('deleteWorkout', error, onError);
    }
};

export const getExercises = (callback: (exercises: Exercise[]) => void, onError?: ErrorCallback) => {
    try {
        const exercises = db.getAllSync<Exercise>('SELECT * FROM exercises ORDER BY name ASC');
        callback(exercises);
    } catch (error) {
        console.error('getExercises error:', error);
        if (onError) onError(error);
        else callback([]);
    }
};

export const addExercise = (name: string, targetBodyPart: string, callback: (id: number) => void, onError?: ErrorCallback) => {
    try {
        const trimmedName = name.trim();
        if (!trimmedName) throw new Error('Exercise name is required.');
        const result = db.runSync('INSERT INTO exercises (name, target_body_part) VALUES (?, ?)', [trimmedName, targetBodyPart.trim() || 'Other']);
        callback(result.lastInsertRowId);
    } catch (error) {
        reportError('addExercise', error, onError);
    }
};

const validateSetValues = (weight: number, reps: number) => {
    if (!isNonNegativeNumber(weight) || !isPositiveInteger(reps)) {
        throw new Error('Weight must be a finite number of zero or more, and reps must be a positive whole number.');
    }
};

export const addSet = (workoutId: number, exerciseId: number, weight: number, reps: number, callback: () => void, onError?: ErrorCallback) => {
    try {
        validateSetValues(weight, reps);
        db.runSync(
            'INSERT INTO sets (workout_id, exercise_id, weight_kg, reps) VALUES (?, ?, ?, ?)',
            [workoutId, exerciseId, weight, reps]
        );
        callback();
    } catch (error) {
        reportError('addSet', error, onError);
    }
};

export const updateSet = (setId: number, weight: number, reps: number, callback: () => void, onError?: ErrorCallback) => {
    try {
        validateSetValues(weight, reps);
        const result = db.runSync(
            'UPDATE sets SET weight_kg = ?, reps = ? WHERE id = ?',
            [weight, reps, setId]
        );
        if (result.changes === 0) throw new Error('The set no longer exists.');
        callback();
    } catch (error) {
        reportError('updateSet', error, onError);
    }
};

export const deleteSet = (setId: number, callback: () => void, onError?: ErrorCallback) => {
    try {
        db.runSync('DELETE FROM sets WHERE id = ?', [setId]);
        callback();
    } catch (error) {
        reportError('deleteSet', error, onError);
    }
};

export const getSetsForWorkout = (workoutId: number, callback: (sets: WorkoutSet[]) => void, onError?: ErrorCallback) => {
    try {
        const sets = db.getAllSync<WorkoutSet>(`
      SELECT s.*, e.name as exercise_name 
      FROM sets s 
      JOIN exercises e ON s.exercise_id = e.id 
      WHERE s.workout_id = ?
      ORDER BY s.id DESC
    `, [workoutId]);
        callback(sets);
    } catch (error) {
        console.error('getSetsForWorkout error:', error);
        if (onError) onError(error);
        else callback([]);
    }
};

export const getExerciseProgress = (exerciseId: number, callback: (data: ExerciseProgress[]) => void, onError?: ErrorCallback) => {
    try {
        const data = db.getAllSync<ExerciseProgress>(`
      SELECT w.date, MAX(s.weight_kg) as max_weight,
             MAX(s.weight_kg * (1.0 + s.reps / 30.0)) as one_rep_max
      FROM sets s
      JOIN workouts w ON s.workout_id = w.id
      WHERE s.exercise_id = ?
      GROUP BY w.id
      ORDER BY w.date ASC, w.id ASC
    `, [exerciseId]);
        // Calculate Estimated 1RM: Weight * (1 + Reps/30)
        const progressData = data.map(item => ({
            date: item.date,
            max_weight: item.max_weight,
            one_rep_max: Math.round(item.one_rep_max)
        }));
        callback(progressData);
    } catch (error) {
        console.error('getExerciseProgress error:', error);
        if (onError) onError(error);
        else callback([]);
    }
};

export const clearDatabase = (callback: () => void, onError?: ErrorCallback) => {
    try {
        db.withTransactionSync(() => {
            db.execSync('DELETE FROM routine_exercises; DELETE FROM routines; DELETE FROM sets; DELETE FROM workouts; DELETE FROM exercises;');
            seedStandardExercises();
        });
        callback();
    } catch (error) {
        reportError('clearDatabase', error, onError);
    }
};

export const cleanupEmptyWorkouts = (callback: () => void, onError?: ErrorCallback) => {
    try {
        db.runSync(`
            DELETE FROM workouts 
            WHERE id NOT IN (SELECT DISTINCT workout_id FROM sets) 
            AND (note IS NULL OR note = '')
        `);
        callback();
    } catch (error) {
        reportError('cleanupEmptyWorkouts', error, onError);
    }
};

export const exportDatabase = async () => {
    try {
        const exercises = db.getAllSync('SELECT * FROM exercises');
        const workouts = db.getAllSync('SELECT * FROM workouts');
        const sets = db.getAllSync('SELECT * FROM sets');
        const routines = db.getAllSync('SELECT * FROM routines');
        const routine_exercises = db.getAllSync('SELECT * FROM routine_exercises');

        const dump = { exercises, workouts, sets, routines, routine_exercises, version: 2, exportedAt: new Date().toISOString() };
        const fileUri = FileSystem.documentDirectory + 'localfit_memo_backup.json';
        await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(dump));
        await Sharing.shareAsync(fileUri);
    } catch (error) {
        console.error('exportDatabase error:', error);
        throw error;
    }
};

export const importDatabase = async (callback: () => void) => {
    try {
        const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
        if (result.canceled) return;

        const fileUri = result.assets[0].uri;
        const content = await FileSystem.readAsStringAsync(fileUri);
        const data = JSON.parse(content);

        const backup = validateBackupData(data);

        db.withTransactionSync(() => {
            db.execSync('DELETE FROM routine_exercises; DELETE FROM routines; DELETE FROM sets; DELETE FROM workouts; DELETE FROM exercises;');

            backup.exercises.forEach((e) => {
                db.runSync('INSERT INTO exercises (id, name, target_body_part) VALUES (?, ?, ?)', [e.id, e.name, e.target_body_part?.trim() || 'Other']);
            });
            backup.workouts.forEach((w) => {
                db.runSync('INSERT INTO workouts (id, date, note) VALUES (?, ?, ?)', [w.id, w.date, w.note]);
            });
            backup.sets.forEach((s) => {
                db.runSync('INSERT INTO sets (id, workout_id, exercise_id, weight_kg, reps) VALUES (?, ?, ?, ?, ?)', [s.id, s.workout_id, s.exercise_id, s.weight_kg, s.reps]);
            });
            backup.routines.forEach((routine) => {
                db.runSync('INSERT INTO routines (id, name) VALUES (?, ?)', [routine.id, routine.name]);
            });
            backup.routineExercises.forEach((exercise) => {
                db.runSync('INSERT INTO routine_exercises (id, routine_id, exercise_id, sort_order) VALUES (?, ?, ?, ?)', [exercise.id, exercise.routine_id, exercise.exercise_id, exercise.sort_order]);
            });
        });

        callback();
    } catch (err) {
        console.error(err);
        throw err;
    }
};

export const getLastSetForExercise = (exerciseId: number, callback: (set: WorkoutSet | null) => void, onError?: ErrorCallback) => {
    try {
        const set = db.getFirstSync<WorkoutSet>(`
            SELECT s.*, w.date 
            FROM sets s
            JOIN workouts w ON s.workout_id = w.id
            WHERE s.exercise_id = ?
            ORDER BY w.date DESC, s.id DESC
            LIMIT 1
        `, [exerciseId]);
        callback(set);
    } catch (error) {
        console.error('getLastSetForExercise error:', error);
        if (onError) onError(error);
        else callback(null);
    }
};

export const getPersonalBests = (callback: (data: PersonalBest[]) => void, onError?: ErrorCallback) => {
    try {
        const data = db.getAllSync<PersonalBest>(`
            SELECT e.id as exerciseId, e.name as exerciseName, s.weight_kg as maxWeight, s.reps as bestReps
            FROM exercises e
            JOIN sets s ON s.exercise_id = e.id
            WHERE s.id = (
                SELECT s2.id
                FROM sets s2
                WHERE s2.exercise_id = e.id
                ORDER BY s2.weight_kg DESC, s2.reps DESC, s2.id DESC
                LIMIT 1
            )
            ORDER BY e.name ASC
        `);
        callback(data);
    } catch (error) {
        console.error('getPersonalBests error:', error);
        if (onError) onError(error);
        else callback([]);
    }
};

// --- Routine (Preset) Functions ---

export interface Routine {
    id: number;
    name: string;
}

export const createRoutineFromWorkout = (name: string, workoutId: number, callback: () => void, onError?: ErrorCallback) => {
    try {
        const trimmedName = name.trim();
        if (!trimmedName) throw new Error('Routine name is required.');
        db.withTransactionSync(() => {
            // Preserve exercises in the order their first set was saved.
            const exercises = db.getAllSync<{ exercise_id: number }>(`
                SELECT exercise_id 
                FROM sets 
                WHERE workout_id = ? 
                GROUP BY exercise_id 
                ORDER BY MIN(id) ASC
            `, [workoutId]);
            if (exercises.length === 0) throw new Error('Save at least one set before creating a routine.');

            const res = db.runSync('INSERT INTO routines (name) VALUES (?)', [trimmedName]);
            const routineId = res.lastInsertRowId;

            exercises.forEach((ex, index) => {
                db.runSync(
                    'INSERT INTO routine_exercises (routine_id, exercise_id, sort_order) VALUES (?, ?, ?)',
                    [routineId, ex.exercise_id, index]
                );
            });
        });
        callback();
    } catch (error) {
        reportError('createRoutineFromWorkout', error, onError);
    }
};

export const getRoutines = (callback: (routines: Routine[]) => void, onError?: ErrorCallback) => {
    try {
        const routines = db.getAllSync<Routine>('SELECT * FROM routines ORDER BY name ASC');
        callback(routines);
    } catch (error) {
        console.error('getRoutines error:', error);
        if (onError) onError(error);
        else callback([]);
    }
};

export const getRoutineExercises = (routineId: number, callback: (exercises: RoutineExercise[]) => void, onError?: ErrorCallback) => {
    try {
        const exercises = db.getAllSync<RoutineExercise>(`
            SELECT re.exercise_id, e.name as exercise_name, e.target_body_part
            FROM routine_exercises re
            JOIN exercises e ON re.exercise_id = e.id
            WHERE re.routine_id = ?
            ORDER BY re.sort_order ASC
        `, [routineId]);

        callback(exercises);
    } catch (error) {
        console.error('getRoutineExercises error:', error);
        if (onError) onError(error);
        else callback([]);
    }
};

export const applyRoutineToWorkout = (_workoutId: number, routineId: number, callback: (exercises: RoutineExercise[]) => void, onError?: ErrorCallback) => {
    getRoutineExercises(routineId, callback, onError);
};
