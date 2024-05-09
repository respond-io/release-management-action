const core = require('@actions/core');
const ChangeLog = require('../utils/fileHelpers/changelog');
const Diff = require('../utils/diff');
const BaseAction = require("./BaseAction");
const Version = require('../utils/version');

class ReleaseTaggingAction extends BaseAction {
    async execute(options) {
        const {
            gitHelper,
            contextPayload,
            releasePrefix,
            owner,
            repo,
            branch,
            octokit,
            tagsList
        } = options;

        const prRef = `pull/${contextPayload.pull_request.number}/head`;

        // Get update CHANGELOG.md content
        const changeLog = await gitHelper.fetchFileContent(octokit, owner, repo, 'CHANGELOG.md', prRef);

        let newChangeLogContent = changeLog;

        if (tagsList.length > 0) {
            const lastTaggedHash = tagsList[0].commit.sha;
            const previousChangeLog = await gitHelper.fetchFileContent(octokit, owner, repo, 'CHANGELOG.md', lastTaggedHash);

            if (previousChangeLog !== '') {
                newChangeLogContent = Diff.findNewlyAddedString(previousChangeLog, changeLog);
            }
        }

        const fullVersion = ChangeLog.extractLatestVersion(newChangeLogContent);
        let version = Version.removePrefix(fullVersion, releasePrefix);

        if (version === '') {
            // Get update package.json content
            const packageJson = await gitHelper.fetchFileContent(octokit, owner, repo, 'package.json', prRef);

            if (packageJson !== '') {
                const packageJsonObj = JSON.parse(packageJson);
                version = packageJsonObj.version || '';
            }
        }

        if (version === '') {
            console.log('ERROR :: Unable to extract the latest version.');
            process.exit(1);
        }

        const { data: branchInfo } = await octokit.rest.git.getRef({
            owner,
            repo,
            ref: `heads/${branch}`,
        });

        const newCommitSha = branchInfo.object.sha;

        const newVersion = `${releasePrefix}${version}`;

        await octokit.rest.git.createTag({
            owner,
            repo,
            tag: newVersion,
            message: `Release ${newVersion}`,
            object: newCommitSha,
            type: 'commit'
        });

        await octokit.rest.git.createRef({
            owner,
            repo,
            ref: `refs/tags/${newVersion}`,
            sha: newCommitSha,
        });

        await octokit.rest.repos.createRelease({
            owner,
            repo,
            tag_name: newVersion,
            name: newVersion,
            body: newChangeLogContent,
            draft: false,
            prerelease: false
        });

        core.setOutput('release-tagged', true);
        core.setOutput('release-version', newVersion);
        core.setOutput('release-version-number', version);
    }
}

module.exports = ReleaseTaggingAction;