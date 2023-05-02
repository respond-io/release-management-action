const { promises: fs } = require('fs');

class ChangeLog {
    static async generateChangeLogContent(octokit, owner, repo, github) {
        let currentChangelog = '';

        try {
            currentChangelog = await fs.readFile('./CHANGELOG.md', 'utf8');
        } catch (e) {
            console.log(e)
        }

        return currentChangelog;
    }
}

module.exports = ChangeLog;