const path = require('path')
const { readFile } = require('fs-extra');
const capitalize = require('lodash.capitalize');
const Crypto = require('./crypto');

const COMMIT_MESSAGE_PREFIX = 'Auto generated - New Release';

const uploadToRepo = async (octo, filesPaths, org, repo, branch, version) => {
    // gets commit's AND its tree's SHA
    const currentCommit = await getCurrentCommit(octo, org, repo, branch)
    //const filesPaths = await glob(coursePath)
    const filesBlobs = await Promise.all(filesPaths.map(createBlobForFile(octo, org, repo)))
    const pathsForBlobs = filesPaths.map(fullPath => path.relative('./', fullPath))
    const newTree = await createNewTree(
        octo,
        org,
        repo,
        filesBlobs,
        pathsForBlobs,
        currentCommit.treeSha
    )
    const newCommit = await createNewCommit(
        octo,
        org,
        repo,
        `${COMMIT_MESSAGE_PREFIX} (${version})`,
        newTree.sha,
        currentCommit.commitSha
    );

    await setBranchToCommit(octo, org, repo, branch, newCommit.sha);

    return newCommit.sha;
}


const getCurrentCommit = async (octo, org, repo, branch) => {
    const { data: refData } = await octo.rest.git.getRef({
        owner: org,
        repo,
        ref: `heads/${branch}`,
    })
    const commitSha = refData.object.sha
    const { data: commitData } = await octo.rest.git.getCommit({
        owner: org,
        repo,
        commit_sha: commitSha,
    })
    return {
        commitSha,
        treeSha: commitData.tree.sha,
    }
}

// Notice that readFile's utf8 is typed differently from Github's utf-8
const getFileAsUTF8 = (filePath) => readFile(filePath, 'utf8')

const createBlobForFile = (octo, org, repo) => async (filePath) => {
    const content = await getFileAsUTF8(filePath)
    const blobData = await octo.rest.git.createBlob({
        owner: org,
        repo,
        content,
        encoding: 'utf-8',
    })
    return blobData.data
}

const createNewTree = async (octo, owner, repo, blobs, paths, parentTreeSha) => {
    // My custom config. Could be taken as parameters
    const tree = blobs.map(({ sha }, index) => ({
        path: paths[index],
        mode: `100644`,
        type: `blob`,
        sha,
    }))
    const { data } = await octo.rest.git.createTree({
        owner,
        repo,
        tree,
        base_tree: parentTreeSha,
    })
    return data
}

const createNewCommit = async (octo, org, repo, message, currentTreeSha, currentCommitSha) =>
    (await octo.rest.git.createCommit({
        owner: org,
        repo,
        message,
        tree: currentTreeSha,
        parents: [currentCommitSha],
    })).data

const setBranchToCommit = (octo, org, repo, branch, commitSha) =>
    octo.rest.git.updateRef({
        owner: org,
        repo,
        ref: `heads/${branch}`,
        sha: commitSha,
    })

const filterCommits = (commits) => {
    const features = [];
    const bug_fixes = [];
    const other_commits = [];

    commits.reverse().forEach((commitData) => {
        let { message } = commitData.commit;

        if (!message.startsWith('Merge pull request') && !message.startsWith('Merge branch') && !message.startsWith('Auto generated - ')) {
            const splits = message.split(':');

            const commit = {
                commit_name: message,
                commit_hash: commitData.sha,
                compact_commit_hash: commitData.sha.substring(0, 7),
            };

            if (splits.length > 1) {
                const type = splits[0].trim().toLowerCase();
                splits.shift();
                commit.commit_name = splits.join(' ').trim();
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

const filterFiles = (files) => {
    const fileSetHashMap = new Set();
    const fileList = [];

    files.forEach((file) => {
        const { filename } = file;
        let entity = filename;
        let type = 'Other';
        let subProjectRoot = null;

        if (filename.startsWith('service/lambda/')) {
            const lambdaName = filename.split('/')[2];
            entity = capitalize(lambdaName);
            type = 'Lambda';
            subProjectRoot = `service/lambda/${lambdaName}`;
            //fileList.push({ entity: capitalize(filename.split('/')[2]), type: 'Lambda' });
        } else if (filename.startsWith('service/')) {
            const serviceName = filename.split('/')[1];
            entity = capitalize(serviceName);
            type = 'ECS';
            subProjectRoot = `service/${serviceName}`;
            //fileList.push({ entity: capitalize(filename.split('/')[1]), type: 'ECS' });
        } else if (filename.startsWith('infra/')) {
            entity = filename;
            type = 'Infrastructure';
            //fileList.push({ entity: filename, type: 'Infrastructure' });
        }
        const entityHash = Crypto.generateHash(`${entity}-${type}`);
        if (!fileSetHashMap.has(entityHash)) {
            fileSetHashMap.add(entityHash);
            fileList.push({ entity, type, subProjectRoot });
        }
    });

    return fileList.sort();
};

module.exports = {
    uploadToRepo,
    filterCommits,
    filterFiles
};