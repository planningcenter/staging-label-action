const core = require('@actions/core');
const github = require('@actions/github');
const { Octokit } = require("@octokit/action");

const STAGING = 'staging';
const DEPLOY_STAGING = 'deploy-staging';

async function run() {
  try {
    const octokit = new Octokit();
    const context = github.context;

    if (context.eventName === 'push') {
      await addStagingLabelBranchOnStaging(octokit, context);
      return;
    }

    const deployStagingLabelAdded = context.eventName === 'pull_request' &&
                                    context.payload.action === 'labeled' &&
                                    context.payload.label.name === DEPLOY_STAGING;

    if (deployStagingLabelAdded) {
      await mergeBranchToStaging(octokit, context);
    }
 } catch(error) {
    core.setFailed(error.message);
  }
}

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
        await addStagingLabel(octokit, context, p.number);

        const hasDeployLabel = p.labels.some(label => label.name === DEPLOY_STAGING);
        if (hasDeployLabel) {
          await removeLabel(DEPLOY_STAGING, octokit, context, p.number);
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
      pullsWithLabels.map(p => removeLabel(stagingLabel.name, octokit, context, p.number))
    );
  }
}


async function mergeBranchToStaging(octokit, context) {
  const prNumber = context.payload.pull_request.number;
  const headBranch = context.payload.pull_request.head.ref;
  const headSha = context.payload.pull_request.head.sha;

  try {
    // Merge the PR branch into staging
    core.info(`Attempting to merge ${headBranch} into staging`);

    const mergeResult = await octokit.rest.repos.merge({
      ...context.repo,
      base: STAGING,
      head: headSha,
      commit_message: `Merge ${headBranch} into ${STAGING} via ${DEPLOY_STAGING} label`
    });

    if (mergeResult.status !== 201) {
      // Response code mappings: https://docs.github.com/en/rest/branches/branches?apiVersion=2022-11-28#merge-a-branch
      throw new Error(`Unexpected response status: ${mergeResult.status}`)
    }

    core.info(`Successfully merged ${headBranch} into ${STAGING}`);
    await addStagingLabel(octokit, context, prNumber);

  } catch (error) {
    core.error(`Failed to merge ${headBranch} into ${STAGING}: ${error.message}`);

    // Add error comment to PR
    await octokit.rest.issues.createComment({
      ...context.repo,
      issue_number: prNumber,
      body: `❌ Failed to merge \`${headBranch}\` into \`${STAGING}\`.\n\n**Error:** ${error.message}`
    });

    throw error;
  }

  // Remove the deploy-staging label from the PR regardless of merge outcome
  await removeLabel(DEPLOY_STAGING, octokit, context, prNumber);
}

async function addStagingLabel(octokit, context, issueNumber) {
  core.info(`Adding ${STAGING} label to PR #${issueNumber}`);

  try {
    await octokit.rest.issues.addLabels({
      ...context.repo,
      issue_number: issueNumber,
      labels: [STAGING]
    });
  } catch (error) {
    core.warning(`Could not add label ${STAGING}: ${error.message}`);
  }
}

async function removeLabel(label, octokit, context, issueNumber) {
  core.info(`Removing ${label} label from PR #${issueNumber}`);

  try {
    await octokit.rest.issues.removeLabel({
      ...context.repo,
      issue_number: issueNumber,
      name: label
    });
  } catch (error) {
    // Label might not exist, ignore the error
    core.warning(`Could not remove label ${label}: ${error.message}`);
  }
}

run();
