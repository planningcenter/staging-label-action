const core = require('@actions/core');
const github = require('@actions/github');
const { Octokit } = require("@octokit/action");

async function run() {
  try {
    const octokit = new Octokit();

    const context = github.context
    const payload = context.payload

    // Get all branches for head_commit in payload
    const commit_sha = payload.head_commit.id
    const { data: branches } = await octokit.rest.repos.listBranchesForHeadCommit({
      ...context.repo,
      commit_sha,
    });
    const { data: pulls } = await octokit.rest.pulls.list({ ...context.repo })

  } catch(error) {
    core.setFailed(error.message);
  }
}

run();
