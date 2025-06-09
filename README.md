# staging-label-action

This github action will add the `staging` label to any pull request that is merged to the `staging` branch. If more commits are pushed to the branch that was previously merged, the `staging` label will be automatically removed.

Additionally, when the `deploy-staging` label is added to a PR, it will automatically merge that PR's branch into the `staging` branch. If there are merge conflicts or errors, it will comment on the PR with the error details.

## How to use

To make use of this action in your repository, you will need to setup a workflow like the one below.

```yaml
name: Staging Label

# This action needs to run on push and pull request label events
on:
  push:
  pull_request:
    types: [labeled]

permissions:
  contents: write
  issues: read
  pull-requests: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: planningcenter/staging-label-action@v0.6.0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Copyright & License

Copyright (c) Planning Center, licensed MIT. See LICENSE file in this repo.
