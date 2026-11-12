# SGMobile Beta Pages

This repository is the future public Pages destination for SGMobile Beta. The current repository contains setup files and the existing placeholder README. The playable package is held outside this public repository.

The Pages publishing source should be GitHub Actions. The workflow has only a manual trigger and runs from main in this repository. Publication requires explicitly selecting the publish checkbox and entering the SHA-256 of the reviewed release manifest. It verifies the artifact and uses the GitHub Pages deployment environment. A source push alone does not run this workflow.

A public Pages deployment at this organization address is accessible to visitors. Run the owner-only test on an access-controlled HTTPS origin with disposable installation data and copies of saves. Keep the existing public Alpha and private developer deployments separate.

When public publication is authorized, first audit the exact static package outside the repository. Stage only its static files under site/. Stage those files on the public repository only at the authorized release cutover because repository contents are visible independently of Pages. Do not add original game inputs, save files, logs, or private credentials. The candidate uses a standalone PWA with /sgmobile-beta as its manifest ID and sgmobile-beta-app- as its worker cache prefix.
