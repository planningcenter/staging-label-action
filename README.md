# staging-label-action


This github action will add the `staging` label to any pull request that is merged to the `staging` branch. If more commits are pushed to the branch that was previously merged, the `staging` label will be automatically removed.

## How to use

To make use of this action in your repository, you will need to setup a workflow like the one below.

```yaml
name: Staging Label

# This action needs to run on push
on: [push]

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
