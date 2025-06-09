const core = require('@actions/core');
const github = require('@actions/github');
const { Octokit } = require("@octokit/action");

const STAGING = 'staging';

async function run() {
  try {
    const octokit = new Octokit();
    const context = github.context;

      await addStagingLabelBranchOnStaging(octokit, context);
 } catch(error) {
    core.setFailed(error.message);

async function addStagingLabelBranchOnStaging(octokit, context) {
  // Get all branches for head_commit in payload
  const commit_sha = github.context.payload.head_commit.id
  const { data: branches } = await octokit.rest.repos.listBranchesForHeadCommit({
    ...context.repo,
    commit_sha,
  });
  const { data: pulls } = await octokit.rest.pulls.list({ ...context.repo });

  // remove main from the branches
  const filteredBranches = branches.filter(branch => branch.name !== "main");

  if (filteredBranches.find(branch => branch.name === STAGING)) {
    const commits = github.context.payload.commits.filter(commit => commit.tree_id === github.context.payload.head_commit.tree_id)
    let existingPulls = [];

    commits.forEach(c => {
      let commit = pulls.find(p => p.head.sha === c.id);
      if (commit) {
        existingPulls = [...existingPulls, commit]
      }
    });

    github.context.payload.commits.forEach(c => {
      let commit = pulls.find(p => p.head.sha === c.id);

      if (commit) {
        existingPulls = [...existingPulls, commit]
      }
    });

    await Promise.all(
      existingPulls.map(async p => {
        await octokit.rest.issues.addLabels({
          ...context.repo,
          issue_number: p.number,
          labels: [STAGING]
        });

        // Remove deploy-staging label if it exists
        const hasDeployLabel = p.labels.some(label => label.name === DEPLOY_STAGING);
        if (hasDeployLabel) {
          try {
            await octokit.rest.issues.removeLabel({
              ...context.repo,
              issue_number: p.number,
              name: DEPLOY_STAGING
            });
          } catch (error) {
            // Label might not exist, ignore the error
            core.warning(`Could not remove ${DEPLOY_STAGING} label from PR #${p.number}: ${error.message}`);
          }
        }
      })
    );
  } else {
    let pullsWithLabels = [];
    let stagingLabel;
    filteredBranches.forEach(branch => {
      const pull = pulls.find(p => p.head.ref === branch.name && p.labels.length > 0);
      stagingLabel = pull && pull.labels.find(label => label.name.toLocaleLowerCase() === STAGING
      );
      if (stagingLabel) { pullsWithLabels = [...pullsWithLabels, pull] }
    });

    Promise.all(
      pullsWithLabels.map(p => octokit.rest.issues.removeLabel({...context.repo, issue_number: p.number, name: stagingLabel.name }))
    );
  }
}

    }

  } catch(error) {
    core.setFailed(error.message);
  }
}

run();
