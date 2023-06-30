const path = require('path')
const { readFile } = require('fs-extra');
const capitalize = require('lodash.capitalize');
const Crypto = require('./crypto');

const COMMIT_MESSAGE_PREFIX = 'Auto generated - New Release';

class Git {
    async uploadToRepo(octokit, filesPaths, org, repo, branch, version) {
        // gets commit's AND its tree's SHA
        const currentCommit = await this._getCurrentCommit(octokit, org, repo, branch)
        //const filesPaths = await glob(coursePath)
        const filesBlobs = await Promise.all(filesPaths.map(this._createBlobForFile(octokit, org, repo)))
        const pathsForBlobs = filesPaths.map(fullPath => path.relative('./', fullPath))
        const newTree = await this._createNewTree(
            octokit,
            org,
            repo,
            filesBlobs,
            pathsForBlobs,
            currentCommit.treeSha
        )
        const newCommit = await this._createNewCommit(
            octokit,
            org,
            repo,
            `${COMMIT_MESSAGE_PREFIX} (${version})`,
            newTree.sha,
            currentCommit.commitSha
        );

        await this._setBranchToCommit(octokit, org, repo, branch, newCommit.sha);

        return newCommit.sha;
    }

    async _getCurrentCommit(octokit, org, repo, branch) {
        const { data: refData } = await octokit.rest.git.getRef({
            owner: org,
            repo,
            ref: `heads/${branch}`,
        });

        const commitSha = refData.object.sha
        const { data: commitData } = await octokit.rest.git.getCommit({
            owner: org,
            repo,
            commit_sha: commitSha,
        });

        return {
            commitSha,
            treeSha: commitData.tree.sha,
        };
    }

    // Notice that readFile's utf8 is typed differently from Github's utf-8
    _getFileAsUTF8(filePath) {
        return readFile(filePath, 'utf8');
    }

    _createBlobForFile(octokit, org, repo) {
        return async (filePath) => {
            const content = await this._getFileAsUTF8(filePath)
            const blobData = await octokit.rest.git.createBlob({
                owner: org,
                repo,
                content,
                encoding: 'utf-8',
            })
            return blobData.data
        };
    }

    async _createNewTree(octokit, owner, repo, blobs, paths, parentTreeSha) {
        // My custom config. Could be taken as parameters
        const tree = blobs.map(({ sha }, index) => ({
            path: paths[index],
            mode: `100644`,
            type: `blob`,
            sha,
        }));

        const { data } = await octokit.rest.git.createTree({
            owner,
            repo,
            tree,
            base_tree: parentTreeSha,
        });

        return data;
    }

    async _createNewCommit(octokit, org, repo, message, currentTreeSha, currentCommitSha) {
        const { data } = await octokit.rest.git.createCommit({
            owner: org,
            repo,
            message,
            tree: currentTreeSha,
            parents: [currentCommitSha],
        })
        return data;
    }

    _setBranchToCommit(octokit, org, repo, branch, commitSha) {
        return octokit.rest.git.updateRef({
            owner: org,
            repo,
            ref: `heads/${branch}`,
            sha: commitSha,
        })
    }

    async fetchFileContent(octokit, org, repo, repoPath, commitSha) {
        const response = await octokit.rest.repos.getContent({
            owner: org,
            repo,
            path: repoPath,
            ref: commitSha
        });

        return Buffer.from(response.data.content, response.data.encoding).toString();
    }

    filterCommits(commits) {
        const features = [];
        const bug_fixes = [];
        const other_commits = [];

        commits.reverse().forEach((commitData) => {
            let { message } = commitData.commit;

            if (!message.startsWith('Merge pull request') && !message.startsWith('Merge branch') && !message.startsWith('Auto generated')) {
                const splits = message.split(':');

                const commit = {
                    commit_name: message,
                    commit_hash: commitData.sha,
                    compact_commit_hash: commitData.sha.substring(0, 7),
                };

                if (splits.length > 1) {
                    const type = splits[0].trim().toLowerCase();
                    splits.shift();
                    commit.commit_name = capitalize(splits.join(' ').trim());
                    switch (type) {
                        case 'feat':
                            features.push(commit);
                            break;
                        case 'fix':
                            bug_fixes.push(commit);
                            break;
                        default:
                            other_commits.push(commit);
                            break;
                    }
                } else {
                    other_commits.push(commit);
                }
            }

        });

        return { features, bug_fixes, other_commits };
    };

