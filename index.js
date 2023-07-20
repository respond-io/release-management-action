const core = require('@actions/core');
const github = require('@actions/github');

const Git = require('./utils/git');
const Config = require('./utils/config');

const ReleaseTaggingAction = require('./actions/ReleaseTaggingAction');
const ReleasePullRequestAction = require('./actions/ReleasePullRequestAction');

const releaseTaggingAction = new ReleaseTaggingAction();
const releasePullRequestAction = new ReleasePullRequestAction();

const main = async () => {
    const gitHelper = new Git();

    try {
        const token = core.getInput('token', { required: true });
        const configPath = core.getInput('config-path', { required: true });
        const action = core.getInput('action', { required: true });
        let timezone = core.getInput('timezone', { required: false });
        let releasePrefix = core.getInput('release-prefix', { required: false });
        let releaseSuffix = core.getInput('release-suffix', { required: false });

        if (timezone === '') {
            timezone = '+0800';
        } else {
            timezone = timezone.replace(/[^0-9\+]/g, '');
        }

        const {
            context: { payload: contextPayload, eventName }
        } = github;

        const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');

        if (eventName !== 'pull_request' || contextPayload.pull_request === undefined || contextPayload.action !== 'closed' || contextPayload.pull_request.merged !== true || contextPayload.pull_request.draft === true) {
            console.log('ERROR :: This action should only be run on a closed pull request that has been merged');
            process.exit(1);
        }

        const branch = contextPayload.pull_request.base.ref;

        const octokit = new github.getOctokit(token);

        // Load configuration file
        await Config.loadConfig(octokit, owner, repo, configPath, contextPayload.pull_request.head.sha);

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

        if (action === 'release-pr') {
            await releasePullRequestAction.execute({
                gitHelper,
                timezone,
                releasePrefix,
                releaseSuffix,
                owner,
                repo,
                branch,
                octokit,
                tagsList
            });
        } else if (action === 'release') {
            await releaseTaggingAction.execute({
                gitHelper,
                contextPayload,
                owner,
                repo,
                branch,
                octokit,
                tagsList
            });
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

main();