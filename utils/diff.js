const diff = require('diff');

class Diff {
    static findNewlyAddedString(oldString, newString) {
        const diffResult = diff.diffLines(oldString, newString);
        let addedString = '';

        for (const part of diffResult) {
            if (part.added) {
                addedString += part.value;
            }
        }

        return addedString;
    }
}

module.exports = Diff;