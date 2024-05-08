const get = require('lodash.get');

class Version {
    static async getVersions(octokit, owner, repo, github, tagPrefix = 'v', tagSuffix = '', isMajorRelease = false) {
        const tags = await octokit.rest.repos.listTags({
            owner,
            repo,
        });

        let latestTag = get(tags, 'data[0].name') || '';

        const branch = github.context.payload.pull_request.head.ref;
        const branchPrefix = branch.split('/')[0];

        let [major = 0, minor = 0, patch = 0] = latestTag.split('-')[0].replace(/[^0-9\.]/g, '').split('.');

        major = parseInt(major);
        minor = parseInt(minor);
        patch = parseInt(patch);

        major = isNaN(major) ? 0 : major;
        minor = isNaN(minor) ? 0 : minor;
        patch = isNaN(patch) ? 0 : patch;

        if (major === 0 && minor === 0 && patch === 0) {
            latestTag = '0.0.0';
        }

        let newTag = `${major}.${minor}.${patch}`;

        if (isMajorRelease) {
            newTag = `${major + 1}.0.0`;
        } else {
            if (branchPrefix === 'flight') {
                newTag = `${major}.${minor + 1}.0`;
            } else if (branchPrefix === 'hotfix') {
                newTag = `${major}.${minor}.${patch + 1}`;
            }
        }

        return {
            newVersionNumber: `${newTag}${tagSuffix}`,
            newVersion: `${tagPrefix}${newTag}${tagSuffix}`,
            currentVersion: latestTag,
        };
    }

    static removePrefix(text, prefix) {
        if (text.startsWith(prefix)) {
            return text.slice(prefix.length);
        }
        return text;
    }
}

module.exports = Version;