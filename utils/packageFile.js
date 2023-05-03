const { promises: fs } = require('fs');
const Handlebars = require('handlebars');

const CHANGELOG_TEMPLATE = require('../templates/CHANGELOG.md.js');

const CHANGELOG_PATH = 'CHANGELOG.md';

class PackageFile {
    static async generatePackageFileContent(octokit, owner, repo, path, version) {
        const response = await octokit.rest.repos.getContent({
            owner,
            repo,
            path
        });

        let currentPackageFileContent = JSON.parse(Buffer.from(response.data.content, 'base64').toString());

        currentPackageFileContent.version = version;

        return JSON.stringify(currentPackageFileContent, null, 2);
    }

    static async updatePackageFile(content, path) {
        await fs.writeFile(path, content);
        return path;
    }
}

module.exports = PackageFile;