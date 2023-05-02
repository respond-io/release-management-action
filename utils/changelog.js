const { promises: fs } = require('fs');

class ChangeLog {
    static async generateChangeLogContent(octokit, owner, repo, github) {
        let currentChangelog = '';

        try {
            const response = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: 'CHANGELOG.md',
            });
            currentChangelog = Buffer.from(response.data.content, 'base64').toString();
        } catch (e) {
            console.log(e)
        }

        return currentChangelog;
    }
}

module.exports = ChangeLog;