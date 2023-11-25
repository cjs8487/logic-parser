export const splitFirstPathSegment = (path: string) => {
    const segments = path.split('\\');
    const first = segments.shift();
    if (first === undefined) {
        return [path];
    }
    const remaining = segments.join('\\');
    return [first, remaining];
};

export const rsplit = (str: string, delim: string, count: number) => {
    const parts = str.split(delim);
    const splits = parts.splice(parts.length - count);
    return [parts.join(delim), ...splits];
};
