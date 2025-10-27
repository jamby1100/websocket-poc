## Server Commands

```sh
# run it manually
npm run server

REDIS_HOST=master.websocket-redis-correct.vghwpa.apse1.cache.amazonaws.com REDIS_PORT=637 REDIS_TLS=true REDIS_TLS_REJECT_UNAUTHORIZED=false npm run server

# run it via Docker
docker build -t websocket-server .
docker run -p 3000:3000 -it \
  -e REDIS_HOST=host.docker.internal \
  -e REDIS_PORT=6379 \
  websocket-server
```

```js
start
sendroom user-room-12345 "Here's a message from the server"
```

## Client Commands

```sh
# Connect to localhost (default)
npm run client

# Connect to a custom server
WEBSOCKET_SERVER=54.169.75.241 npm run client

# Specify custom server and port
WEBSOCKET_SERVER=example.com WEBSOCKET_PORT=8080 npm run client
```

**Environment Variables:**
- `WEBSOCKET_SERVER` - WebSocket server host (default: `localhost`)
- `WEBSOCKET_PORT` - WebSocket server port (default: `3000`)

```js
connect
join user-room-12345
send "Here's a message from the client"
leave
```

## Publisher

Since the Redis ElastiCache is inside the VPC, it can only be accessed from within the network

```sh
REDIS_HOST=localhost REDIS_PORT=6379 node redis-publisher.js

REDIS_HOST=master.websocket-redis-correct.vghwpa.apse1.cache.amazonaws.com REDIS_PORT=6379 REDIS_TLS=true REDIS_TLS_REJECT_UNAUTHORIZED=false node redis-publisher.js
```

```js
test
send user-room-12345 "Here's a message from the emitter"
```

## Building in Docker

```sh
docker build -t websocket-server .
docker run -p 3600:3600 -it \
  -e REDIS_HOST=host.docker.internal \
  -e REDIS_PORT=6379 \
  websocket-server


docker exec -it socketio-redis redis-cli

```

## ECS

```sh

aws ecr create-repository \
    --repository-name poc/websocket-server \
    --encryption-configuration encryptionType=AES256 \
    --image-tag-mutability MUTABLE \
    --profile personal \
    --region ap-southeast-1

aws ecr get-login-password --region ap-southeast-1 --profile personal | docker login --username AWS --password-stdin $(aws sts get-caller-identity --profile personal --query Account --output text).dkr.ecr.ap-southeast-1.amazonaws.com

docker build -t websocket-server .

docker tag websocket-server:latest $(aws sts get-caller-identity --profile personal --query Account --output text).dkr.ecr.ap-southeast-1.amazonaws.com/poc/websocket-server:latest

docker push $(aws sts get-caller-identity --profile personal --query Account --output text).dkr.ecr.ap-southeast-1.amazonaws.com/poc/websocket-server:latest


```

=======
# joyride-websocket



## Getting started

To make it easy for you to get started with GitLab, here's a list of recommended next steps.

