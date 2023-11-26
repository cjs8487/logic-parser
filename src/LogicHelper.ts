/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable indent */
/* eslint-disable no-use-before-define */
import _ from 'lodash';
import BooleanExpression, { Op, ReducerArg } from './BooleanExpression.js';
import { getMacro } from './LogicData.js';

type NestedArray<T> = (T | NestedArray<T>)[];

interface EvaluatedBooleanExpression {
    items: EvaluatedRequirement[];
    type: Op;
    value: boolean;
}

type EvaluatedRequirement =
    | EvaluatedBooleanExpression
    | {
          item: string;
          value: boolean;
      };

export interface ReadableRequirement {
    item: string;
    name: string;
}

const splitExpression = (expression: string) =>
    // console.log(expression);
    _.compact(_.map(expression.split(/\s*([(&|)])\s*/g), _.trim));

export const booleanExpressionForRequirements = (
    requirements: string,
    visitedRequirements = new Set<string>(),
) => {
    // console.log(requirements);
    const expressionTokens = splitExpression(requirements);
    return booleanExpressionForTokens(expressionTokens, visitedRequirements);
};

const parseRequirement = (
    requirement: string,
    visitedRequirements: Set<string>,
) => {
    const requirementValue = getMacro(requirement);
    if (typeof requirementValue === 'object') throw new Error();
    if (requirementValue) {
        if (visitedRequirements.has(requirement)) {
            return 'Impossible';
        }
        return booleanExpressionForRequirements(
            requirementValue,
            new Set(visitedRequirements).add(requirement),
        );
    }

    const trickMatch = requirement.match(/^(.+) Trick$/);
    let expandedRequirement;

    if (trickMatch) {
        const trickName = trickMatch[1];
        expandedRequirement = `Option "enabled-tricks" Contains "${trickName}"`;
    } else {
        expandedRequirement = requirement;
    }

    const optionEnabledRequirementValue =
        checkOptionEnabledRequirement(expandedRequirement);
    if (!_.isNil(optionEnabledRequirementValue)) {
        return optionEnabledRequirementValue ? 'Nothing' : 'Impossible';
    }
    if (expandedRequirement.includes('damage')) {
        // console.log(expandedRequirement);
    }
    return expandedRequirement;
};

const booleanExpressionForTokens = (
    expressionTokens: string[],
    visitedRequirements: Set<string>,
): BooleanExpression => {
    const itemsForExpression = [];
    let expressionTypeToken;
    while (!_.isEmpty(expressionTokens)) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const currentToken = expressionTokens.shift()!;
        if (currentToken === '&' || currentToken === '|') {
            expressionTypeToken = currentToken;
        } else if (currentToken === '(') {
            const childExpression = booleanExpressionForTokens(
                expressionTokens,
                visitedRequirements,
            );
            itemsForExpression.push(childExpression);
        } else if (currentToken === ')') {
            break;
        } else {
            itemsForExpression.push(
                parseRequirement(currentToken, visitedRequirements),
            );
        }
    }
    if (expressionTypeToken === '|') {
        return BooleanExpression.or(...itemsForExpression);
    }
    return BooleanExpression.and(...itemsForExpression);
};

export const requirementImplies = (
    firstRequirement: string,
    secondRequirement: string,
) => {
    if (firstRequirement === secondRequirement) {
        return true;
    }
    if (firstRequirement === 'Impossible' || firstRequirement === 'False') {
        return true;
    }

    if (secondRequirement === 'Nothing' || secondRequirement === 'True') {
        return true;
    }
    const firstItemCountRequirement =
        parseItemCountRequirement(firstRequirement);
    const secondItemCountRequirement =
        parseItemCountRequirement(secondRequirement);

    if (
        !_.isNil(firstItemCountRequirement) &&
        !_.isNil(secondItemCountRequirement) &&
        firstItemCountRequirement.itemName ===
            secondItemCountRequirement.itemName
    ) {
        return (
            firstItemCountRequirement.countRequired >
            secondItemCountRequirement.countRequired
        );
    }
    return false;
};

const createReadableRequirements = (
    requirements: EvaluatedBooleanExpression,
    // eslint-disable-next-line consistent-return
) => {
    // eslint-disable-next-line default-case
    switch (requirements.type) {
        case Op.And:
            return _.map(requirements.items, (item) =>
                _.flattenDeep(createReadableRequirementsHelper(item)),
            );
        case Op.Or:
            return [
                _.flattenDeep(createReadableRequirementsHelper(requirements)),
            ];
    }
};

const createReadableRequirementsHelper = (
    requirements: EvaluatedRequirement,
): NestedArray<ReadableRequirement> => {
    if ('item' in requirements) {
        const prettyItemName = prettyNameForItemRequirement(requirements.item);
        return [
            {
                item: requirements.item,
                name: prettyItemName,
            },
        ];
    }
    return _.map(requirements.items, (item, index) => {
        const currentResult: NestedArray<ReadableRequirement> = [];
        if ('items' in item) {
            // expression
            currentResult.push([
                {
                    item: '(',
                    name: '(',
                },
                createReadableRequirementsHelper(item),
                {
                    item: ')',
                    name: ')',
                },
            ]);
        } else {
            currentResult.push(createReadableRequirementsHelper(item));
        }

        if (index < requirements.items.length - 1) {
            if (requirements.type === Op.And) {
                currentResult.push({
                    item: ' and ',
                    name: ' and ',
                });
            } else {
                currentResult.push({
                    item: ' or ',
                    name: ' or ',
                });
            }
        }
        return currentResult;
    });
};

