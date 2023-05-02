const path = require('path')
const { readFile } = require('fs-extra');

const COMMIT_MESSAGE = process.env.COMMIT_MESSAGE || 'Auto generated';

const uploadToRepo = async (octo, filesPaths, org, repo, branch) => {
    // gets commit's AND its tree's SHA
    const currentCommit = await getCurrentCommit(octo, org, repo, branch)
    //const filesPaths = await glob(coursePath)
    const filesBlobs = await Promise.all(filesPaths.map(createBlobForFile(octo, org, repo)))
    const pathsForBlobs = filesPaths.map(fullPath => path.relative(filesPaths, fullPath))
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

module.exports = {
    uploadToRepo
};