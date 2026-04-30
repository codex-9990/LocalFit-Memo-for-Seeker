const pad2 = (value: number) => value.toString().padStart(2, '0');

export const toLocalDateKey = (value: Date | string | number) => {
    const date = value instanceof Date ? value : new Date(value);

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