    filterFiles(files) {
        console.log('.... Inside: filterFiles .....', JSON.stringify(global.ActionConfigs, null, 2));

        let basePaths = [];
        Object.keys(global.ActionConfigs.paths).forEach((key) => {
            basePaths = basePaths.concat(global.ActionConfigs.paths[key].map((path) => { return { ...path, type: key } }));
        });
        
        console.log('.... Inside: basePaths .....', JSON.stringify(basePaths, null, 2));

        const fileSetHashMap = new Set();
        const fileList = [];

        let visible = true;

        files.forEach((file) => {
            const { filename } = file;
            let entity = filename;
            let type = 'Other';
            let subProjectRoot = null;

            basePaths.forEach((basePath) => {
                if (filename.startsWith(basePath.path)) {
                    entity = capitalize(basePath.name);
                    type = 'Lambda';
                    subProjectRoot = basePath.path;

                    if (basePath.type === 'lambda') {
                        const pathSuffix = filename.replace(`${basePath.path}/`, '');
                        const pathSuffixSplits = pathSuffix.split('/');
                        const folderType = pathSuffixSplits[0];

                        if (folderType !== undefined) {
                            const folderTypeName = folderType.trim().toLowerCase();
        
                            if (folderTypeName === 'functions' || folderTypeName === 'layers') {
                                const subEntity = pathSuffixSplits[1];
                                subProjectRoot = `${subProjectRoot}/${folderType}/${subEntity}`;
                                visible = false;
        
                                if (folderTypeName === 'layers') subProjectRoot = `${subProjectRoot}/nodejs/node_modules/${subEntity}`;
        
                                // If only layer or function is changed, need to update root level package.json also
                                const entityHash = Crypto.generateHash(`${basePath.path}-${type}`);
                                if (!fileSetHashMap.has(entityHash)) {
                                    fileSetHashMap.add(entityHash);
                                    fileList.push({ entity, type, subProjectRoot: basePath.path, visible: true });
                                }
                            }
                        }
                    } else if (basePath.type === 'ecs') {
                        type = 'ECS';
                    } else if (basePath.type === 'infrastructure') {
                        type = 'Infrastructure';
                    }
                }
            });

            const entityHash = Crypto.generateHash(`${subProjectRoot}-${type}`);
            if (!fileSetHashMap.has(entityHash)) {
                fileSetHashMap.add(entityHash);
                fileList.push({ entity, type, subProjectRoot, visible });
            }
        });

        console.log('.... Inside: fileList .....', JSON.stringify(fileList, null, 2));

        return fileList.sort();
    };

    async getFoldersInGivenPath(octokit, owner, repo, basePath) {
        let response = [];

        try {
            response = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: basePath,
            });
        } catch (error) { }

        // Filter the response to only include folder objects
        return response.data.filter((item) => item.type === "dir");
    };

    async listAllCommits(octokit, owner, repo, branch, maxCommitCount, index = 1, commits = []) {
        const PAGE_SIZE = 100;

        try {
            const { data } = await octokit.rest.repos.listCommits({
                owner,
                repo,
                sha: branch,
                per_page: PAGE_SIZE,
                page: index,
            });

            commits = commits.concat(data);

            // If maxCommitCount is set, return the first maxCommitCount commits
            if (maxCommitCount !== undefined && commits.length >= maxCommitCount) {
                return commits.slice(0, maxCommitCount);
            }

            // If the response contains 100 commits, there might be more commits
            if (data.length === PAGE_SIZE) {
                return this.listAllCommits(octokit, owner, repo, branch, maxCommitCount, index + 1, commits);
            }

            return commits;
        } catch (error) {
            console.log(error);
            // If the branch does not exist, return an empty array or existing commits
            return commits;
        }
    }

    async compareCommits(octokit, owner, repo, base, head, maxCommitCount, index = 1, compareCommits = { commits: [], files: [], total_commits: 0 }) {
        const PAGE_SIZE = 250;

        try {
            const { data: { commits, files } } = await octokit.rest.repos.compareCommits({
                owner,
                repo,
                base,
                head,
                page: index
            });

            compareCommits.commits = compareCommits.commits.concat(commits);
            compareCommits.files = compareCommits.files.concat(files);
            compareCommits.total_commits = compareCommits.total_commits + commits.length;

            // If maxCommitCount is set, return the first maxCommitCount commits
            if (maxCommitCount !== undefined && compareCommits.commits.length >= maxCommitCount) {
                compareCommits.commits = compareCommits.commits.slice(0, maxCommitCount);
                return compareCommits;
            }

            // If the response contains 100 commits, there might be more commits
            if (commits.length === PAGE_SIZE) {
                return this.compareCommits(octokit, owner, repo, base, head, maxCommitCount, index + 1, compareCommits);
            }

            return compareCommits;
        } catch (error) {
            console.log(error);
            // If the branch does not exist, return an empty array or existing commits
            return compareCommits;
        }
    }

}

module.exports = Git;