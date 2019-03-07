import {BuildRequest} from "../BuildRequest";
import {Job} from "../Job";

/**
 * Job that runs its tasks concurrently
 */
export class JobConcurrent extends Job {
    /**
     * @param request
     */
    run(request: BuildRequest): Promise<void> {
        let promises = this.tasks.map((task) => {
            return task.run(request);
        });

        return Promise.all(promises).then(
            () => {
                return;
            }
        );
    }
}