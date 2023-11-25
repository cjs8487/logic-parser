import { splitFirstPathSegment } from './Util.js';

type MacroValue = string | Map<string, MacroValue>;
type LocValue = string | Map<string, LocValue>;

export const topMacros = new Map<string, MacroValue>();
export const topLocations = new Map<string, LocValue>();

const updateValueRecursive = (
    path: string,
    value: string,
    values: Map<string, MacroValue>,
) => {
    if (!path.includes('\\')) {
        const currValue = values.get(path);
        if (!currValue) {
            values.set(path, value);
        } else if (typeof currValue === 'string') {
            const curr = values.get(path);
            values.set(path, `${curr} | ${value}`);
        } else {
            throw new Error('Cannot have a macro at the same path as a region');
        }
    } else {
        const parts = splitFirstPathSegment(path);
        const segment = parts[0];
        const remaining = parts[1];

        const currValue = values.get(segment);
        if (!currValue) {
            values.set(segment, new Map());
        } else if (typeof currValue === 'string') {
            throw new Error('Cannot have a region at the same path as a macro');
        }
        const childMap = values.get(segment);
        if (!childMap || typeof childMap === 'string') {
            throw new Error(`Unable to find a suitable destination`);
        }
        updateValueRecursive(remaining, value, childMap);
    }
};

export const updateMacro = (path: string, requirements: string) => {
    updateValueRecursive(path, requirements, topMacros);
};

export const updateLocation = (path: string, requirements: string) => {
    updateValueRecursive(path, requirements, topLocations);
};

export default {};
