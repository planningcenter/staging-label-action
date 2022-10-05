# staging-label-action


This github action will add the `staging` label to any pull request that is merged to the `staging` branch. If more commits are pushed to the branch that was previously merged, the `staging` label will be automatically removed.

## How to use

To make use of this action in your repository, you will need to setup a workflow like the one below.

```
name: Testing Staging Label

# This action needs to run on push
on: [push]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      - name: Staging label
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        uses: planningcenter/staging-label-action@v0.1.1
```
