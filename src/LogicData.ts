import _ from 'lodash';
import { splitFirstPathSegment } from './Util.js';

type Area = {
    abstract: boolean;
    name: string;
    entrances: Record<string, unknown>;
    exits: Record<string, unknown>;
    hint_region: string;
    locations: Record<string, string>;
    sub_areas: Record<string, Area>;
};

type Entrance = {
    allowed_time_of_day: unknown;
    short_name: string;
};

type Exit = {
    vanilla: string;
    short_name: string;
};

type DumpFile = {
    areas: Area;
    items: string[];
    entrances: Record<string, Entrance>;
    exits: Record<string, Exit>;
    gossip_stones: Record<string, string>;
    checks: Record<string, string>;
};

type MacroValue = string | Map<string, MacroValue>;
type LocValue = string | Map<string, LocValue>;

export const topMacros = new Map<string, MacroValue>();
export const topLocations = new Map<string, LocValue>();
let entrances: Record<string, Entrance> = {};
let exits: Record<string, Exit> = {};

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
            throw new Error('Cannot have a value at the same path as a region');
        }
    } else {
        const parts = splitFirstPathSegment(path);
        const segment = parts[0];
        const remaining = parts[1];

        const currValue = values.get(segment);
        if (!currValue) {
            values.set(segment, new Map());
        } else if (typeof currValue === 'string') {
            throw new Error('Cannot have a region at the same path as a value');
        }
        const childMap = values.get(segment);
        if (!childMap || typeof childMap === 'string') {
            throw new Error(`Unable to find a suitable destination`);
        }
        updateValueRecursive(remaining, value, childMap);
    }
};

export const updateMacro = (path: string, requirements: string) => {
    // console.log(`updating macro at ${path} with ${requirements}`);
    updateValueRecursive(path, requirements, topMacros);
};

export const updateLocation = (path: string, requirements: string) => {
    // console.log(`updating location at ${path} with ${requirements}`);
    updateValueRecursive(path, requirements, topLocations);
};

export const findConnectingEntrance = (exitPath: string) => {
    const exit = exits[exitPath];
    if (!exit) return undefined;
    const entranceShort = exit.vanilla;
    return _.findKey(
        entrances,
        (entrance) => entrance.short_name === entranceShort,
    );
};

export const copyDumpData = (dump: DumpFile) => {
    exits = dump.exits;
    entrances = dump.entrances;
};

export default {};
