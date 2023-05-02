const core = require('@actions/core');
const github = require('@actions/github');
const { uploadToRepo, filterCommits, filterFiles } = require('./utils/commits');
const Version = require('./utils/version');
const ChangeLog = require('./utils/changelog');
const { promises: fs } = require('fs');

const main = async () => {
    try {
        /**
         * We need to fetch all the inputs that were provided to our action
         * and store them in variables for us to use.
         **/
        const owner = core.getInput('owner', { required: true });
        const repo = core.getInput('repo', { required: true });
        const pr_number = core.getInput('pr_number', { required: true });
        const token = core.getInput('token', { required: true });

        /**
         * Now we need to create an instance of Octokit which will use to call
         * GitHub's REST API endpoints.
         * We will pass the token as an argument to the constructor. This token
         * will be used to authenticate our requests.
         * You can find all the information about how to use Octokit here:
         * https://octokit.github.io/rest.js/v18
         **/
        const octokit = new github.getOctokit(token);

        /**
         * We need to fetch the list of files that were changes in the Pull Request
         * and store them in a variable.
         * We use octokit.paginate() to automatically loop over all the pages of the
         * results.
         * Reference: https://octokit.github.io/rest.js/v18#pulls-list-files
         */

        const changedFiles = [];

        // const { data: changedFiles } = await octokit.rest.pulls.listFiles({
        //     owner,
        //     repo,
        //     pull_number: pr_number,
        // });


        /**
         * Contains the sum of all the additions, deletions, and changes
         * in all the files in the Pull Request.
         **/
        let diffData = {
            additions: 0,
            deletions: 0,
            changes: 0
        };

        // Reference for how to use Array.reduce():
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce
        diffData = changedFiles.reduce((acc, file) => {
            acc.additions += file.additions;
            acc.deletions += file.deletions;
            acc.changes += file.changes;
            return acc;
        }, diffData);

        /**
         * Loop over all the files changed in the PR and add labels according 
         * to files types.
         **/
        for (const file of changedFiles) {
            /**
             * Add labels according to file types.
             */
            const fileExtension = file.filename.split('.').pop();
            switch (fileExtension) {
                case 'md':
                    await octokit.rest.issues.addLabels({
                        owner,
                        repo,
                        issue_number: pr_number,
                        labels: ['markdown'],
                    });
                case 'js':
                    await octokit.rest.issues.addLabels({
                        owner,
                        repo,
                        issue_number: pr_number,
                        labels: ['javascript'],
                    });
                case 'yml':
                    await octokit.rest.issues.addLabels({
                        owner,
                        repo,
                        issue_number: pr_number,
                        labels: ['yaml'],
                    });
                case 'yaml':
                    await octokit.rest.issues.addLabels({
                        owner,
                        repo,
                        issue_number: pr_number,
                        labels: ['yaml'],
                    });
            }
        }

        const releasesList = await octokit.rest.repos.listReleases({
            owner,
            repo
        });

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

        console.log('commits...>>', JSON.stringify(filterCommits(compare.data.commits)));
        console.log('files...>>', JSON.stringify(filterFiles(compare.data.files)));




        


        /**
         * Create a comment on the PR with the information we compiled from the
         * list of changed files.
         */
    //     await octokit.rest.issues.createComment({
    //         owner,
    //         repo,
    //         issue_number: pr_number,
    //         body: `
    //     Pull Request #${pr_number} has been updated with: \n
    //     - ${diffData.changes} changes \n
    //     - ${diffData.additions} additions \n
    //     - ${diffData.deletions} deletions \n
    //     -- releasesList -- ${JSON.stringify(releasesList.data)} \n
    //     -- tagsList -- ${JSON.stringify(tagsList.data)} \n
    //     -- compare -- ${JSON.stringify(compare.data)} \n
    //     -- cotext -- ${JSON.stringify(github.context)} \n
    //   `
    //     });

        const { eventName } = github.context;

        //console.log('github.context >> ', JSON.stringify(github.context));

        await fs.writeFile('github-context.json', JSON.stringify(github.context));
        const filesPaths = ['github-context.json'];

        try {
            
            console.log('New Version >>', newVersion);
        } catch (error) {
            console.log('error >> ', error);
        }

        const changelogDataSet = {
            "version": "3.2.0",
            "previous_version": "1.3.0",
            "org": "respond-io",
            "repo": "utils-pkg",
            "date": "2023-04-18",
            "body": "This is my first post!",
            "features": [{
                "commit_name": "add support for formatting whatsapp cIDs",
                "commit_hash": "f572ca42583fad58547ea34d93d55f703bcc0be4",
                "compact_commit_hash": "f572ca4"
            }, {
                "commit_name": "added isUpdatabled function for backward compability",
                "commit_hash": "825eee4b609b5db56b981d16aca27fb70d7211d9",
                "compact_commit_hash": "825eee4"
            }],
            "bug_fixes": [{
                "commit_name": "add missing space",
                "commit_hash": "0dc2eaf21c49a684d99b4e3115040e4c5b9f2d7a",
                "compact_commit_hash": "0dc2eaf"
            }, {
                "commit_name": "added more checks on whatsapp cId for various countries",
                "commit_hash": "04c52d37d8446d07eb37b70a8703b4a66828a3f0",
                "compact_commit_hash": "04c52d3"
            }],
            "other_commits": [{
                "commit_name": "add missing space",
                "commit_hash": "0dc2eaf21c49a684d99b4e3115040e4c5b9f2d7a",
                "compact_commit_hash": "0dc2eaf"
            }, {
                "commit_name": "added more checks on whatsapp cId for various countries",
                "commit_hash": "04c52d37d8446d07eb37b70a8703b4a66828a3f0",
                "compact_commit_hash": "04c52d3"
            }],
            "affected_areas": [{
                    "entity": "messaging",
                    "type": "ECS"
                },
                {
                    "entity": "billing",
                    "type": "Lambda"
                },
                {
                    "entity": "infra/cloudformation/infrastructure/13-ses-email-pipeline.yml",
                    "type": "Infrastructure"
                }
            ]
        };

        const changeLog = await ChangeLog.generateChangeLogContent(octokit, owner, repo, changelogDataSet);
        console.log('changeLog >> ', changeLog);

        // if ( eventName === 'push') {
        //     console.log('safe to exit');
        //     process.exit(0);
        // } else {
        //     console.log('not safe to exit');
        //     process.exit(1);
        // }

        // Filed for testing purposes :D
        process.exit(1);

    } catch (error) {
        core.setFailed(error.message);
    }
}

// Call the main function to run the action
main();