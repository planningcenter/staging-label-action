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

If you find that this action can be a bit slow, you may be able to speed it up by using [setup-node](https://github.com/actions/setup-node). Add this to your workflow:

```
steps:
  - uses: actions/checkout@v3
  - uses: actions/setup-node@v3
    with:
      node-version: '12'
      cache: 'npm'
  - name: Staging label
    env:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    uses: planningcenter/staging-label-action@v0.1.1
```

## Copyright & License

Copyright (c) Planning Center, licensed MIT. See LICENSE file in this repo.
