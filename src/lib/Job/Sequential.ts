import {BuildRequest} from "../BuildRequest";
import {Job} from "../Job";

/**
 * Job that runs its tasks sequentially
 */
export class JobSequential extends Job {
    /**
     * @param request
     */
    run(request: BuildRequest): Promise<void> {
        let runFunctions: Function[] = this.tasks.map((task) => {
            return task.run.bind(task);
        });

        return runFunctions.reduce((accumulator, currentValue) => {
            return accumulator.then(() => {
                return currentValue(request);
            });
        }, Promise.resolve());
    }
}