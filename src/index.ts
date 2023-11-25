import _ from 'lodash';
import { load } from 'js-yaml';
import fetch from 'node-fetch';
import {
    copyDumpData,
    findConnectingEntrance,
    topLocations,
    topMacros,
    updateLocation,
    updateMacro,
} from './LogicData.js';
import { rsplit, splitFirstPathSegment } from './Util.js';

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

const collectLocations = (area: Area, checks: string[]) => {
    if (area.abstract) {
        _.forEach(area.locations, (reqs, macro) => {
            if (macro.includes('\\')) {
                updateMacro(splitFirstPathSegment(macro)[1], reqs);
            } else {
                updateMacro(
                    `${splitFirstPathSegment(area.name)[1]}\\${macro}`,
                    reqs,
                );
            }
        });
    } else {
        _.forEach(area.locations, (reqs, location) => {
            if (location.includes('\\')) {
                updateMacro(splitFirstPathSegment(location)[1], reqs);
            } else {
                updateLocation(
                    `${splitFirstPathSegment(area.name)[1]}\\${location}`,
                    reqs,
                );
            }
        });
    }
    _.forEach(area.sub_areas, (subarea) => {
        collectLocations(subarea, checks);
    });
};

const findArea = (path: string, area: Area): Area => {
    if (path === 'General') {
        return area;
    }
    if (path.includes('\\')) {
        const [segment, latePath] = splitFirstPathSegment(path);
        return findArea(latePath, area.sub_areas[segment]);
    }
    return area.sub_areas[path];
};

const loadLogicDump = async () => {
    const dump = (await loadFile('dump')) as DumpFile;
    copyDumpData(dump);
    // console.log(dump.areas);
    // console.log(dump.areas.sub_areas['Ancient Cistern']);
    // console.log(_.keys(dump.checks));
    // const macros: Map<string, MacroValue> = new Map();
    // const locations: Map<string, LocValue> = new Map();
    // collectLocations(dump.areas, _.keys(dump.checks));

    const startEntrance = findConnectingEntrance('\\Start')?.slice(1);

    if (!startEntrance) return;
    const [startAreaName] = rsplit(startEntrance, '\\', 1);
    const startArea = findArea(startAreaName, dump.areas);

    const exploreArea = (area: Area, explored: string[]) => {
        if (!area) {
            console.log('ERROR UNDEFINED AREA');
            return;
        }
        console.log(`In ${area.name}`);
        if (explored.includes(area.name)) {
            console.log('already explored');
            return;
        }
        console.log(area.locations);
        explored.push(area.name);
        _.forEach(area.exits, (reqs, exit) => {
            console.log(exit);
            let destAreaName;
            if (exit.includes('\\')) {
                const destEntrance = findConnectingEntrance(exit);
                if (destEntrance) {
                    [destAreaName] = rsplit(destEntrance, '\\', 1);
                } else {
                    destAreaName = exit;
                }
            } else {
                const destExit = `${area.name}\\${exit}`;
                const destEntrance = findConnectingEntrance(destExit);
                if (!destEntrance) {
                    console.log('ERROR NO DESTINATION FOUND');
                    return;
                }
                [destAreaName] = rsplit(destEntrance, '\\', 1);
            }
            // if (exit.endsWith('Exit')) {
            //     let path;
            //     if (exit.includes('\\')) {
            //         path = exit;
            //     } else {
            //         path = `${area.name}\\${exit}`;
            //     }
            //     const destEntrance = findConnectingEntrance(path);
            //     if (!destEntrance) return;
            //     [destAreaName] = rsplit(destEntrance, '\\', 1);
            // } else if (exit.endsWith('Entrance')) {
            //     let path;
            //     if (exit.includes('\\')) {
            //         path = exit;
            //     } else {
            //         path = `${area.name}\\${exit}`;
            //     }
            //     const destEntrance = findConnectingEntrance(path);
            //     if (!destEntrance) return;
            //     [destAreaName] = rsplit(destEntrance, '\\', 1);
            // } else if (exit.startsWith('Exit to')) {
            //     let path;
            //     if (exit.includes('\\')) {
            //         path = exit;
            //     } else {
            //         path = `${area.name}\\${exit}`;
            //     }
            //     const destEntrance = findConnectingEntrance(path);
            //     if (!destEntrance) return;
            //     [destAreaName] = rsplit(destEntrance, '\\', 1);
            // } else {
            //     console.log('exit name is area name');
            //     destAreaName = exit;
            // }
            console.log(destAreaName);
            const destArea = findArea(destAreaName.slice(1), dump.areas);
            console.log(`Travelling to ${destArea.name} via ${exit}`);
            exploreArea(destArea, explored);
        });
        console.log(
            `Done exploring ${area.name} (sanity check - ${explored.pop()})`,
        );
    };

    exploreArea(startArea, []);
};

loadLogicDump();
