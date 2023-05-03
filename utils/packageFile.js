const { promises: fs } = require('fs');
const { mkdirp } = require('mkdirp');
const path = require("path")

class PackageFile {
    static async generatePackageFileContent(octokit, owner, repo, path, version) {
        try {
            const response = await octokit.rest.repos.getContent({
                owner,
                repo,
                path
            });
    
            let currentPackageFileContent = JSON.parse(Buffer.from(response.data.content, 'base64').toString());
    
            currentPackageFileContent.version = version;
    
            return JSON.stringify(currentPackageFileContent, null, 2);
        } catch (error) {
            // Unable to find or process the package.json file
            return null;
        }
    }

    static async updatePackageFile(content, path) {
        await mkdirp(path.parse(path).dir);
        await fs.writeFile(path, content);
        return path;
    }
}

module.exports = PackageFile;