Already a pro? Just edit this README.md and make it your own. Want to make it easy? [Use the template at the bottom](#editing-this-readme)!

## Add your files

- [ ] [Create](https://docs.gitlab.com/ee/user/project/repository/web_editor.html#create-a-file) or [upload](https://docs.gitlab.com/ee/user/project/repository/web_editor.html#upload-a-file) files
- [ ] [Add files using the command line](https://docs.gitlab.com/topics/git/add_files/#add-files-to-a-git-repository) or push an existing Git repository with the following command:

```
cd existing_repo
git remote add origin https://gitlab.ecvmsp.com/ecv-ph-tech-team/ph-modernization-team/joyride/joyride-websocket.git
git branch -M main
git push -uf origin main
```

## Integrate with your tools

- [ ] [Set up project integrations](https://gitlab.ecvmsp.com/ecv-ph-tech-team/ph-modernization-team/joyride/joyride-websocket/-/settings/integrations)

## Collaborate with your team

- [ ] [Invite team members and collaborators](https://docs.gitlab.com/ee/user/project/members/)
- [ ] [Create a new merge request](https://docs.gitlab.com/ee/user/project/merge_requests/creating_merge_requests.html)
- [ ] [Automatically close issues from merge requests](https://docs.gitlab.com/ee/user/project/issues/managing_issues.html#closing-issues-automatically)
- [ ] [Enable merge request approvals](https://docs.gitlab.com/ee/user/project/merge_requests/approvals/)
- [ ] [Set auto-merge](https://docs.gitlab.com/user/project/merge_requests/auto_merge/)

## Test and Deploy

Use the built-in continuous integration in GitLab.

- [ ] [Get started with GitLab CI/CD](https://docs.gitlab.com/ee/ci/quick_start/)
- [ ] [Analyze your code for known vulnerabilities with Static Application Security Testing (SAST)](https://docs.gitlab.com/ee/user/application_security/sast/)
- [ ] [Deploy to Kubernetes, Amazon EC2, or Amazon ECS using Auto Deploy](https://docs.gitlab.com/ee/topics/autodevops/requirements.html)
- [ ] [Use pull-based deployments for improved Kubernetes management](https://docs.gitlab.com/ee/user/clusters/agent/)
- [ ] [Set up protected environments](https://docs.gitlab.com/ee/ci/environments/protected_environments.html)

***

# Editing this README

When you're ready to make this README your own, just edit this file and use the handy template below (or feel free to structure it however you want - this is just a starting point!). Thanks to [makeareadme.com](https://www.makeareadme.com/) for this template.

## Suggestions for a good README

Every project is different, so consider which of these sections apply to yours. The sections used in the template are suggestions for most open source projects. Also keep in mind that while a README can be too long and detailed, too long is better than too short. If you think your README is too long, consider utilizing another form of documentation rather than cutting out information.

## Name
Choose a self-explaining name for your project.

## Description
Let people know what your project can do specifically. Provide context and add a link to any reference visitors might be unfamiliar with. A list of Features or a Background subsection can also be added here. If there are alternatives to your project, this is a good place to list differentiating factors.

## Badges
On some READMEs, you may see small images that convey metadata, such as whether or not all the tests are passing for the project. You can use Shields to add some to your README. Many services also have instructions for adding a badge.

## Visuals
Depending on what you are making, it can be a good idea to include screenshots or even a video (you'll frequently see GIFs rather than actual videos). Tools like ttygif can help, but check out Asciinema for a more sophisticated method.

## Installation
Within a particular ecosystem, there may be a common way of installing things, such as using Yarn, NuGet, or Homebrew. However, consider the possibility that whoever is reading your README is a novice and would like more guidance. Listing specific steps helps remove ambiguity and gets people to using your project as quickly as possible. If it only runs in a specific context like a particular programming language version or operating system or has dependencies that have to be installed manually, also add a Requirements subsection.

## Usage
Use examples liberally, and show the expected output if you can. It's helpful to have inline the smallest example of usage that you can demonstrate, while providing links to more sophisticated examples if they are too long to reasonably include in the README.

## Support
Tell people where they can go to for help. It can be any combination of an issue tracker, a chat room, an email address, etc.

## Roadmap
If you have ideas for releases in the future, it is a good idea to list them in the README.

## Contributing
State if you are open to contributions and what your requirements are for accepting them.

For people who want to make changes to your project, it's helpful to have some documentation on how to get started. Perhaps there is a script that they should run or some environment variables that they need to set. Make these steps explicit. These instructions could also be useful to your future self.

You can also document commands to lint the code or run tests. These steps help to ensure high code quality and reduce the likelihood that the changes inadvertently break something. Having instructions for running tests is especially helpful if it requires external setup, such as starting a Selenium server for testing in a browser.

## Authors and acknowledgment
Show your appreciation to those who have contributed to the project.

## License
For open source projects, say how it is licensed.

## Project status
If you have run out of energy or time for your project, put a note at the top of the README saying that development has slowed down or stopped completely. Someone may choose to fork your project or volunteer to step in as a maintainer or owner, allowing your project to keep going. You can also make an explicit request for maintainers.
>>>>>>> gitlab_origin/main
