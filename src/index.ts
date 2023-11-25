import _ from 'lodash';
import { load } from 'js-yaml';
import fetch from 'node-fetch';
import {
    topLocations,
    topMacros,
    updateLocation,
    updateMacro,
} from './LogicData.js';
import { splitFirstPathSegment } from './Util.js';

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

const loadLogicDump = async () => {
    const dump = (await loadFile('dump')) as DumpFile;
    // console.log(dump.areas);
    // console.log(dump.areas.sub_areas['Ancient Cistern']);
    // console.log(_.keys(dump.checks));
    // const macros: Map<string, MacroValue> = new Map();
    // const locations: Map<string, LocValue> = new Map();
    collectLocations(dump.areas, _.keys(dump.checks));

    console.log(topMacros);
    console.log(topLocations);
};

loadLogicDump();
