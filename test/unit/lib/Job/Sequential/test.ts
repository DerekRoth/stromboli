import * as sinon from 'sinon';
import * as tape from 'tape';

import {JobSequential} from "../../../../../src/lib/Job/Sequential";
import {BuildRequest} from "../../../../../src/lib/BuildRequest";
import {Binary} from "../../../../../src/lib/Binary";
import {Source} from "../../../../../src/lib/Source";
import {Task} from "../../../../../src/lib/Task";
import {Error as StromboliError} from "../../../../../src/lib/Error";
import {ComponentInterface} from "../../../../../src/lib/ComponentInterface";

class FooTask extends Task {
    /**
     * @param {BuildRequest} buildRequest
     * @return {Promise<void>}
     */
    run(buildRequest: BuildRequest) {
        buildRequest.addBinary(new Binary('bin1', new Buffer('bin1data')));
        buildRequest.addBinary(new Binary('bin2', new Buffer('bin2data'), new Buffer('bin2map')));

        buildRequest.addDependency(new Source('dep1', 'dep1data'));
        buildRequest.addDependency(new Source('dep2', 'dep2data'));
        buildRequest.addDependency(new Source('dep3', 'dep3data'));

        return Promise.resolve();
    }
}

class BarTask extends Task {
    /**
     * @param {BuildRequest} buildRequest
     * @return {Promise<void>}
     */
    run(buildRequest: BuildRequest) {
        return Promise.resolve();
    }
}

class ErrorTask extends Task {
    /**
     * @param {BuildRequest} buildRequest
     * @return {Promise<void>}
     */
    run(buildRequest: BuildRequest) {
        return buildRequest.source.then(
            (source) => {
                buildRequest.addBinary(new Binary('bin1', new Buffer('bin1data')));

                buildRequest.addDependency(new Source('dep1', 'dep1data'));

                buildRequest.addError(new StromboliError('err1message', source, 1));
            }
        );
    }
}

class ErrorTask2 extends Task {
    /**
     * @param {BuildRequest} buildRequest
     * @return {Promise<void>}
     */
    run(buildRequest: BuildRequest) {
        return buildRequest.source.then(
            (source) => {
                buildRequest.addError(new StromboliError('err2message', source, 1));
            }
        );
    }
}

class CustomComponent implements ComponentInterface {
    getSource(entry: string): Promise<Source> {
        return Promise.resolve(new Source('foo', 'bar'));
    }
}

tape('JobSequential', (test) => {
    test.test('constructor', (test) => {
        let job = new JobSequential('foo', []);

        test.true(job);

        test.end();
    });

    test.test('run tasks sequentially', (test) => {
        let fooTask = new FooTask('foo');
        let barTask = new FooTask('bar');

        let component = new CustomComponent();

        let value: string = null;
        let flag = false;

        sinon.stub(fooTask, 'run').callsFake(() => {
            return new Promise((resolve) => {
                setTimeout(() => {
                    value = 'foo';

                    resolve();
                }, 100);
            });
        });

        sinon.stub(barTask, 'run').callsFake(() => {
            flag = (value === 'foo');

            return Promise.resolve();
        });


        let request = new BuildRequest(component, null);

        let job = new JobSequential('foo job', [
            fooTask,
            barTask
        ]);

        job.run(request).then(
            () => {
                test.true(flag);

                test.end();
            }
        );

        test.test('this is defined inside "run" function', (test) => {
            let fooTask = new FooTask('foo');

            let flag: boolean = null;

            sinon.stub(fooTask, 'run').callsFake(function () {
                return new Promise((resolve) => {
                    flag = (this === fooTask);

                    resolve();
                });
            });

            let request = new BuildRequest(component, null);

            let job = new JobSequential('foo job', [
                fooTask
            ]);

            job.run(request).then(
                () => {
                    test.true(flag);

                    test.end();
                }
            );
        });
    });

    test.end();
});