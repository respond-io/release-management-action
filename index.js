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

        const owner = core.getInput('owner', { required: true });
        const repo = core.getInput('repo', { required: true });
        const token = core.getInput('token', { required: true });

        const octokit = new github.getOctokit(token);

        // Files need to commit after version update
        const updatedFiles = [];

        const tagsList = await octokit.rest.repos.listTags({
            owner,
            repo,
        });

        const baseHash = tagsList.data[0].commit.sha;

        const compare = await octokit.rest.repos.compareCommits({
            owner,
            repo,
            base: baseHash,
            head: 'main'
        });

        const commitsDiff = gitHelper.filterCommits(compare.data.commits);
        const changedFilesList = gitHelper.filterFiles(compare.data.files);

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
            affected_areas: changedFilesList
        };

        const { newChangeLogContent, fullChangeLogContent } = await ChangeLog.generateChangeLogContent(octokit, owner, repo, changelogDataSet);
        const changeLogPath = await ChangeLog.updateChangeLog(fullChangeLogContent);
        updatedFiles.push(changeLogPath);

        const ROOT_LEVEL_PACKAGE_FILE_PATH = 'package.json';
        const rootPackageFileContent = await PackageFile.generatePackageFileContent(octokit, owner, repo, ROOT_LEVEL_PACKAGE_FILE_PATH, newVersion);
        await PackageFile.updatePackageFile(rootPackageFileContent, ROOT_LEVEL_PACKAGE_FILE_PATH);
        updatedFiles.push(ROOT_LEVEL_PACKAGE_FILE_PATH);

        console.log('changedFilesList>>', changedFilesList);

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

        console.log('updatedFiles>>>>', updatedFiles)

        const newCommitSha = await gitHelper.uploadToRepo(octokit, updatedFiles, owner, repo, 'main', newVersion);

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
        //     name: `Release ${newVersion}`,
        //     body: newChangeLogContent,
        //     draft: false,
        //     prerelease: false
        // });

    } catch (error) {
        core.setFailed(error.message);
    }
}

main();