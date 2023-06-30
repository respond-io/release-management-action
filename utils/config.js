import * as yaml from 'js-yaml';
import Git from './git';

class Config {
    static async loadConfig(octokit, org, repo, configPath, commitSha) {
        const gitHelper = new Git();
        try {
            const configurationContent = gitHelper.fetchFileContent(octokit, org, repo, configPath, commitSha);
            const configObject = yaml.load(configurationContent);
            console.log('.........', JSON.stringify(configObject, null, 2));
            global.ActionConfigs = configObject;
            return configObject;
        } catch (error) {
            console.log('ERROR :: Unable to load configuration file');
            process.exit(1);
        }
    }
}

module.exports = Config;