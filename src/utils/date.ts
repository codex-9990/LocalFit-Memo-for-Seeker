const pad2 = (value: number) => value.toString().padStart(2, '0');

export const toLocalDateKey = (value: Date | string | number) => {
    // Backups may store a calendar day without a time zone. Date's string parser
    // treats that format as UTC, which shifts it to yesterday west of UTC.
    const date = value instanceof Date ? value
        : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
            ? dateKeyToLocalNoon(value)
            : new Date(value);

    return [
        date.getFullYear(),
        pad2(date.getMonth() + 1),
        pad2(date.getDate()),
    ].join('-');
};

export const datePartsToLocalNoon = (year: number, month: number, day: number) => {
    return new Date(year, month - 1, day, 12, 0, 0, 0);
};

export const dateKeyToLocalNoon = (dateKey: string) => {
    const [year, month, day] = dateKey.split('-').map(Number);
    return datePartsToLocalNoon(year, month, day);
};
