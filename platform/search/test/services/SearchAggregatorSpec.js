/*****************************************************************************
 * Open MCT Web, Copyright (c) 2014-2015, United States Government
 * as represented by the Administrator of the National Aeronautics and Space
 * Administration. All rights reserved.
 *
 * Open MCT Web is licensed under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 *
 * Open MCT Web includes source code licensed under additional open source
 * licenses. See the Open Source Licenses file (LICENSES.md) included with
 * this source code distribution or the Licensing information page available
 * at runtime from the About dialog for additional information.
 *****************************************************************************/
/*global define,describe,it,expect,beforeEach,jasmine,Promise,waitsFor,spyOn*/

/**
 *  SearchSpec. Created by shale on 07/31/2015.
 */
define([
    "../../src/services/SearchAggregator"
], function (SearchAggregator) {
    "use strict";

    describe("SearchAggregator", function () {
        var $q,
            objectService,
            providers,
            aggregator;

        beforeEach(function () {
            $q = jasmine.createSpyObj(
                '$q',
                ['all']
            );
            $q.all.andReturn(Promise.resolve([]));
            objectService = jasmine.createSpyObj(
                'objectService',
                ['getObjects']
            );
            providers = [],
            aggregator = new SearchAggregator($q, objectService, providers);
        });


        it("can order model results by score", function () {
            var modelResults = {
                    hits: [
                        {score: 1},
                        {score: 23},
                        {score: 11}
                    ]
                },
                sorted = aggregator.orderByScore(modelResults);

            expect(sorted.hits).toEqual([
                {score: 23},
                {score: 11},
                {score: 1}
            ]);
        });

        it('filters results without a function', function () {
            var modelResults = {
                    hits: [
                        {thing: 1},
                        {thing: 2}
                    ],
                    total: 2
                },
                filtered = aggregator.applyFilter(modelResults);

            expect(filtered.hits).toEqual([
                {thing: 1},
                {thing: 2}
            ]);

            expect(filtered.total).toBe(2);
        });

        it('filters results with a function', function () {
            var modelResults = {
                    hits: [
                        {model: {thing: 1}},
                        {model: {thing: 2}},
                        {model: {thing: 3}}
                    ],
                    total: 3
                },
                filterFunc = function (model) {
                    return model.thing < 2;
                },
                filtered = aggregator.applyFilter(modelResults, filterFunc);

            expect(filtered.hits).toEqual([
                {model: {thing: 1}}
            ]);
            expect(filtered.total).toBe(1);
        });

        it('can remove duplicates', function () {
            var modelResults = {
                    hits: [
                        {id: 15},
                        {id: 23},
                        {id: 14},
                        {id: 23}
                    ],
                    total: 4
                },
                deduped = aggregator.removeDuplicates(modelResults);

            expect(deduped.hits).toEqual([
                {id: 15},
                {id: 23},
                {id: 14}
            ]);
            expect(deduped.total).toBe(3);
        });

        it('can convert model results to object results', function () {
            var modelResults = {
                    hits: [
                        {id: 123, score: 5},
                        {id: 234, score: 1}
                    ],
                    total: 2
                },
                objects = {
                    123: '123-object-hey',
                    234: '234-object-hello'
                },
                promiseChainComplete = false;

            objectService.getObjects.andReturn(Promise.resolve(objects));

            aggregator
                .asObjectResults(modelResults)
                .then(function (objectResults) {
                    expect(objectResults).toEqual({
                        hits: [
                            {id: 123, score: 5, object: '123-object-hey'},
                            {id: 234, score: 1, object: '234-object-hello'}
                        ],
                        total: 2
                    });
                })
                .then(function () {
                    promiseChainComplete = true;
                });

            waitsFor(function () {
                return promiseChainComplete;
            });
        });

        it('can send queries to providers', function () {
            var provider = jasmine.createSpyObj(
                    'provider',
                    ['query']
                );
            provider.query.andReturn('i prooomise!');
            providers.push(provider);

            aggregator.query('find me', 123, 'filter');
            expect(provider.query).toHaveBeenCalledWith('find me', 123);
            expect($q.all).toHaveBeenCalledWith(['i prooomise!']);
        });

        it('supplies max results when none is provided', function () {
            var provider = jasmine.createSpyObj(
                    'provider',
                    ['query']
                );
            providers.push(provider);
            aggregator.query('find me');
            expect(provider.query).toHaveBeenCalledWith('find me', 100);
        });

        it('can combine responses from multiple providers', function () {
            var providerResponses = [
                    {
                        hits: [
                            'oneHit',
                            'twoHit'
                        ],
                        total: 2
                    },
                    {
                        hits: [
                            'redHit',
                            'blueHit',
                            'by',
                            'Pete'
                        ],
                        total: 4
                    }
                ],
                promiseChainResolved = false;

            $q.all.andReturn(Promise.resolve(providerResponses));
            spyOn(aggregator, 'orderByScore').andReturn('orderedByScore!');
            spyOn(aggregator, 'applyFilter').andReturn('filterApplied!');
            spyOn(aggregator, 'removeDuplicates')
                .andReturn('duplicatesRemoved!');
            spyOn(aggregator, 'asObjectResults').andReturn('objectResults');

            aggregator
                .query('something', 10, 'filter')
                .then(function (objectResults) {
                    expect(aggregator.orderByScore).toHaveBeenCalledWith({
                        hits: [
                            'oneHit',
                            'twoHit',
                            'redHit',
                            'blueHit',
                            'by',
                            'Pete'
                        ],
                        total: 6
                    });
                    expect(aggregator.applyFilter)
                        .toHaveBeenCalledWith('orderedByScore!', 'filter');
                    expect(aggregator.removeDuplicates)
                        .toHaveBeenCalledWith('filterApplied!');
                    expect(aggregator.asObjectResults)
                        .toHaveBeenCalledWith('duplicatesRemoved!');

                    expect(objectResults).toBe('objectResults');
                })
                .then(function () {
                    promiseChainResolved = true;
                });

            waitsFor(function () {
                return promiseChainResolved;
            });
        });

    });
});
