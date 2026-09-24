# Repository workflow

- After completing a task that changes repository files, commit the task's changes to the current Git branch so they appear in GitHub Desktop.
- Use a concise, descriptive commit message and include only changes belonging to the completed task.
- The user has given standing authorization to push completed changes and publish every game update to https://gladkyimykhailo.github.io/CS-Shooter/ without asking again.
- After changing the game, run the relevant checks and `npm run package`, commit the task's changes, and push the current development branch.
- GitHub Pages publishes the root of `gh-pages`. Update that branch's `index.html` from `dist/index.html` and `ASSET_CREDITS.md` from the repository, preserve `.nojekyll`, then commit and push the deployment. Use a clean worktree and preserve any unrelated changes.
- Verify that the Pages deployment succeeds and the public site serves the updated build before reporting publication complete.
