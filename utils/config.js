const yaml = require('js-yaml');
const Git = require('./git');

class Config {
    static async loadConfig(octokit, org, repo, configPath, commitSha) {
        const gitHelper = new Git();
        try {
            const configurationContent = await gitHelper.fetchFileContent(octokit, org, repo, configPath, commitSha);
            const configObject = yaml.load(configurationContent);
            global.ActionConfigs = configObject;
            return configObject;
        } catch (error) {
            console.log('ERROR :: Unable to load configuration file');
            process.exit(1);
        }
    }
}

module.exports = Config;