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
        const branch = core.getInput('branch', { required: true });
        let commitLimit = parseInt(core.getInput('commit-limit', { required: false }));

        // If commit limit is not a number, set it to 250 as default
        if (isNaN(commitLimit)) commitLimit = 250;

        console.log('....>>>', commitLimit)
        console.log('....>>>', JSON.stringify(github.event.pull_request))

        const octokit = new github.getOctokit(token);

        // Files need to commit after version update
        const updatedFiles = [];

        console.log('t1', branch)

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

        console.log('t2', branch)

        // If there are tags, use the latest tag as the base
        if (tagsList.length > 0) {
            baseHash = tagsList[0].commit.sha;
            console.log('t3')
        } else {
            console.log('t3.1',owner,repo)
            // If there are no tags, use the oldest commit as the base
            // const { data: previousCommits } = await octokit.rest.repos.listCommits({
            //     owner,
            //     repo,
            //     per_page: 100
            // });

            const previousCommits = await gitHelper.listAllCommits(octokit, owner, repo, branch, commitLimit);

            //console.log('t3.2', allCommits.length)

            //console.log('t4', previousCommits)

            // If there are no commits, exit
            if (previousCommits.length === 0) {
                console.log('ERROR :: No previous commits found');
                process.exit(1);
            }

            console.log('t4.1', previousCommits.length)

            // Max returns 100 commits, assume that the oldest commit is in the last index
            const oldestCommit = previousCommits[previousCommits.length - 1];
            baseHash = oldestCommit.sha;
        }

        console.log('t5', baseHash)

        // If there are no tags and no commits, exit
        if (baseHash === null) {
            console.log('ERROR :: No previous tags found');
            process.exit(1);
        }

        const compare = await octokit.rest.repos.compareCommits({
            owner,
            repo,
            base: baseHash,
            head: branch,
            page: 1
        });
        

        // const compare2 = await octokit.rest.repos.compareCommits({
        //     owner,
        //     repo,
        //     base: baseHash,
        //     head: branch,
        //     page: 2
        // });

        const compare2 = await gitHelper.compareCommits(
            octokit,
            owner,
            repo,
            baseHash,
            branch,
            commitLimit
        );

        console.log('compare length - 0', compare.data.total_commits);
        console.log('compare length - 0.2', compare2.total_commits);
        console.log('compare length - 1', compare.data.commits.length);
        console.log('compare length - 1.2', compare2.commits.length);
        console.log('compare length - 1.2 - files', compare2.files.length);
        console.log('compare length - 2', Object.keys(compare.data));
        console.log('compare length - 3', compare.data.files.length);
        //console.log('compare last', compare.data.files[compare.data.commits.length - 1]);

        process.exit(0);

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