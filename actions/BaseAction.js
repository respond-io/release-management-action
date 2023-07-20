class BaseAction {
    execute() {
        throw new Error("Method 'execute()' must be implemented.");
    }
}

module.exports = BaseAction;