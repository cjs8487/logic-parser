export const splitFirstPathSegment = (path: string) => {
    const segments = path.split('\\');
    const first = segments.shift();
    if (first === undefined) {
        return [path];
    }
    const remaining = segments.join('\\');
    return [first, remaining];
};

export default {};
