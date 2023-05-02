const get = require('get-value');

class Version {
    static async getNewVersion(octokit, owner, repo, github, isMajorRelease = false) {
        const tags = await octokit.rest.repos.listTags({
            owner,
            repo,
        });
        
        console.log('tags >> ', JSON.stringify(tags.data[0]));
        console.log('tags2 >> ', JSON.stringify(tags.data[0].name));

        const latestTag = get(tags, 'data[0].name', '0.0.0');

        const branch = github.context.payload.pull_request.head.ref;
        const branchPrefix = branch.split('/')[0];

        let [major = 0, minor = 0, patch = 0] = latestTag.replace(/[^0-9\.]/g,'').split('.');

        major = parseInt(major);
        minor = parseInt(minor);
        patch = parseInt(patch);

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

        return newTag;
    }
}

module.exports = Version;