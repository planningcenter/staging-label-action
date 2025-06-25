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
  const ALREADY_MERGED = 204;
  const MERGE_CONFLICT = 409;

  try {
    core.info(`Attempting to merge ${headBranch} into staging`);

    await octokit.rest.repos.merge({
      ...context.repo,
      base: STAGING,
      head: headSha,
      commit_message: `Merge ${headBranch} into ${STAGING} via ${DEPLOY_STAGING} label`
    });

    core.info(`Successfully merged ${headBranch} into ${STAGING}`);
    await addStagingLabel(octokit, context, prNumber);
  } catch (error) {
    switch (error.status) {
      case ALREADY_MERGED:
        core.warning(`${headBranch} is already merged to ${STAGING}. No action taken.`);
        break;
      case MERGE_CONFLICT:
        core.warning(`Merge conflict when merging ${headBranch} into ${STAGING}.`);
        await addComment(octokit, context, prNumber, `⚠️ Merge conflicts with \`${STAGING}\`. Please merge the branch manually to resolve the conflicts.`);
        break;
      default:
        core.error(`Error attempting to merge \`${headBranch}\` into \`${STAGING}\`: ${error.message}`);
        await addComment(octokit, context, prNumber, `❌ Failed to merge branch to \`${STAGING}\`.\n\n**Error:** ${error.message}`);
        throw new Error(`Unexpected merge branch response status: ${error.status}`);
    }
  } finally {
    await removeLabel(DEPLOY_STAGING, octokit, context, prNumber); // Remove regardless of merge outcome
  }
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
    core.error(`Could not add label ${STAGING}: ${error.message}`);
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
    core.error(`Could not remove label ${label}: ${error.message}`);
  }
}

async function addComment(octokit, context, issueNumber, message) {
  try {
    await octokit.rest.issues.createComment({
      ...context.repo,
      issue_number: issueNumber,
      body: message
    });
  } catch (error) {
    core.error(`Could not add comment \`${message}\`: ${error.message}`);
  }
}

run();
