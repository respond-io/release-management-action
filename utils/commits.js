const path = require('path')
const { readFile } = require('fs-extra');

const COMMIT_MESSAGE = process.env.COMMIT_MESSAGE || 'Auto generated'

const uploadToRepo = async (octo, filesPaths, org, repo, branch) => {
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
        COMMIT_MESSAGE,
        newTree.sha,
        currentCommit.commitSha
    )
    await setBranchToCommit(octo, org, repo, branch, newCommit.sha)
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

        if (!message.startsWith('Merge pull request') && !message.startsWith('Merge branch')) {
            const splits = message.split(':');

            const commit = {
                commit_name: message,
                commit_hash: commitData.sha,
                compact_commit_hash: commitData.sha.substring(0, 7),
            };

            if (splits > 1) {
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
                other_commits.push(message);
            }
        }
        
    });

    return { features, bug_fixes, other_commits };
};

const filterFiles = (files) => {
    const fileSet = new Set();

    files.forEach((file) => {
        const { filename } = file;
        if (filename.startsWith('service/lambda/')) {
            fileSet.add({ entity: filename.replace('services/lambda/', ''), type: 'Lambda' });
        } else if (filename.startsWith('service/')) {
            fileSet.add({ entity: filename.replace('services/', ''), type: 'ECS' });
        } else if (filename.startsWith('infra/')) {
            fileSet.add({ entity: filename, type: 'Infrastructure' });
        } else {
            fileSet.add({ entity: filename, type: 'Other' });
        }
    });

    return Array.from(fileSet).sort();
};

module.exports = {
    uploadToRepo,
    filterCommits,
    filterFiles
};