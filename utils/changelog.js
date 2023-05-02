const { promises: fs } = require('fs');
const Handlebars = require('handlebars');

class ChangeLog {
    static async generateChangeLogContent(octokit, owner, repo, github) {
        let currentChangelog = '';

        try {
            const response = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: 'CHANGELOG.md',
            });
            currentChangelog = Buffer.from(response.data.content, 'base64').toString();
        } catch (e) {}

        const templateSource = await fs.readFile('./templates/CHANGELOG.md.hbs', 'utf8');
        const template = Handlebars.compile(templateSource);

        const data = {
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

        return `
            ${template(data)}
            ${currentChangelog}
        `;
    }
}

module.exports = ChangeLog;