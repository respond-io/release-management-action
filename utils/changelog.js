const { promises: fs } = require('fs');
const Handlebars = require('handlebars');

const CHANGELOG_TEMPLATE = require('../templates/CHANGELOG.md.js');

class ChangeLog {
    static async generateChangeLogContent(octokit, owner, repo, data) {
        let currentChangelog = '';

        try {
            const response = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: 'CHANGELOG.md',
            });
            currentChangelog = Buffer.from(response.data.content, 'base64').toString();
        } catch (e) {}

        const template = Handlebars.compile(CHANGELOG_TEMPLATE);

        return `
            ${template(data)}
            ${currentChangelog}
        `;
    }
}

module.exports = ChangeLog;