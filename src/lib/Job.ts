import {Task} from "./Task";

/**
 * Base implementation of a Job
 */
export abstract class Job extends Task {
    private readonly _tasks: Task[];

    /**
     * @param {string} description
     * @param {Task[]} tasks
     */
    constructor(description: string, tasks: Task[]) {
        super(description);

        this._tasks = tasks;
    }

    /**
     * Returns the tasks of the job.
     */
    get tasks(): Task[] {
        return this._tasks;
    }
}