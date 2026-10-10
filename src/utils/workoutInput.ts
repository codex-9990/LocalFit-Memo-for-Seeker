export type WorkoutInputResult =
    | { ok: true; weight: number; reps: number }
    | { ok: false; reason: 'missing' | 'invalid' };

/** Validate the complete input rather than silently truncating pasted values. */
export function parseWorkoutInput(weightText: string, repsText: string): WorkoutInputResult {
    const weight = weightText.trim();
    const reps = repsText.trim();
    if (!weight || !reps) return { ok: false, reason: 'missing' };
    const parsedWeight = Number(weight);
    const parsedReps = Number(reps);
    if (
        !/^\d*(?:\.\d*)?$/.test(weight) || !Number.isFinite(parsedWeight) || parsedWeight < 0 ||
        !/^\d+$/.test(reps) || !Number.isSafeInteger(parsedReps) || parsedReps < 1
    ) return { ok: false, reason: 'invalid' };
    return { ok: true, weight: parsedWeight, reps: parsedReps };
}
