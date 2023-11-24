import _ from 'lodash';
import { load } from 'js-yaml';
import fetch from 'node-fetch';

const loadFileFromUrl = async (url: string) => {
    const response = await fetch(url);
    return response.text();
};

const baseFleUrl = (file: string) =>
    `https://raw.githubusercontent.com/cjs8487/ssrando/logic-dump/${file}.yaml`;

const loadFile = async (file: string) => {
    const fileUrl = baseFleUrl(file);
    const data = await loadFileFromUrl(fileUrl);
    return load(data);
};

type Area = {
    abstract: boolean;
    name: string;
    entrances: Record<string, unknown>;
    exits: Record<string, unknown>;
    hint_region: string;
    locations: Record<string, string>;
    sub_areas: Record<string, Area>;
};

type DumpFile = {
    areas: Area;
    items: string[];
    entrances: Record<string, unknown>;
    exits: Record<string, unknown>;
    gossip_stones: Record<string, string>;
    checks: Record<string, string>;
};

type MacroValue = string | Map<string, MacroValue>;
type LocValue = string | Map<string, LocValue>;

const collectLocations = (
    area: Area,
    checks: string[],
    topMacros: Map<string, MacroValue>,
    topLocations: Map<string, LocValue>,
    localMacros: Map<string, MacroValue>,
    localLocations: Map<string, LocValue>,
) => {
    if (!area.abstract) {
        _.forEach(area.locations, (reqs, location) => {
            if (checks.includes(`${area.name}\\${location}`)) {
                if (localLocations.has(location)) {
                    localLocations.set(
                        location,
                        `${localLocations.get(location)} | ${reqs}`,
                    );
                } else {
                    localLocations.set(location, reqs);
                }
            } else if (localMacros.has(location)) {
                localMacros.set(
                    location,
                    `${localMacros.get(location)} | ${reqs}`,
                );
            } else {
                localMacros.set(location, reqs);
            }
        });
    } else {
        _.forEach(area.locations, (reqs, macro) => {
            if (localMacros.has(macro)) {
                localMacros.set(macro, `${localMacros.get(macro)} | ${reqs}`);
            } else {
                localMacros.set(macro, reqs);
            }
        });
    }
    _.forEach(area.sub_areas, (subarea, localName) => {
        const childMacros = new Map<string, MacroValue>();
        const childLocations = new Map<string, LocValue>();
        localMacros.set(localName, childMacros);
        localLocations.set(localName, childLocations);

        collectLocations(
            subarea,
            checks,
            topMacros,
            topLocations,
            childMacros,
            childLocations,
        );
    });
};

const loadLogicDump = async () => {
    const dump = (await loadFile('dump')) as DumpFile;
    // console.log(dump.areas);
    console.log(dump.areas.sub_areas['Ancient Cistern']);
    // console.log(_.keys(dump.checks));
    const macros: Map<string, MacroValue> = new Map();
    const locations: Map<string, LocValue> = new Map();
    collectLocations(
        dump.areas.sub_areas['Ancient Cistern'],
        _.keys(dump.checks),
        macros,
        locations,
        macros,
        locations,
    );

    console.log(macros);
    console.log(locations);
};

loadLogicDump();
