const core = require('@actions/core');
const github = require('@actions/github');
const Version = require('./utils/version');
const ChangeLog = require('./utils/fileHelpers/changelog');
const PackageFile = require('./utils/fileHelpers/packageFile');
const Git = require('./utils/git');
const moment = require('moment');

const main = async () => {
    const gitHelper = new Git();
    try {
        const token = core.getInput('token', { required: true });
        let commitLimit = parseInt(core.getInput('commit-limit', { required: false }));

        // If commit limit is not a number, set it to 250 as default
        if (isNaN(commitLimit)) commitLimit = 250;

        const { 
            context: { payload: contextPayload, eventName }
        } = github;

        console.log('....', JSON.stringify(contextPayload));

        const [ owner, repo ] = process.env.GITHUB_REPOSITORY.split('/');

        if (eventName !== 'pull_request' || contextPayload.pull_request === undefined || contextPayload.action !== 'closed' || contextPayload.pull_request.merged !== true || contextPayload.pull_request.draft === true) {
            console.log('ERROR :: This action should only be run on a closed pull request that has been merged');
            process.exit(1);
        }

        const branch = contextPayload.pull_request.base.ref;

        const octokit = new github.getOctokit(token);

        // Files need to commit after version update
        const updatedFiles = [];

        let tagsList;
        
        try {
            const tagsListData = await octokit.rest.repos.listTags({
                owner,
                repo,
            });
            tagsList = tagsListData.data;
        } catch (error) {
            tagsList = [];
        }

        let baseHash = null;

        // If there are tags, use the latest tag as the base
        if (tagsList.length > 0) {
            baseHash = tagsList[0].commit.sha;
        } else {
            const previousCommits = await gitHelper.listAllCommits(octokit, owner, repo, branch, commitLimit);

            // If there are no commits, exit
            if (previousCommits.length === 0) {
                console.log('ERROR :: No previous commits found');
                process.exit(1);
            }

            // Max returns 100 commits, assume that the oldest commit is in the last index
            const oldestCommit = previousCommits[previousCommits.length - 1];
            baseHash = oldestCommit.sha;
        }

        // If there are no tags and no commits, exit
        if (baseHash === null) {
            console.log('ERROR :: No previous tags found');
            process.exit(1);
        }

        const compare = await gitHelper.compareCommits(
            octokit,
            owner,
            repo,
            baseHash,
            branch,
            commitLimit
        );

        const commitLimitReached = compare.commits.length === commitLimit - 1;

        const commitsDiff = gitHelper.filterCommits(compare.commits);
        const changedFilesList = gitHelper.filterFiles(compare.files);

        const {
            newVersion,
            currentVersion
        } = await Version.getVersions(octokit, owner, repo, github);

        const changelogDataSet = {
            version: newVersion,
            previous_version: currentVersion,
            org: owner,
            repo,
            date: moment().utcOffset('+0800').format('YYYY-MM-DD'),
            ...commitsDiff,
            affected_areas: changedFilesList,
            commitLimitReached
        };

        const { newChangeLogContent, fullChangeLogContent } = await ChangeLog.generateChangeLogContent(octokit, owner, repo, changelogDataSet);
        const changeLogPath = await ChangeLog.updateChangeLog(fullChangeLogContent);
        updatedFiles.push(changeLogPath);

        const ROOT_LEVEL_PACKAGE_FILE_PATH = 'package.json';
        const rootPackageFileContent = await PackageFile.generatePackageFileContent(octokit, owner, repo, ROOT_LEVEL_PACKAGE_FILE_PATH, newVersion);
        if (rootPackageFileContent !== null) {
            await PackageFile.updatePackageFile(rootPackageFileContent, ROOT_LEVEL_PACKAGE_FILE_PATH);
            updatedFiles.push(ROOT_LEVEL_PACKAGE_FILE_PATH);
        }

        for (const { type, subProjectRoot } of changedFilesList) {
            if (type === 'Lambda' || type === 'ECS') {
                const packageFilePath = `${subProjectRoot}/package.json`;
                const packageFileContent = await PackageFile.generatePackageFileContent(octokit, owner, repo, packageFilePath, newVersion);
                if (packageFileContent !== null) {
                    await PackageFile.updatePackageFile(packageFileContent, packageFilePath);
                    updatedFiles.push(packageFilePath);
                }
            }
        }

        const newCommitSha = await gitHelper.uploadToRepo(octokit, updatedFiles, owner, repo, branch, newVersion);

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
            name: `Release ${newVersion}`,
            body: newChangeLogContent,
            draft: false,
            prerelease: false
        });

    } catch (error) {
        core.setFailed(error.message);
    }
}

main();