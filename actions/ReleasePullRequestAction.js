const core = require('@actions/core');
const github = require('@actions/github');
const moment = require('moment');

const Version = require('../utils/version');
const ChangeLog = require('../utils/fileHelpers/changelog');
const PackageFile = require('../utils/fileHelpers/packageFile');
const BaseAction = require("../BaseAction");

class ReleasePRAction extends BaseAction {
    async execute(options) {
        const {
            gitHelper,
            timezone, //1
            releasePrefix, //1
            releaseSuffix, //1
            owner,
            repo,
            branch,
            octokit,
            tagsList
        } = options;

        // Files need to commit after version update
        const updatedFiles = [];

        let baseHash = null;

        // If there are tags, use the latest tag as the base
        if (tagsList.length > 0) {
            baseHash = tagsList[0].commit.sha;
        } else {
            const previousCommits = await gitHelper.listAllCommits(octokit, owner, repo, branch);

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
            branch
        );

        console.log(JSON.stringify(compare.files));

        const commitsDiff = gitHelper.filterCommits(compare.commits, branch);
        const changedFilesList = gitHelper.filterFiles(compare.files);

        const {
            newVersionNumber,
            newVersion,
            currentVersion
        } = await Version.getVersions(octokit, owner, repo, github, releasePrefix, releaseSuffix);

        const changelogDataSet = {
            version: newVersion,
            previous_version: currentVersion,
            org: owner,
            repo,
            date: moment().utcOffset(timezone).format('YYYY-MM-DD'),
            ...commitsDiff,
            affected_areas: changedFilesList
        };

        const { newChangeLogContent, fullChangeLogContent } = await ChangeLog.generateChangeLogContent(octokit, owner, repo, changelogDataSet);
        const changeLogPath = await ChangeLog.updateChangeLog(fullChangeLogContent);
        updatedFiles.push(changeLogPath);

        const ROOT_LEVEL_PACKAGE_FILE_PATH = 'package.json';
        const rootPackageFileContent = await PackageFile.generatePackageFileContent(octokit, owner, repo, ROOT_LEVEL_PACKAGE_FILE_PATH, newVersionNumber);
        if (rootPackageFileContent !== null) {
            await PackageFile.updatePackageFile(rootPackageFileContent, ROOT_LEVEL_PACKAGE_FILE_PATH);
            updatedFiles.push(ROOT_LEVEL_PACKAGE_FILE_PATH);
        }

        for (const { type, subProjectRoot } of changedFilesList) {
            if (type === 'Lambda' || type === 'ECS') {
                const packageFilePath = `${subProjectRoot}/package.json`;
                const packageFileContent = await PackageFile.generatePackageFileContent(octokit, owner, repo, packageFilePath, newVersionNumber);
                if (packageFileContent !== null) {
                    await PackageFile.updatePackageFile(packageFileContent, packageFilePath);
                    updatedFiles.push(packageFilePath);
                }
            }
        }

        // Create release branch name
        const releaseBranch = gitHelper.generateReleaseBranchName(newVersion);

        // Create new branch in repo
        await gitHelper.createBranch(octokit, owner, repo, releaseBranch, branch);

        // Commit changes to new branch
        const newCommitSha = await gitHelper.uploadToRepo(octokit, updatedFiles, owner, repo, releaseBranch, newVersion, branch);

        const pullRequestTitle = gitHelper.createPullRequestTitle(branch, newVersionNumber);

        // Create Pull request to `branch`
        await gitHelper.createPullRequest(octokit, owner, repo, releaseBranch, pullRequestTitle, newChangeLogContent, branch);

        // await octokit.rest.git.createTag({
        //     owner,
        //     repo,
        //     tag: newVersion,
        //     message: `Release ${newVersion}`,
        //     object: newCommitSha,
        //     type: 'commit'
        // });

        // await octokit.rest.git.createRef({
        //     owner,
        //     repo,
        //     ref: `refs/tags/${newVersion}`,
        //     sha: newCommitSha,
        // });

        // await octokit.rest.repos.createRelease({
        //     owner,
        //     repo,
        //     tag_name: newVersion,
        //     name: newVersion,
        //     body: newChangeLogContent,
        //     draft: false,
        //     prerelease: false
        // });

        core.setOutput('version', newVersion);
        core.setOutput('version-number', newVersionNumber);
        core.setOutput('release-branch', releaseBranch);
        core.setOutput('release-branch-sha', newCommitSha);
        core.setOutput('release-content', newChangeLogContent)
    }
}

module.exports = ReleasePRAction;