const evaluatedRequirements = (requirements: BooleanExpression) => {
    const generateReducerFunction =
        (getAccumulatorValue: (acc: boolean, value: boolean) => boolean) =>
        ({
            accumulator,
            item,
            isReduced,
        }: ReducerArg<EvaluatedBooleanExpression>) => {
            if (isReduced) {
                return {
                    items: _.concat(accumulator.items, item),
                    type: accumulator.type,
                    value: getAccumulatorValue(accumulator.value, item.value),
                };
            }

            const wrappedItem = {
                item,
                value: false,
            };

            return {
                items: _.concat(accumulator.items, wrappedItem),
                type: accumulator.type,
                value: getAccumulatorValue(
                    accumulator.value,
                    wrappedItem.value,
                ),
            };
        };

    return requirements.reduce<EvaluatedBooleanExpression>({
        andInitialValue: {
            items: [],
            type: Op.And,
            value: true,
        },
        andReducer: (reducerArgs) =>
            generateReducerFunction(
                (accumulatorValue, itemValue) => accumulatorValue && itemValue,
            )(reducerArgs),
        orInitialValue: {
            items: [],
            type: Op.Or,
            value: false,
        },
        orReducer: (reducerArgs) =>
            generateReducerFunction(
                (accumulatorValue, itemValue) => accumulatorValue || itemValue,
            )(reducerArgs),
    });
};

const parseItemCountRequirement = (requirement: string) => {
    const itemCountRequirementMatch = requirement.match(/((?:\w|\s)+) x(\d+)/);
    if (itemCountRequirementMatch) {
        return {
            itemName: itemCountRequirementMatch[1],
            countRequired: _.toSafeInteger(itemCountRequirementMatch[2]),
        };
    }
    return null;
};

const prettyNameForItemRequirement = (itemRequirement: string) => {
    const itemCountRequirement = parseItemCountRequirement(itemRequirement);
    if (!_.isNil(itemCountRequirement)) {
        const { itemName, countRequired } = itemCountRequirement;

        return prettyNameOverride(itemName, countRequired) || itemRequirement;
    }
    return prettyNameOverride(itemRequirement) || itemRequirement;
};

const prettyNameOverride = (itemName: string, itemCount = 1) =>
    `${itemName} x${itemCount}`;

const prettyNameForItem = (itemName: string, itemCount: number) => {
    const prettyName = prettyNameOverride(itemName, itemCount);
    if (!_.isNil(prettyName)) {
        return prettyName;
    }
    return itemName;
};

// _.get(prettytemNames, [itemName, itemCount]) as string;

const checkOptionEnabledRequirement = (requirement: string) => {
    const matchers: {
        regex: RegExp;
        value: (optionValue: string, expectedValue: string) => boolean;
    }[] = [
        {
            regex: /^Option "([^"]+)" Enabled$/,
            value: (optionValue) => Boolean(optionValue),
        },
        {
            regex: /^Option "([^"]+)" Disabled$/,
            value: (optionValue) => !optionValue,
        },
        {
            regex: /^Option "([^"]+)" Is "([^"]+)"$/,
            value: (optionValue, expectedValue) =>
                optionValue === expectedValue,
        },
        // special case for integers after 'Is'
        {
            regex: /^Option "([^"]+)" Is ([^"]+)$/,
            value: (optionValue, expectedValue) =>
                parseInt(optionValue, 10) === parseInt(expectedValue, 10),
        },
        {
            regex: /^Option "([^"]+)" Is Not "([^"]+)"$/,
            value: (optionValue, expectedValue) =>
                optionValue !== expectedValue,
        },
        {
            regex: /^Option "([^"]+)" Contains "([^"]+)"$/,
            value: (optionValue, expectedValue) =>
                optionValue.includes(expectedValue),
        },
        {
            regex: /^Option "([^"]+)" Does Not Contain "([^"]+)"$/,
            value: (optionValue, expectedValue) =>
                !optionValue.includes(expectedValue),
        },
    ];

    // let optionEnabledRequirementValue;

    _.forEach(matchers, (matcher) => {
        const requirementMatch = requirement.match(matcher.regex);
        if (requirementMatch) {
            // const optionName = requirementMatch[1] as keyof RawOptions;
            // const optionValue = getOptionValue(optionName) as string;
            // const expectedValue = requirementMatch[2];
            // optionEnabledRequirementValue = matcher.value(
            //     optionValue,
            //     expectedValue,
            // );

            return false; // break loop
        }
        return true; // continue
    });

    // return optionEnabledRequirementValue;
    return false;
};
