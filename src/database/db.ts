import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

// Initialize DB synchronously
const db = SQLite.openDatabaseSync('ironvault.db');

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

export const initDB = () => {
    try {
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
    `);

        // Migration for existing users: Ensure tables exist even if DB was already init
        db.execSync(`
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
        `);

        // Standard Gym Exercises List
        const standardExercises = [
            // Chest
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
            ['Barbell Curl', 'Biceps'],
            ['Dumbbell Curl', 'Biceps'],
            ['Tricep Extension', 'Triceps'],
            ['Skullcrusher', 'Triceps'],
            ['Dips', 'Triceps'],
            // Core
            ['Crunch', 'Core'],
            ['Plank', 'Core'],
            ['Leg Raise', 'Core'],
            ['Ab Wheel', 'Core']
        ];

        db.withTransactionSync(() => {
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
        });
    } catch (error) {
        console.error('initDB error:', error);
    }
};



export const getWorkouts = (callback: (workouts: Workout[]) => void) => {
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
        callback([]);
    }
};

export const createWorkout = (note: string = '', date: string | null = null, callback: (id: number) => void) => {
    try {
        const workoutDate = date ? date : new Date().toISOString();
        const result = db.runSync('INSERT INTO workouts (date, note) VALUES (?, ?)', [workoutDate, note]);
        callback(result.lastInsertRowId);
    } catch (error) {
        console.error('createWorkout error:', error);
    }
};

export const getLatestWorkout = (callback: (workout: Workout | null) => void) => {
    try {
        const workout = db.getFirstSync<Workout>('SELECT * FROM workouts ORDER BY date DESC LIMIT 1');
        callback(workout);
    } catch (error) {
        console.error('getLatestWorkout error:', error);
        callback(null);
    }
};

export const deleteWorkout = (id: number, callback: () => void) => {
    try {
        db.runSync('DELETE FROM workouts WHERE id = ?', [id]);
        db.runSync('DELETE FROM sets WHERE workout_id = ?', [id]); // Just in case, though it should be empty
        callback();
    } catch (error) {
        console.error('deleteWorkout error:', error);
    }
};

export const getExercises = (callback: (exercises: Exercise[]) => void) => {
    try {
        const exercises = db.getAllSync<Exercise>('SELECT * FROM exercises ORDER BY name ASC');
        callback(exercises);
    } catch (error) {
        console.error('getExercises error:', error);
        callback([]);
    }
};

export const addExercise = (name: string, targetBodyPart: string, callback: () => void) => {
    try {
        db.runSync('INSERT INTO exercises (name, target_body_part) VALUES (?, ?)', [name, targetBodyPart]);
        callback();
    } catch (error) {
        console.error('addExercise error:', error);
    }
};

export const addSet = (workoutId: number, exerciseId: number, weight: number, reps: number, callback: () => void) => {
    try {
        db.runSync(
            'INSERT INTO sets (workout_id, exercise_id, weight_kg, reps) VALUES (?, ?, ?, ?)',
            [workoutId, exerciseId, weight, reps]
        );
        callback();
    } catch (error) {
        console.error('addSet error:', error);
    }
};

export const updateSet = (setId: number, weight: number, reps: number, callback: () => void) => {
    try {
        db.runSync(
            'UPDATE sets SET weight_kg = ?, reps = ? WHERE id = ?',
            [weight, reps, setId]
        );
        callback();
    } catch (error) {
        console.error('updateSet error:', error);
    }
};

export const deleteSet = (setId: number, callback: () => void) => {
    try {
        db.runSync('DELETE FROM sets WHERE id = ?', [setId]);
        callback();
    } catch (error) {
        console.error('deleteSet error:', error);
    }
};

export const getSetsForWorkout = (workoutId: number, callback: (sets: WorkoutSet[]) => void) => {
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
        callback([]);
    }
};

export const getExerciseProgress = (exerciseId: number, callback: (data: ExerciseProgress[]) => void) => {
    try {
        const data = db.getAllSync<{ date: string; max_weight: number; reps: number }>(`
      SELECT w.date, MAX(s.weight_kg) as max_weight, s.reps 
      FROM sets s 
      JOIN workouts w ON s.workout_id = w.id 
      WHERE s.exercise_id = ? 
      GROUP BY w.date 
      ORDER BY w.date ASC
    `, [exerciseId]);
        // Calculate Estimated 1RM: Weight * (1 + Reps/30)
        const progressData = data.map(item => ({
            date: item.date,
            max_weight: item.max_weight,
            one_rep_max: Math.round(item.max_weight * (1 + item.reps / 30))
        }));
        callback(progressData);
    } catch (error) {
        console.error('getExerciseProgress error:', error);
        callback([]);
    }
};

export const clearDatabase = (callback: () => void) => {
    try {
        db.withTransactionSync(() => {
            db.execSync('DELETE FROM sets; DELETE FROM workouts; DELETE FROM exercises;');
        });
        initDB();
        callback();
    } catch (error) {
        console.error('clearDatabase error:', error);
    }
};

export const cleanupEmptyWorkouts = (callback: () => void) => {
    try {
        db.runSync(`
            DELETE FROM workouts 
            WHERE id NOT IN (SELECT DISTINCT workout_id FROM sets) 
            AND (note IS NULL OR note = '')
        `);
        callback();
    } catch (error) {
        console.error('cleanupEmptyWorkouts error:', error);
    }
};

export const exportDatabase = async () => {
    try {
        const exercises = db.getAllSync('SELECT * FROM exercises');
        const workouts = db.getAllSync('SELECT * FROM workouts');
        const sets = db.getAllSync('SELECT * FROM sets');

        const dump = { exercises, workouts, sets, version: 1, exportedAt: new Date().toISOString() };
        const fileUri = FileSystem.documentDirectory + 'iron_vault_backup.json';
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

        if (!data.exercises || !data.workouts || !data.sets) {
            alert('Invalid backup file');
            return;
        }

        db.withTransactionSync(() => {
            db.execSync('DELETE FROM sets; DELETE FROM workouts; DELETE FROM exercises;');

            data.exercises.forEach((e: any) => {
                db.runSync('INSERT INTO exercises (id, name, target_body_part) VALUES (?, ?, ?)', [e.id, e.name, e.target_body_part]);
            });
            data.workouts.forEach((w: any) => {
                db.runSync('INSERT INTO workouts (id, date, note) VALUES (?, ?, ?)', [w.id, w.date, w.note]);
            });
            data.sets.forEach((s: any) => {
                db.runSync('INSERT INTO sets (id, workout_id, exercise_id, weight_kg, reps) VALUES (?, ?, ?, ?, ?)', [s.id, s.workout_id, s.exercise_id, s.weight_kg, s.reps]);
            });
        });

        callback();
    } catch (err) {
        console.error(err);
    }
};

export const getLastSetForExercise = (exerciseId: number, callback: (set: WorkoutSet | null) => void) => {
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
        callback(null);
    }
};

export const getPersonalBests = (callback: (data: { exerciseName: string; maxWeight: number; bestReps: number }[]) => void) => {
    try {
        const data = db.getAllSync<{ exerciseName: string; maxWeight: number; bestReps: number }>(`
            SELECT e.name as exerciseName, s.weight_kg as maxWeight, MAX(s.reps) as bestReps
            FROM sets s
            JOIN exercises e ON s.exercise_id = e.id
            JOIN (
                SELECT exercise_id, MAX(weight_kg) as max_w
                FROM sets
                GROUP BY exercise_id
            ) max_sets ON s.exercise_id = max_sets.exercise_id AND s.weight_kg = max_sets.max_w
            GROUP BY e.id, e.name
            ORDER BY e.name ASC
        `);
        callback(data);
    } catch (error) {
        console.error('getPersonalBests error:', error);
        callback([]);
    }
};

// --- Routine (Preset) Functions ---

export interface Routine {
    id: number;
    name: string;
}

export const createRoutineFromWorkout = (name: string, workoutId: number, callback: () => void) => {
    try {
        db.withTransactionSync(() => {
            // 1. Create Routine
            const res = db.runSync('INSERT INTO routines (name) VALUES (?)', [name]);
            const routineId = res.lastInsertRowId;

            // 2. Get distinct exercises from the workout, preserved in order of appearance (by min set id)
            // We use MIN(id) to determine the order they were first added
            const exercises = db.getAllSync<{ exercise_id: number }>(`
                SELECT exercise_id 
                FROM sets 
                WHERE workout_id = ? 
                GROUP BY exercise_id 
                ORDER BY MIN(id) ASC
            `, [workoutId]);

            // 3. Insert into routine_exercises
            exercises.forEach((ex, index) => {
                db.runSync(
                    'INSERT INTO routine_exercises (routine_id, exercise_id, sort_order) VALUES (?, ?, ?)',
                    [routineId, ex.exercise_id, index]
                );
            });
        });
        callback();
    } catch (error) {
        console.error('createRoutineFromWorkout error:', error);
    }
};

export const getRoutines = (callback: (routines: Routine[]) => void) => {
    try {
        const routines = db.getAllSync<Routine>('SELECT * FROM routines ORDER BY name ASC');
        callback(routines);
    } catch (error) {
        console.error('getRoutines error:', error);
        callback([]);
    }
};

export const applyRoutineToWorkout = (workoutId: number, routineId: number, callback: () => void) => {
    try {
        db.withTransactionSync(() => {
            const exercises = db.getAllSync<{ exercise_id: number }>(`
                SELECT exercise_id 
                FROM routine_exercises 
                WHERE routine_id = ? 
                ORDER BY sort_order ASC
            `, [routineId]);

            // Add one empty set for each exercise as a placeholder
            exercises.forEach(ex => {
                // weight=0, reps=0 acts as a "to do" item
                db.runSync(
                    'INSERT INTO sets (workout_id, exercise_id, weight_kg, reps) VALUES (?, ?, 0, 0)',
                    [workoutId, ex.exercise_id]
                );
            });
        });
        callback();
    } catch (error) {
        console.error('applyRoutineToWorkout error:', error);
    }
};
