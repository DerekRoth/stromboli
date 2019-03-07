import {BuildRequest} from "./BuildRequest";

/**
 * Base implementation of a task
 */
export abstract class Task {
    private readonly _description: string;

    /**
     * @param {string} description
     */
    constructor(description: string) {
        this._description = description;
    }

    /**
     * Returns the description of the task.
     */
    get description(): string {
        return this._description;
    }

    /**
     * @param {BuildRequest} request
     * @return {Promise<void>}
     */
    abstract run(request: BuildRequest): Promise<void>;
}