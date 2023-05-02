
class Version {
    static async getNewVersion(octokit, owner, repo, github, isMajorRelease = false) {
        const { data: [ latestTag = '' ] } = await octokit.rest.repos.listTags({
            owner,
            repo,
        });

        const branch = github.context.payload.pull_request.head.ref;
        const branchPrefix = branch.split('/')[0];

        const [major = 0, minor = 0, patch = 0] = latestTag.replace(/[^0-9\.]/g,'').split('.');

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