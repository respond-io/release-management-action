const { promises: fs } = require('fs');
const Handlebars = require('handlebars');

const CHANGELOG_TEMPLATE = require('../../templates/CHANGELOG.md.js');

const CHANGELOG_PATH = 'CHANGELOG.md';

class ChangeLog {
    static async generateChangeLogContent(octokit, owner, repo, data) {
        let currentChangelog = '';

        try {
            const response = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: CHANGELOG_PATH,
            });
            currentChangelog = Buffer.from(response.data.content, 'base64').toString();
        } catch (e) { }

        const template = Handlebars.compile(CHANGELOG_TEMPLATE);

        const newChangeLogContent = template(data);
        const fullChangeLogContent = `
            ${newChangeLogContent}
            ${currentChangelog}
        `;

        return { newChangeLogContent, fullChangeLogContent };
    }

    static async updateChangeLog(content) {
        await fs.writeFile(CHANGELOG_PATH, content);
        return CHANGELOG_PATH
    }

    static extractLatestVersion(content) {
        // Regular expression to extract version inside square brackets after "<!--- EOR"
        const versionRegex = /<!--- EOR\(End Of Release : \[([^\]]+)\]\)/;

        // Extract the version from the text content
        const match = content.match(versionRegex);

        // Check if a match is found and extract the version
        let version = '';
        if (match && match.length > 1) {
            version = match[1];
        }

        return version;
    }
}

module.exports = ChangeLog;